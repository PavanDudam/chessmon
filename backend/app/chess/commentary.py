"""Template comments for a finished review. No engine, no network."""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Any, Dict, List, Optional

import chess

PRIORITY = [
    "mate",
    "hangs_piece",
    "promo",
    "castle",
    "check",
    "capture",
    "develops",
    "default",
]

# One short kind sentence. Only slots the detector actually filled.
LINES: Dict[str, Dict[str, List[str]]] = {
    "Best": {
        "mate": [
            "{san} is checkmate. A clean finish.",
            "That is the end of the game. {san} is mate.",
            "{san} finishes the game. Checkmate.",
        ],
        "check": [
            "{san} gives check, and it matches the engine.",
            "Check from {san}. That is the strongest move here.",
            "{san} comes with check. Exactly the move to play.",
        ],
        "capture": [
            "{san} takes the {captured}, and the engine agrees.",
            "Winning the {captured} with {san} is the best choice.",
            "{san} picks up the {captured}. Right on target.",
        ],
        "castle": [
            "{san} tucks the king away. That is the best move.",
            "Castling with {san} is exactly what the position wants.",
            "{san} gets the king safe, and it is the top move.",
        ],
        "promo": [
            "{san} promotes, and it is the best move on the board.",
            "Promoting with {san} is the strongest choice.",
            "{san} reaches the last rank. Best move.",
        ],
        "develops": [
            "{san} brings the {piece} out. Nicely found.",
            "Developing with {san} is the best move here.",
            "{san} gets the {piece} into the game. Spot on.",
        ],
        "default": [
            "{san} is the best move here. Well spotted.",
            "The engine wanted {san}, and that is what you played.",
            "{san} is the strongest move in this position.",
        ],
    },
    "Excellent": {
        "mate": [
            "{san} is checkmate. Very strong.",
            "Very strong finish. {san} is mate.",
            "{san} ends the game. A very strong move.",
        ],
        "check": [
            "{san} gives check. Very strong.",
            "Check with {san}. A very strong choice.",
            "{san} checks the king. Very well played.",
        ],
        "capture": [
            "{san} wins the {captured}. Very strong.",
            "Taking the {captured} with {san} is very strong.",
            "{san} collects the {captured}. A very strong move.",
        ],
        "castle": [
            "{san} castles the king to safety. Very strong.",
            "Castling with {san} is a very strong choice.",
            "{san} gets the king out. Very well played.",
        ],
        "promo": [
            "{san} promotes. A very strong move.",
            "Promoting with {san} is very strong.",
            "{san} reaches the last rank. Very well played.",
        ],
        "develops": [
            "{san} develops the {piece}. Very strong.",
            "Bringing the {piece} out with {san} is very strong.",
            "{san} gets the {piece} working. Very well played.",
        ],
        "default": [
            "{san} is a very strong move.",
            "Very strong. {san} keeps the position healthy.",
            "{san} is an excellent practical choice.",
        ],
    },
    "Good": {
        "check": [
            "{san} gives check. A solid move.",
            "Check with {san}. That keeps the pressure on.",
            "{san} checks the king. A good practical move.",
        ],
        "capture": [
            "{san} takes the {captured}. A good move.",
            "Picking up the {captured} with {san} is sensible.",
            "{san} wins the {captured}. Solid play.",
        ],
        "castle": [
            "{san} castles. A good moment to get the king safe.",
            "Castling with {san} is a solid choice.",
            "{san} steps the king away from the center. Good.",
        ],
        "develops": [
            "{san} develops the {piece}. A good idea.",
            "Getting the {piece} out with {san} is sensible.",
            "{san} brings the {piece} into play. Good.",
        ],
        "default": [
            "{san} is a good move.",
            "Solid. {san} keeps things under control.",
            "{san} is a sensible choice here.",
        ],
    },
    "Inaccuracy": {
        "hangs_piece": [
            "Your {piece} on {to} can be taken. {best} was steadier.",
            "The {piece} on {to} is loose now. {best} was the calmer move.",
            "Careful: the {piece} on {to} is unprotected. {best} was safer.",
        ],
        "default": [
            "{san} slips a little. {best} was steadier.",
            "A small slip with {san}. {best} keeps more.",
            "{san} is a bit loose. {best} was the tighter move.",
            "{san} gives a little away.",
        ],
    },
    "Mistake": {
        "hangs_piece": [
            "Your {piece} on {to} is unprotected. {best} was better.",
            "The {piece} on {to} can be taken for nothing. {best} avoids that.",
            "That leaves the {piece} on {to} loose. {best} was stronger.",
        ],
        "default": [
            "{san} gives away too much. {best} was better.",
            "That {san} is a real slip. {best} holds more.",
            "{san} makes the position worse. {best} was the better try.",
            "{san} gives away too much.",
        ],
    },
    "Blunder": {
        "hangs_piece": [
            "Your {piece} on {to} can be taken for nothing. {best} was the move.",
            "The {piece} on {to} is hanging. {best} was much safer.",
            "That leaves your {piece} on {to} undefended. {best} was the move to find.",
        ],
        "default": [
            "{san} gives up a lot. {best} was much better.",
            "That {san} is a serious slip. {best} keeps the position.",
            "{san} hurts the position badly. {best} was the stronger move.",
            "{san} gives up a lot.",
        ],
    },
    "Book": {
        "default": [
            "{san} is a book move. Theory still likes it.",
            "Opening theory. {san} is a known try.",
            "{san} is still in the books.",
        ],
    },
}

