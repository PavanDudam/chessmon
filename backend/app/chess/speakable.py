"""Turn written chess notation into words a voice can say.

The speech bubble keeps the original SAN. Only the audio path uses this.
"""

from __future__ import annotations

import re

_PIECE = {
    "K": "king",
    "Q": "queen",
    "R": "rook",
    "B": "bishop",
    "N": "knight",
}

# O-O-O before O-O. Piece moves, captures, then promotions.
_TOKEN = re.compile(
    r"O-O-O|0-0-0|O-O|0-0|"
    r"[KQRBN](?:[a-h][1-8]|[a-h]|[1-8])?x?[a-h][1-8](?:=[QRBN])?[+#]?|"
    r"[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|"
    r"[a-h][1-8]=[QRBN][+#]?"
)


def speakable(text: str) -> str:
    """Replace SAN tokens in a comment. Plain squares such as h4 stay as written."""
    return _TOKEN.sub(lambda match: _speak_token(match.group(0)), text)


def _speak_token(token: str) -> str:
    suffix = ""
    if token.endswith("#"):
        suffix = ", checkmate"
        token = token[:-1]
    elif token.endswith("+"):
        suffix = ", check"
        token = token[:-1]

    if token in {"O-O", "0-0"}:
        return "castles short" + suffix
    if token in {"O-O-O", "0-0-0"}:
        return "castles long" + suffix

    if "=" in token:
        head, promo = token.split("=", 1)
        dest = head[-2:]
        return f"{dest}, promotes to {_PIECE.get(promo, promo.lower())}{suffix}"

    if "x" in token:
        left, right = token.split("x", 1)
        actor = _PIECE[left[0]] if left[:1] in _PIECE else left[:1]
        return f"{actor} takes {right}{suffix}"

    if token[:1] in _PIECE:
        return f"{_PIECE[token[0]]} {token[1:]}{suffix}"
    return token + suffix
