"""SQLite schema initialization."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS position_cache (
    fen_key TEXT NOT NULL,
    settings_key TEXT NOT NULL,
    cp INTEGER,
    mate INTEGER,
    best_move_uci TEXT,
    pv_uci TEXT,
    depth INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (fen_key, settings_key)
);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    pgn TEXT NOT NULL,
    headers_json TEXT NOT NULL,
    starting_fen TEXT NOT NULL,
    status TEXT NOT NULL,
    review_json TEXT,
    white_accuracy REAL,
    black_accuracy REAL,
    settings_json TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);
"""


def get_connection(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or config.DATABASE_PATH
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db(db_path: str | None = None) -> None:
    conn = get_connection(db_path)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
