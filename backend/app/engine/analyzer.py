"""Full-game analysis orchestration."""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

import chess

from app.chess.accuracy import split_by_side
from app.chess.commentary import comment_for_move
from app.chess.classifier import (
    Classification,
    MoveLabel,
    classify_move,
    cp_to_win_percent,
    missed_forced_mate,
    score_to_cp_white,
)
from app.chess.openings import book_flags
from app.chess.pgn import ParsedGame, fen_cache_key, game_title, parse_pgn
from app.chess.terminal import score_terminal_fen, terminal_cp_white
from app.db.cache import Database
from app.engine.stockfish import AnalysisSettings, EnginePool, EngineScore
from app.voice.piper import schedule_review_audio

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[Dict[str, Any]], Awaitable[None]]


def _pv_to_san(fen: str, pv_uci: List[str]) -> List[str]:
    board = chess.Board(fen)
    sans: List[str] = []
    for uci in pv_uci:
        try:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                break
            sans.append(board.san(move))
            board.push(move)
        except ValueError:
            break
    return sans


def _best_move_san(fen: str, best_uci: Optional[str]) -> Optional[str]:
    if not best_uci:
        return None
    board = chess.Board(fen)
    try:
        move = chess.Move.from_uci(best_uci)
        if move in board.legal_moves:
            return board.san(move)
    except ValueError:
        return None
    return None


async def analyze_position(
    pool: EnginePool,
    database: Database,
    fen: str,
    settings: AnalysisSettings,
) -> EngineScore:
    terminal = score_terminal_fen(fen)
    if terminal is not None:
        return terminal

    key = fen_cache_key(fen)
    token = settings.cache_token()
    cached = database.get_cached_score(key, token)
    if cached is not None:
        return cached
    score = await pool.analyze(fen, settings)
    database.put_cached_score(key, token, score)
    return score


