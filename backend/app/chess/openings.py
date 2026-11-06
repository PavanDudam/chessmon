"""Opening-theory book.

Lines come from lichess-org/chess-openings (CC0). A move is Book only while
the played sequence is still a prefix of one of those lines.
"""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import chess

_DATA_DIR = Path(__file__).resolve().parent / "data" / "openings"


class OpeningBook:
    def __init__(self) -> None:
        self.root: Dict[str, dict] = {}

    def add(self, uci_moves: List[str]) -> None:
        node = self.root
        for uci in uci_moves:
            node = node.setdefault(uci, {})

    def flags(self, uci_moves: List[str]) -> List[bool]:
        """True for each move that is still inside a known opening line."""
        flags: List[bool] = []
        node = self.root
        in_book = True
        for uci in uci_moves:
            child = node.get(uci) if in_book else None
            if child is None:
                in_book = False
                flags.append(False)
            else:
                node = child
                flags.append(True)
        return flags


def _line_to_uci(pgn_moves: str) -> List[str]:
    board = chess.Board()
    ucis: List[str] = []
    for token in pgn_moves.split():
        if token[:1].isdigit() or token in {"*", "1-0", "0-1", "1/2-1/2"}:
            continue
        try:
            move = board.parse_san(token)
        except ValueError:
            break
        ucis.append(move.uci())
        board.push(move)
    return ucis


def load_opening_book(directory: Optional[Path] = None) -> OpeningBook:
    directory = directory or _DATA_DIR
    paths = sorted(directory.glob("*.tsv"))
    if not paths:
        raise FileNotFoundError(f"No opening files in {directory}")
    book = OpeningBook()
    for path in paths:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle, delimiter="\t")
            for row in reader:
                pgn = (row.get("pgn") or "").strip()
                if pgn:
                    book.add(_line_to_uci(pgn))
    return book


@lru_cache(maxsize=1)
def get_opening_book() -> OpeningBook:
    return load_opening_book()


def book_flags(uci_moves: List[str]) -> List[bool]:
    return get_opening_book().flags(uci_moves)
