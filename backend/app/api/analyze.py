"""Single-position analysis endpoint."""

from __future__ import annotations

import chess
from fastapi import APIRouter, HTTPException

from app import config
from app.chess.classifier import cp_to_win_percent, score_to_cp_white
from app.db.cache import db
from app.engine.analyzer import analyze_position
from app.engine.stockfish import AnalysisSettings, pool
from app.models import AnalyzePositionRequest, AnalyzePositionResponse

router = APIRouter(prefix="/api/analyze", tags=["analyze"])


@router.post("/position", response_model=AnalyzePositionResponse)
async def analyze_one(body: AnalyzePositionRequest) -> AnalyzePositionResponse:
    try:
        board = chess.Board(body.fen)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {exc}") from exc

    settings = AnalysisSettings(
        movetime_ms=body.movetime_ms
        if body.movetime_ms is not None
        else (None if body.depth is not None else config.DEFAULT_MOVETIME_MS),
        depth=body.depth,
    )

    score = await analyze_position(pool, db, board.fen(), settings)
    cp_float = score_to_cp_white(score.cp, score.mate)

    return AnalyzePositionResponse(
        fen=board.fen(),
        cp=score.cp,
        mate=score.mate,
        best_move_uci=score.best_move_uci,
        pv_uci=score.pv_uci or [],
        depth=score.depth,
        win_percent=round(cp_to_win_percent(cp_float), 2),
    )
