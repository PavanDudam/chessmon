"""Terminal-position scoring and endgame PGN analysis."""

from __future__ import annotations

import chess
import pytest

from app.chess.pgn import parse_pgn
from app.chess.terminal import score_terminal_fen, terminal_cp_white
from app.engine.analyzer import analyze_game
from app.engine.stockfish import AnalysisSettings, EnginePool
from app.db.cache import Database
from app.db.schema import init_db


FOOLS_MATE = """
[Event "Fool's mate"]
[White "W"]
[Black "B"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
"""

OPERA_MATE_TAIL = """
[Event "Opera game"]
[White "Morphy"]
[Black "Duke"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0
"""

def test_white_mates_black_to_move():
    game = parse_pgn(
        '[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'
    )
    last = game.plies[-1]
    assert last.is_checkmate
    score = score_terminal_fen(last.fen_after)
    assert score is not None
    assert score.mate == 1
    assert terminal_cp_white(score) > 0


def test_black_mates_white_to_move():
    game = parse_pgn(FOOLS_MATE)
    last = game.plies[-1]
    assert last.is_checkmate
    assert last.moved_by_white is False
    score = score_terminal_fen(last.fen_after)
    assert score is not None
    assert score.mate == -1
    assert terminal_cp_white(score) < 0


def test_stalemate_is_zero():
    board = chess.Board("k7/P7/K7/8/8/8/8/8 b - - 0 1")
    assert board.is_stalemate()
    score = score_terminal_fen(board.fen())
    assert score is not None
    assert score.mate is None
    assert score.cp == 0


def test_non_terminal_returns_none():
    assert score_terminal_fen(chess.STARTING_FEN) is None


@pytest.mark.asyncio
async def test_fools_mate_review_ends_negative(tmp_path):
    import os

    sf = os.environ.get(
        "STOCKFISH_PATH",
        str(__import__("pathlib").Path(__file__).resolve().parents[1] / "bin" / "stockfish"),
    )
    if not os.path.isfile(sf):
        pytest.skip("Stockfish missing")

    db_path = str(tmp_path / "t.db")
    init_db(db_path)
    database = Database(db_path)
    database.connect()
    pool = EnginePool(path=sf, pool_size=1, hash_mb=16)
    pool.start()
    try:
        review = await analyze_game(
            job_id="fools",
            pgn=FOOLS_MATE,
            pool=pool,
            database=database,
            settings=AnalysisSettings(movetime_ms=50),
        )
        last = review["moves"][-1]
        assert last["is_checkmate"] is True
        assert last["label"] == "Best"
        assert last["mate_after"] == -1
        assert last["cp_after"] < 0
        assert last["win_pct_after"] < 5
    finally:
        pool.stop()
        database.close()


@pytest.mark.asyncio
async def test_opera_final_mate_positive(tmp_path):
    import os

    sf = os.environ.get(
        "STOCKFISH_PATH",
        str(__import__("pathlib").Path(__file__).resolve().parents[1] / "bin" / "stockfish"),
    )
    if not os.path.isfile(sf):
        pytest.skip("Stockfish missing")

    db_path = str(tmp_path / "t.db")
    init_db(db_path)
    database = Database(db_path)
    database.connect()
    pool = EnginePool(path=sf, pool_size=1, hash_mb=16)
    pool.start()
    try:
        review = await analyze_game(
            job_id="opera",
            pgn=OPERA_MATE_TAIL,
            pool=pool,
            database=database,
            settings=AnalysisSettings(movetime_ms=50),
        )
        last = review["moves"][-1]
        assert last["san"].endswith("#")
        assert last["is_checkmate"] is True
        assert last["label"] == "Best"
        assert last["mate_after"] == 1
        assert last["cp_after"] > 0
        assert last["win_pct_after"] > 95
    finally:
        pool.stop()
        database.close()


@pytest.mark.asyncio
async def test_stalemate_game_does_not_crash(tmp_path):
    """Engine must not be asked to search a no-move terminal position."""
    import os

    sf = os.environ.get(
        "STOCKFISH_PATH",
        str(__import__("pathlib").Path(__file__).resolve().parents[1] / "bin" / "stockfish"),
    )
    if not os.path.isfile(sf):
        pytest.skip("Stockfish missing")

    # Direct terminal stalemate FEN via a 1-move custom setup is easier:
    # Use a PGN that ends in stalemate from a constructed game if possible.
    # Fallback: score_terminal only — plus analyze_position path.
    from app.engine.analyzer import analyze_position

    db_path = str(tmp_path / "t.db")
    init_db(db_path)
    database = Database(db_path)
    database.connect()
    pool = EnginePool(path=sf, pool_size=1, hash_mb=16)
    pool.start()
    try:
        fen = "k7/P7/K7/8/8/8/8/8 b - - 0 1"
        score = await analyze_position(
            pool, database, fen, AnalysisSettings(movetime_ms=50)
        )
        assert score.cp == 0
        assert score.mate is None
    finally:
        pool.stop()
        database.close()
