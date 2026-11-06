"""Spoken chess notation.

Behaviour: SAN tokens become words. Module: speakable() in app.chess.speakable.
No existing test file covers it. test_commentary.py covers written comments only.
"""

from app.chess.speakable import speakable


def test_check_capture_castle_promo_and_mate():
    assert speakable("Qb8+") == "queen b8, check"
    assert speakable("Rd8#") == "rook d8, checkmate"
    assert speakable("O-O") == "castles short"
    assert speakable("O-O-O") == "castles long"
    assert speakable("exd6") == "e takes d6"
    assert speakable("a8=Q") == "a8, promotes to queen"


def test_sentence_keeps_surrounding_words():
    assert speakable("Qb8+ gives check.") == "queen b8, check gives check."
    assert speakable("Your queen on h4 can be taken.") == "Your queen on h4 can be taken."
