"""Synthetic White-POV scores for terminal positions (no engine call)."""

from __future__ import annotations

import chess

from app.chess.classifier import MATE_CP
from app.engine.stockfish import EngineScore


def score_terminal_fen(fen: str) -> EngineScore | None:
    """Return a synthetic score if the position is game-over; else None.

    White POV:
    - Checkmate with Black to move → White won → mate +1
    - Checkmate with White to move → Black won → mate -1
    - Stalemate / insufficient material / other automatic draw → 0
    """
    board = chess.Board(fen)

    if board.is_checkmate():
        # Side to move is the one who has been mated
        if board.turn == chess.BLACK:
            return EngineScore(cp=None, mate=1, best_move_uci=None, pv_uci=[], depth=0)
        return EngineScore(cp=None, mate=-1, best_move_uci=None, pv_uci=[], depth=0)

    if (
        board.is_stalemate()
        or board.is_insufficient_material()
        or board.is_seventyfive_moves()
        or board.is_fivefold_repetition()
    ):
        return EngineScore(cp=0, mate=None, best_move_uci=None, pv_uci=[], depth=0)

    outcome = board.outcome(claim_draw=True)
    if outcome is not None:
        if outcome.winner is None:
            return EngineScore(cp=0, mate=None, best_move_uci=None, pv_uci=[], depth=0)
        if outcome.winner == chess.WHITE:
            return EngineScore(cp=None, mate=1, best_move_uci=None, pv_uci=[], depth=0)
        return EngineScore(cp=None, mate=-1, best_move_uci=None, pv_uci=[], depth=0)

    return None


def terminal_cp_white(score: EngineScore) -> float:
    if score.mate is not None:
        return float(MATE_CP if score.mate > 0 else -MATE_CP)
    return float(score.cp or 0)
