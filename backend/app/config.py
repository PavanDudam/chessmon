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
AUDIO_DIR = Path(os.environ.get("AUDIO_DIR", str(BASE_DIR / "data" / "audio")))
_PIPER_DIR = BASE_DIR / "bin" / "piper"
_DEFAULT_PIPER_BIN = _PIPER_DIR / "piper"
_DEFAULT_PIPER_MODEL = _PIPER_DIR / "en_US-lessac-medium.onnx"
PIPER_BIN = os.environ.get("PIPER_BIN", str(_DEFAULT_PIPER_BIN))
PIPER_MODEL = os.environ.get("PIPER_MODEL", "en_US-lessac-medium")
PIPER_MODEL_PATH = os.environ.get(
    "PIPER_MODEL_PATH",
    str(_DEFAULT_PIPER_MODEL) if _DEFAULT_PIPER_MODEL.is_file() else "",
)
PIPER_TIMEOUT_S = int(os.environ.get("PIPER_TIMEOUT_S", "30"))
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if o.strip()
]
