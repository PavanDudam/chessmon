"""Game review API routes."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app import config
from app.chess.pgn import parse_pgn
from app.db.cache import db
from app.engine.queue import job_queue
from app.engine.stockfish import AnalysisSettings
from app.models import (
    CreateGameRequest,
    CreateGameResponse,
    GameListItem,
    GameReview,
)

router = APIRouter(prefix="/api/games", tags=["games"])


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
    return GameReview(**review)


@router.get("/{game_id}/events")
async def game_events(game_id: str) -> StreamingResponse:
    # If already completed in DB, send a single done event
    existing = db.get_review(game_id)
    if existing and existing.get("status") in {"completed", "error"}:
        async def already_done() -> AsyncIterator[str]:
            if existing.get("status") == "error":
                payload = {"type": "error", "message": existing.get("error") or "error"}
            else:
                payload = {"type": "done", "review": existing}
            yield f"data: {json.dumps(payload)}\n\n"

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

                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in {"done", "error"}:
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