STALEMATE_LINES = [
    "No legal move remains, so the game is drawn by stalemate.",
    "The king is not in check and has nowhere to go. Stalemate.",
    "That ends the game as a draw. Stalemate.",
]


def _empty(tags: Optional[List[str]] = None) -> Dict[str, Any]:
    return {"text": "", "tags": list(tags or []), "comment_id": ""}


def move_facts(board: chess.Board, move: chess.Move, best_uci: Optional[str]) -> Dict[str, Any]:
    """Slots and tags for one move. Restores the board before returning."""
    mover = board.turn
    piece = board.piece_at(move.from_square)
    if piece is None:
        return {"san": "", "piece": "", "to": "", "captured": "", "best": "", "tags": []}

    facts: Dict[str, Any] = {
        "san": board.san(move),
        "piece": chess.piece_name(piece.piece_type),
        "to": chess.square_name(move.to_square),
        "captured": "",
        "best": _best_san(board, best_uci),
        "tags": [],
    }
    tags: List[str] = facts["tags"]

    if board.is_capture(move):
        if board.is_en_passant(move):
            facts["captured"] = "pawn"
        else:
            captured = board.piece_at(move.to_square)
            facts["captured"] = chess.piece_name(captured.piece_type) if captured else "piece"
        tags.append("capture")
    if board.is_castling(move):
        tags.append("castle")
    if move.promotion:
        tags.append("promo")
    if board.gives_check(move):
        tags.append("check")

    back_rank = 0 if mover == chess.WHITE else 7
    if (
        board.fullmove_number <= 10
        and piece.piece_type in (chess.KNIGHT, chess.BISHOP)
        and chess.square_rank(move.from_square) == back_rank
    ):
        tags.append("develops")

    board.push(move)
    try:
        if board.is_checkmate():
            tags.append("mate")
        if board.is_stalemate():
            tags.append("stalemate")
        if (
            piece.piece_type != chess.PAWN
            and board.is_attacked_by(board.turn, move.to_square)
            and not board.is_attacked_by(mover, move.to_square)
        ):
            tags.append("hangs_piece")
    finally:
        board.pop()
    return facts


def _best_san(board: chess.Board, best_uci: Optional[str]) -> str:
    if not best_uci:
        return ""
    try:
        best = chess.Move.from_uci(best_uci)
    except ValueError:
        return ""
    if best not in board.legal_moves:
        return ""
    return board.san(best)


def comment_for(grade: str, facts: Dict[str, Any], game_id: str, ply: int) -> Dict[str, Any]:
    """Pick one line. The same game id and ply always pick the same line."""
    tags = list(facts.get("tags") or [])
    if "stalemate" in tags:
        grade_key = "Stalemate"
        tag = "stalemate"
        lines = STALEMATE_LINES
    else:
        pool = LINES.get(grade, {})
        tag = ""
        lines = []
        for candidate in PRIORITY:
            if (candidate in tags or candidate == "default") and candidate in pool:
                tag = candidate
                lines = pool[candidate]
                break
        grade_key = grade
        if not lines:
            return _empty(tags)

    usable = [line for line in lines if "{best}" not in line or facts.get("best")]
    if not usable:
        usable = list(lines)
    index_in_usable = random.Random(f"{game_id}:{ply}").randrange(len(usable))
    chosen = usable[index_in_usable]
    original_index = lines.index(chosen)
    text = chosen.format_map(defaultdict(str, facts))
    return {
        "text": text,
        "tags": tags,
        "comment_id": f"{grade_key}:{tag}:{original_index}",
    }


def comment_for_move(
    fen_before: str,
    uci: str,
    grade: str,
    best_uci: Optional[str],
    game_id: str,
    ply: int,
) -> Dict[str, Any]:
    """Safe entry point for the analyzer and for old reviews. Never raises."""
    try:
        board = chess.Board(fen_before)
        move = chess.Move.from_uci(uci)
    except ValueError:
        return _empty()
    if move not in board.legal_moves:
        return _empty()
    facts = move_facts(board, move, best_uci)
    return comment_for(grade, facts, game_id, ply)


def ensure_comments(review: Dict[str, Any], game_id: str) -> bool:
    """Fill comments on a completed review that was stored before this feature.

    Returns True when the review dict was changed. Empty text is stored too,
    so a later read does not try again.
    """
    if review.get("status") != "completed":
        return False
    changed = False
    for move in review.get("moves") or []:
        if "comment" in move and move.get("comment") is not None:
            continue
        result = comment_for_move(
            move.get("fen_before") or "",
            move.get("uci") or "",
            move.get("label") or "",
            move.get("best_move_uci"),
            game_id,
            int(move.get("ply") or 0),
        )
        move["comment"] = result["text"]
        move["tags"] = result["tags"]
        move["comment_id"] = result["comment_id"]
        changed = True
    return changed
