"""PGN parsing into analyzable plies."""

from __future__ import annotations

from dataclasses import dataclass
from io import StringIO
from typing import List, Optional

import chess
import chess.pgn


@dataclass
class PlyInfo:
    ply: int
    move_number: int
    san: str
    uci: str
    fen_before: str
    fen_after: str
    moved_by_white: bool
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool


@dataclass
class ParsedGame:
    pgn: str
    headers: dict
    plies: List[PlyInfo]
    starting_fen: str


def fen_cache_key(fen: str) -> str:
    """First four FEN fields (piece placement, side, castling, en passant)."""
    parts = fen.split()
    if len(parts) < 4:
        return fen
    return " ".join(parts[:4])


def parse_pgn(pgn_text: str) -> ParsedGame:
    raw = (pgn_text or "").strip()
    if not raw:
        raise ValueError("PGN is empty")

    # Normalize indented pastes (common when copying from docs/editors)
    lines = [line.strip() for line in raw.splitlines()]
    text = "\n".join(lines)

    game = chess.pgn.read_game(StringIO(text))
    if game is None:
        raise ValueError("Could not parse PGN")

    board = game.board()
    starting_fen = board.fen()
    plies: List[PlyInfo] = []
    ply_index = 0

    for move in game.mainline_moves():
        if move not in board.legal_moves:
            raise ValueError(f"Illegal move in PGN at ply {ply_index + 1}: {move}")

        fen_before = board.fen()
        moved_by_white = board.turn == chess.WHITE
        san = board.san(move)
        board.push(move)
        fen_after = board.fen()
        ply_index += 1

        # move_number is the full-move number for the move that was just played
        fullmove = board.fullmove_number if not moved_by_white else board.fullmove_number
        # After White moves, fullmove_number hasn't incremented yet in python-chess?
        # Actually: fullmove_number increments after Black moves.
        # Before White's first move fullmove=1; after White push still 1; after Black push becomes 2.
        if moved_by_white:
            move_number = board.fullmove_number
        else:
            move_number = board.fullmove_number - 1 if board.fullmove_number > 1 else 1

        plies.append(
            PlyInfo(
                ply=ply_index,
                move_number=move_number,
                san=san,
                uci=move.uci(),
                fen_before=fen_before,
                fen_after=fen_after,
                moved_by_white=moved_by_white,
                is_check=board.is_check(),
                is_checkmate=board.is_checkmate(),
                is_stalemate=board.is_stalemate(),
            )
        )

    headers = {k: game.headers[k] for k in game.headers.keys()}
    return ParsedGame(
        pgn=text,
        headers=headers,
        plies=plies,
        starting_fen=starting_fen,
    )


def game_title(headers: dict) -> str:
    white = headers.get("White", "White")
    black = headers.get("Black", "Black")
    result = headers.get("Result", "*")
    return f"{white} vs {black} ({result})"
