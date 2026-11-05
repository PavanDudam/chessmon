"""Integration tests that need Stockfish."""

from __future__ import annotations

import os

import chess
import pytest

from app.chess.classifier import cp_to_win_percent
from app.engine.stockfish import AnalysisSettings, EnginePool


STOCKFISH = os.environ.get(
    "STOCKFISH_PATH",
    str(__import__("pathlib").Path(__file__).resolve().parents[1] / "bin" / "stockfish"),
)


@pytest.fixture(scope="module")
def engine_pool():
    if not os.path.isfile(STOCKFISH):
        pytest.skip("Stockfish binary not found")
    pool = EnginePool(path=STOCKFISH, pool_size=1, hash_mb=16)
    pool.start()
    yield pool
    pool.stop()


@pytest.mark.asyncio
async def test_analyze_startpos(engine_pool):
    score = await engine_pool.analyze(
        chess.STARTING_FEN,
        AnalysisSettings(movetime_ms=100),
    )
    assert score.best_move_uci is not None
    # Starting position should be near equal
    if score.mate is None and score.cp is not None:
        assert abs(score.cp) < 100


@pytest.mark.asyncio
async def test_mate_in_one(engine_pool):
    fen = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1"
    score = await engine_pool.analyze(fen, AnalysisSettings(depth=10))
    assert score.mate == 1 or (score.best_move_uci == "e1e8")
    if score.mate is not None:
        assert score.mate > 0
        assert cp_to_win_percent(10000) > 99
