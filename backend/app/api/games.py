"""Game review API routes."""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app import config
from app.chess.commentary import ensure_comments
from app.chess.pgn import parse_pgn
from app.db.cache import db
from app.engine.queue import job_queue
from app.engine.stockfish import AnalysisSettings
from app.voice.piper import schedule_review_audio
from app.models import (
    CreateGameRequest,
    CreateGameResponse,
    GameListItem,
    GameReview,
)

router = APIRouter(prefix="/api/games", tags=["games"])


def _persist_comments(game_id: str, review: Dict[str, Any]) -> Dict[str, Any]:
    """Store template comments for reviews saved before commentary existed."""
    if not ensure_comments(review, game_id):
        return review
    white = review.get("white") or {}
    black = review.get("black") or {}
    db.upsert_review(
        review_id=review.get("id") or game_id,
        title=review.get("title") or "Review",
        pgn=review.get("pgn") or "",
        headers=review.get("headers") or {},
        starting_fen=review.get("starting_fen") or "",
        status=review.get("status") or "completed",
        settings=review.get("settings") or {},
        review=review,
        white_accuracy=white.get("accuracy") if isinstance(white, dict) else None,
        black_accuracy=black.get("accuracy") if isinstance(black, dict) else None,
        error=review.get("error"),
    )
    return review


@router.post("", response_model=CreateGameResponse)
async def create_game(body: CreateGameRequest) -> CreateGameResponse:
    try:
        parse_pgn(body.pgn)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    settings = AnalysisSettings(
        movetime_ms=body.movetime_ms
        if body.movetime_ms is not None
        else (None if body.depth is not None else config.DEFAULT_MOVETIME_MS),
        depth=body.depth,
    )
    job_id = job_queue.submit(body.pgn, settings)
    return CreateGameResponse(job_id=job_id)


@router.get("", response_model=list[GameListItem])
async def list_games() -> list[GameListItem]:
    items = db.list_reviews()
    return [GameListItem(**item) for item in items]


@router.get("/{game_id}", response_model=GameReview)
async def get_game(game_id: str) -> GameReview:
    review = db.get_review(game_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Game not found")
    review = _persist_comments(game_id, review)
    schedule_review_audio(review)
    return GameReview(**review)


@router.get("/{game_id}/events")
async def game_events(game_id: str) -> StreamingResponse:
    # If already completed in DB, send a single done event
    existing = db.get_review(game_id)
    if existing and existing.get("status") == "completed":
        existing = _persist_comments(game_id, existing)
        schedule_review_audio(existing)
    if existing and existing.get("status") in {"completed", "error"}:
        async def already_done() -> AsyncIterator[str]:
            if existing.get("status") == "error":
                payload = {"type": "error", "message": existing.get("error") or "error"}
            else:
                payload = {"type": "done", "review": existing}
            # Ask the browser to wait before reconnecting. A finished review has nothing further to send.
            yield f"retry: 3600000\ndata: {json.dumps(payload)}\n\n"

        return StreamingResponse(already_done(), media_type="text/event-stream")

    queue = job_queue.subscribe(game_id)

    async def event_stream() -> AsyncIterator[str]:
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                terminal = event.get("type") in {"done", "error"}
                retry = "retry: 3600000\n" if terminal else ""
                yield f"{retry}data: {json.dumps(event)}\n\n"
                if terminal:
                    break
        finally:
            job_queue.unsubscribe(game_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
