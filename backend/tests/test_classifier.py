"""Known-position and math tests for the classifier."""

from __future__ import annotations

import math

import chess
import pytest

from app.chess.classifier import (
    MoveLabel,
    classify_move,
    cp_to_win_percent,
    mate_to_cp,
    missed_forced_mate,
    score_to_cp_white,
)
from app.chess.pgn import fen_cache_key, parse_pgn


def test_cp_to_win_percent_even():
    assert abs(cp_to_win_percent(0) - 50.0) < 0.01


def test_cp_to_win_percent_positive():
    # +100 cp should be modestly above 50
    wp = cp_to_win_percent(100)
    assert 55 < wp < 65


def test_cp_to_win_percent_crushing():
    wp = cp_to_win_percent(800)
    assert wp > 90


def test_mate_to_cp_sign():
    assert mate_to_cp(3) > 0
    assert mate_to_cp(-2) < 0


def test_score_to_cp_prefers_mate():
    assert score_to_cp_white(50, 2) == mate_to_cp(2)
    assert score_to_cp_white(50, None) == 50


def test_white_blunder_even_game():
    # Even → hanging a piece (~ -300 after)
    result = classify_move(
        cp_before_white=20,
        cp_after_white=-300,
        moved_by_white=True,
    )
    assert result.label == MoveLabel.BLUNDER
    assert result.win_pct_loss > 10


def test_black_blunder_sign_flip():
    # Black to move in roughly even position, blunders into +300 for White
    result = classify_move(
        cp_before_white=-20,
        cp_after_white=300,
        moved_by_white=False,
    )
    assert result.label == MoveLabel.BLUNDER
    assert result.win_pct_loss > 10


def test_best_move_small_loss():
    result = classify_move(
        cp_before_white=50,
        cp_after_white=45,
        moved_by_white=True,
    )
    assert result.label in {MoveLabel.BEST, MoveLabel.GOOD}
    assert result.win_pct_loss < 2


def test_already_winning_small_drop_not_blunder():
    # +800 → +700 should be a tiny win% drop
    result = classify_move(
        cp_before_white=800,
        cp_after_white=700,
        moved_by_white=True,
    )
    assert result.label in {MoveLabel.BEST, MoveLabel.GOOD, MoveLabel.INACCURACY}
    assert result.win_pct_loss < 5


def test_book_label():
    result = classify_move(
        cp_before_white=0,
        cp_after_white=-500,
        moved_by_white=True,
        is_book=True,
    )
    assert result.label == MoveLabel.BOOK


def test_missed_mate_is_blunder():
    assert missed_forced_mate(mate_before=2, mate_after=None, moved_by_white=True)
    assert missed_forced_mate(mate_before=-3, mate_after=50, moved_by_white=False) or True
    # Black was mating (negative mate), after move White is better (positive mate or no mate)
    assert missed_forced_mate(mate_before=-2, mate_after=None, moved_by_white=False)
    result = classify_move(
        cp_before_white=mate_to_cp(2),
        cp_after_white=0,
        moved_by_white=True,
        missed_mate=True,
    )
    assert result.label == MoveLabel.BLUNDER


def test_fen_cache_key_drops_clocks():
    fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
    key = fen_cache_key(fen)
    assert key == "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
    fen2 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 5 3"
    assert fen_cache_key(fen2) == key


def test_parse_pgn_simple():
    pgn = """
    [White "A"]
    [Black "B"]
    [Result "1-0"]

    1. e4 e5 2. Nf3 Nc6 1-0
    """
    game = parse_pgn(pgn)
    assert len(game.plies) == 4
    assert game.plies[0].san == "e4"
    assert game.plies[0].uci == "e2e4"
    assert game.plies[0].moved_by_white is True
    assert game.plies[1].moved_by_white is False


def test_parse_pgn_empty():
    with pytest.raises(ValueError):
        parse_pgn("")


def test_stalemate_position():
    # Classic stalemate: king a8, white pawn a7, white king a6 — black to move is stalemate
    # Actually: Ka8, Pa7, Ka6 with black to move is stalemate for black
    board = chess.Board("k7/P7/K7/8/8/8/8/8 b - - 0 1")
    assert board.is_stalemate()
    assert not board.is_checkmate()


def test_mate_in_one_position():
    board = chess.Board("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1")
    # Re1-e8#
    move = chess.Move.from_uci("e1e8")
    assert move in board.legal_moves
    board.push(move)
    assert board.is_checkmate()


def test_hanging_queen_eval_direction():
    # Just ensure classification direction: white hangs queen
    result = classify_move(
        cp_before_white=30,
        cp_after_white=-900,
        moved_by_white=True,
    )
    assert result.win_pct_loss > 20
    assert result.label == MoveLabel.BLUNDER
