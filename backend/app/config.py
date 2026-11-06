"""Application configuration via environment variables."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_STOCKFISH = BASE_DIR / "bin" / "stockfish"

STOCKFISH_PATH = os.environ.get("STOCKFISH_PATH", str(DEFAULT_STOCKFISH))
ENGINE_POOL_SIZE = int(os.environ.get("ENGINE_POOL_SIZE", "2"))
ENGINE_HASH_MB = int(os.environ.get("ENGINE_HASH_MB", "128"))
DEFAULT_MOVETIME_MS = int(os.environ.get("DEFAULT_MOVETIME_MS", "500"))
DATABASE_PATH = os.environ.get(
    "DATABASE_PATH", str(BASE_DIR / "data" / "chessmon.db")
)
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]
