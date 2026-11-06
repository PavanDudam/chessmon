"""Commentary facts and template lines. No engine.

Exercises move_facts, comment_for, comment_for_move, and ensure_comments.
No existing test file covers app.chess.commentary.
"""

from __future__ import annotations

import chess

from app.chess.commentary import comment_for, comment_for_move, ensure_comments, move_facts
from app.chess.pgn import parse_pgn

QH4 = "1. e4 e5 2. Nf3 Qh4"

OPERA = """
1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#
"""


def _ply(pgn: str, san: str):
    game = parse_pgn(pgn)
    return next(ply for ply in game.plies if ply.san == san)


def test_qh4_blunder_mentions_hanging_queen():
    ply = _ply(QH4, "Qh4")
    result = comment_for_move(ply.fen_before, ply.uci, "Blunder", "b8c6", "game-qh4", ply.ply)
    text = result["text"].lower()
    assert "queen" in text
    assert "h4" in text
    assert "hangs_piece" in result["tags"]
    assert "Nc6" in result["text"]


def test_qb8_best_mentions_check():
    ply = _ply(OPERA, "Qb8+")
    result = comment_for_move(ply.fen_before, ply.uci, "Best", None, "opera", ply.ply)
    assert "check" in result["tags"]
    assert "check" in result["text"].lower()


def test_rd8_mate_needs_no_best_move():
    ply = _ply(OPERA, "Rd8#")
    result = comment_for_move(ply.fen_before, ply.uci, "Best", None, "opera", ply.ply)
    assert "mate" in result["tags"]
    assert result["text"]
    assert result["comment_id"].startswith("Best:mate:")


def test_en_passant_names_pawn():
    board = chess.Board("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 5")
    move = board.parse_san("exd6")
    facts = move_facts(board, move, None)
    assert facts["captured"] == "pawn"
    assert "capture" in facts["tags"]
    assert board.fen() == "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 5"


def test_castling_and_promotion_do_not_throw():
    castle_board = chess.Board("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
    castle = castle_board.parse_san("O-O")
    castle_facts = move_facts(castle_board, castle, None)
    assert "castle" in castle_facts["tags"]

    promo_board = chess.Board("4k3/P7/8/8/8/8/8/4K3 w - - 0 1")
    promo = promo_board.parse_san("a8=Q")
    result = comment_for_move(promo_board.fen(), promo.uci(), "Best", None, "promo", 1)
    assert "promo" in result["tags"]
    assert result["text"]


def test_stalemate_is_neutral_and_does_not_crash():
    board = chess.Board("7k/8/5QK1/8/8/8/8/8 w - - 0 1")
    move = board.parse_san("Qf7")
    result = comment_for_move(board.fen(), move.uci(), "Blunder", None, "stale", 1)
    text = result["text"].lower()
    assert "stalemate" in result["tags"]
    assert text
    for word in ("win", "loss", "won", "lost"):
        assert word not in text


def test_same_game_and_ply_is_stable():
    ply = _ply(QH4, "Qh4")
    first = comment_for_move(ply.fen_before, ply.uci, "Blunder", "b8c6", "same", 4)
    second = comment_for_move(ply.fen_before, ply.uci, "Blunder", "b8c6", "same", 4)
    assert first == second
    assert first["comment_id"]


def test_illegal_uci_returns_empty_text():
    start = chess.Board().fen()
    result = comment_for_move(start, "e2e5", "Best", None, "bad", 1)
    assert result["text"] == ""
    assert result["comment_id"] == ""
    garbage = comment_for_move(start, "zzzz", "Best", None, "bad", 1)
    assert garbage["text"] == ""


def test_seed_uses_game_and_ply_not_plain_random():
    facts = {
        "san": "e4",
        "piece": "pawn",
        "to": "e4",
        "captured": "",
        "best": "",
        "tags": [],
    }
    assert comment_for("Book", facts, "g", 1) == comment_for("Book", facts, "g", 1)


def test_ensure_comments_fills_once():
    ply = _ply(QH4, "Nf3")
    review = {
        "status": "completed",
        "moves": [
            {
                "ply": ply.ply,
                "fen_before": ply.fen_before,
                "uci": ply.uci,
                "label": "Best",
                "best_move_uci": ply.uci,
            }
        ],
    }
    assert ensure_comments(review, "saved") is True
    assert review["moves"][0]["comment"]
    assert ensure_comments(review, "saved") is False
    assert ensure_comments({"status": "analyzing", "moves": [{}]}, "x") is False
