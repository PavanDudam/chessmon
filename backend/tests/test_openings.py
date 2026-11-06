"""Book means the move is still in the opening file, not that it was early."""

from __future__ import annotations

from app.chess.openings import OpeningBook, book_flags
from app.chess.pgn import parse_pgn

SAMPLE = """
[Result "0-1"]

1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe6+ 4. Qe2 Qg6 5. Nf3 Nc6 6. Qb5 a6 7. Qc4 b5 8. Qe4 Qxe4+ 9. Nxe4 Bf5 10. Bd3 O-O-O 11. Nc5 e6 0-1
"""


def test_trie_stops_when_the_move_leaves_the_line():
    book = OpeningBook()
    book.add(["e2e4", "d7d5", "e4d5", "d8d5", "b1c3"])
    flags = book.flags(["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5e6"])
    assert flags == [True, True, True, True, True, False]


def test_sample_game_book_ends_before_qe6():
    game = parse_pgn(SAMPLE)
    flags = book_flags([ply.uci for ply in game.plies])
    sans = [ply.san for ply in game.plies]
    by_san = dict(zip(sans, flags))
    assert by_san["e4"] is True
    assert by_san["d5"] is True
    assert by_san["exd5"] is True
    assert by_san["Qxd5"] is True
    assert by_san["Nc3"] is True
    assert by_san["Qe6+"] is False
    assert by_san["Nf3"] is False
    assert by_san["b5"] is False
    assert not any(flags[sans.index("Qe6+") :])
