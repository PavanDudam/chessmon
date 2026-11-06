"""Cache Piper clips by voice name and spoken text.

Synthesis runs off the request path. If Piper is missing or a line fails,
callers get None and the review stays text-only.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from app import config
from app.chess.speakable import speakable
from app.db.cache import db

logger = logging.getLogger(__name__)

_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()
_warned = False


def _key_lock(key: str) -> threading.Lock:
    with _locks_guard:
        lock = _locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _locks[key] = lock
        return lock


def _warn_once(message: str) -> None:
    global _warned
    if _warned:
        return
    _warned = True
    logger.warning(message)


def audio_for(text: str) -> Optional[str]:
    """Return /audio/<hash>.wav, generating the file once. None if Piper cannot run."""
    spoken = speakable(text).strip()
    if not spoken:
        return None

    model_name = config.PIPER_MODEL
    key = hashlib.sha1(f"{model_name}|{spoken}".encode()).hexdigest()[:16]
    path = config.AUDIO_DIR / f"{key}.wav"
    with _key_lock(key):
        if path.is_file() and path.stat().st_size > 0:
            return f"/audio/{key}.wav"

        binary = config.PIPER_BIN
        if shutil.which(binary) is None and not Path(binary).is_file():
            _warn_once(f"Piper binary not found ({binary}); coach voice stays off")
            return None

        model_arg = config.PIPER_MODEL_PATH or model_name
        config.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        try:
            subprocess.run(
                [binary, "--model", model_arg, "--output_file", str(tmp)],
                input=spoken.encode(),
                check=True,
                timeout=config.PIPER_TIMEOUT_S,
            )
            if not tmp.is_file() or tmp.stat().st_size == 0:
                tmp.unlink(missing_ok=True)
                _warn_once("Piper wrote an empty file; coach voice stays off")
                return None
            tmp.replace(path)
        except (OSError, subprocess.SubprocessError) as exc:
            tmp.unlink(missing_ok=True)
            _warn_once(f"Piper synthesis failed; coach voice stays off ({exc})")
            return None
    return f"/audio/{key}.wav"


def schedule_review_audio(review: Dict[str, Any]) -> None:
    """Fill audio_url after the review is already visible. Never raises."""
    if review.get("status") != "completed":
        return
    moves = review.get("moves") or []
    if not any((m.get("comment") or "").strip() and not m.get("audio_url") for m in moves):
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(_fill(review))


async def _fill(review: Dict[str, Any]) -> None:
    try:
        # Piper runs off the event loop. The database write stays on the loop:
        # the shared SQLite connection is not safe to use from a worker thread.
        pending = [
            (move.get("ply"), move["comment"])
            for move in review.get("moves") or []
            if (move.get("comment") or "").strip() and not move.get("audio_url")
        ]
        urls = await asyncio.to_thread(_synthesize, pending)
        if not urls:
            return
        by_ply = dict(urls)
        changed = False
        for move in review.get("moves") or []:
            url = by_ply.get(move.get("ply"))
            if not url or move.get("audio_url"):
                continue
            move["audio_url"] = url
            changed = True
        if changed:
            _save_review(review)
    except Exception:
        logger.exception("Coach voice fill failed")


def _synthesize(pending: list) -> list:
    found = []
    for ply, text in pending:
        url = audio_for(text)
        if url:
            found.append((ply, url))
    return found


def _save_review(review: Dict[str, Any]) -> None:
    white = review.get("white") or {}
    black = review.get("black") or {}
    db.upsert_review(
        review_id=str(review.get("id") or ""),
        title=review.get("title") or "Review",
        pgn=review.get("pgn") or "",
        headers=review.get("headers") or {},
        starting_fen=review.get("starting_fen") or "",
        status=review.get("status") or "completed",
        settings=review.get("settings") or {},
        review=review,
        white_accuracy=white.get("accuracy") if isinstance(white, dict) else None,
        black_accuracy=black.get("accuracy") if isinstance(black, dict) else None,
        error=review.get("error"),
    )