async def analyze_game(
    *,
    job_id: str,
    pgn: str,
    pool: EnginePool,
    database: Database,
    settings: AnalysisSettings,
    on_event: Optional[ProgressCallback] = None,
) -> Dict[str, Any]:
    parsed: ParsedGame = parse_pgn(pgn)
    title = game_title(parsed.headers)
    settings_dict = {
        "movetime_ms": settings.movetime_ms,
        "depth": settings.depth,
        "cache_token": settings.cache_token(),
    }

    total = len(parsed.plies)
    review: Dict[str, Any] = {
        "id": job_id,
        "status": "analyzing",
        "title": title,
        "pgn": parsed.pgn,
        "headers": parsed.headers,
        "starting_fen": parsed.starting_fen,
        "moves": [],
        "white": None,
        "black": None,
        "settings": settings_dict,
        "progress": {"current": 0, "total": total},
        "error": None,
    }
    database.upsert_review(
        review_id=job_id,
        title=title,
        pgn=parsed.pgn,
        headers=parsed.headers,
        starting_fen=parsed.starting_fen,
        status="analyzing",
        settings=settings_dict,
        review=review,
    )

    async def emit(event_type: str, data: Dict[str, Any]) -> None:
        if on_event:
            await on_event({"type": event_type, **data})

    await emit("progress", {"current": 0, "total": total})

    labels: List[MoveLabel] = []
    losses: List[float] = []
    sides: List[bool] = []

    # Eval of the starting position (before any moves)
    prev_score = await analyze_position(pool, database, parsed.starting_fen, settings)
    theory = book_flags([ply.uci for ply in parsed.plies])

    try:
        for index, ply in enumerate(parsed.plies):
            # Never ask Stockfish for terminal FENs (no legal moves → garbage / crashes).
            terminal_after = score_terminal_fen(ply.fen_after)
            if terminal_after is not None:
                score_after = terminal_after
            else:
                score_after = await analyze_position(
                    pool, database, ply.fen_after, settings
                )

            cp_before = score_to_cp_white(prev_score.cp, prev_score.mate)
            cp_after = (
                terminal_cp_white(score_after)
                if terminal_after is not None
                else score_to_cp_white(score_after.cp, score_after.mate)
            )
            missed = missed_forced_mate(
                prev_score.mate, score_after.mate, ply.moved_by_white
            )

            # Best move is from the position BEFORE the played move.
            best_uci = prev_score.best_move_uci
            if ply.is_checkmate:
                # Delivering mate is always Best; store the synthetic terminal eval.
                wp_after = cp_to_win_percent(cp_after)
                classification = Classification(
                    label=MoveLabel.BEST,
                    win_pct_before=cp_to_win_percent(cp_before),
                    win_pct_after=wp_after,
                    win_pct_loss=0.0,
                    cp_before=cp_before,
                    cp_after=cp_after,
                )
            else:
                classification = classify_move(
                    cp_before_white=cp_before,
                    cp_after_white=cp_after,
                    moved_by_white=ply.moved_by_white,
                    is_book=theory[index],
                    missed_mate=missed,
                    is_engine_best=(ply.uci == best_uci) if best_uci else None,
                )

            # PV is from the position BEFORE the played move
            pv_uci = prev_score.pv_uci or []
            move_data = {
                "ply": ply.ply,
                "move_number": ply.move_number,
                "san": ply.san,
                "uci": ply.uci,
                "fen_before": ply.fen_before,
                "fen_after": ply.fen_after,
                "moved_by_white": ply.moved_by_white,
                "label": classification.label.value,
                "cp_before": round(cp_before, 1),
                "cp_after": round(cp_after, 1),
                "mate_before": prev_score.mate,
                "mate_after": score_after.mate,
                "win_pct_before": round(classification.win_pct_before, 2),
                "win_pct_after": round(classification.win_pct_after, 2),
                "win_pct_loss": round(classification.win_pct_loss, 2),
                "best_move_uci": best_uci,
                "best_move_san": _best_move_san(ply.fen_before, best_uci),
                "pv_uci": pv_uci,
                "pv_san": _pv_to_san(ply.fen_before, pv_uci),
                "is_check": ply.is_check,
                "is_checkmate": ply.is_checkmate,
                "is_stalemate": ply.is_stalemate,
            }
            spoken = comment_for_move(
                ply.fen_before,
                ply.uci,
                classification.label.value,
                best_uci,
                job_id,
                ply.ply,
            )
            move_data["comment"] = spoken["text"]
            move_data["tags"] = spoken["tags"]
            move_data["comment_id"] = spoken["comment_id"]

            review["moves"].append(move_data)
            labels.append(classification.label)
            losses.append(classification.win_pct_loss)
            sides.append(ply.moved_by_white)

            review["progress"] = {"current": ply.ply, "total": total}
            database.upsert_review(
                review_id=job_id,
                title=title,
                pgn=parsed.pgn,
                headers=parsed.headers,
                starting_fen=parsed.starting_fen,
                status="analyzing",
                settings=settings_dict,
                review=review,
            )

            await emit(
                "progress",
                {"current": ply.ply, "total": total},
            )
            await emit("move_result", {"move": move_data})

            prev_score = score_after

        stats = split_by_side(labels, losses, sides)
        review["white"] = stats["white"]
        review["black"] = stats["black"]
        review["status"] = "completed"
        review["progress"] = {"current": total, "total": total}

        database.upsert_review(
            review_id=job_id,
            title=title,
            pgn=parsed.pgn,
            headers=parsed.headers,
            starting_fen=parsed.starting_fen,
            status="completed",
            settings=settings_dict,
            review=review,
            white_accuracy=stats["white"]["accuracy"],
            black_accuracy=stats["black"]["accuracy"],
        )
        await emit("done", {"review": review})
        schedule_review_audio(review)
        return review

    except Exception as exc:
        logger.exception("Analysis failed for %s", job_id)
        review["status"] = "error"
        review["error"] = str(exc)
        database.upsert_review(
            review_id=job_id,
            title=title,
            pgn=parsed.pgn,
            headers=parsed.headers,
            starting_fen=parsed.starting_fen,
            status="error",
            settings=settings_dict,
            review=review,
            error=str(exc),
        )
        await emit("error", {"message": str(exc)})
        raise
