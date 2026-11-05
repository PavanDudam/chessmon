"""Position cache and saved review persistence."""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional

from app.db.schema import get_connection
from app.engine.stockfish import EngineScore


class Database:
    def __init__(self, db_path: Optional[str] = None) -> None:
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None

    def connect(self) -> None:
        self._conn = get_connection(self.db_path)

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self.connect()
        assert self._conn is not None
        return self._conn

    # --- position cache ---

    def get_cached_score(self, fen_key: str, settings_key: str) -> Optional[EngineScore]:
        row = self.conn.execute(
            """
            SELECT cp, mate, best_move_uci, pv_uci, depth
            FROM position_cache
            WHERE fen_key = ? AND settings_key = ?
            """,
            (fen_key, settings_key),
        ).fetchone()
        if not row:
            return None
        pv = json.loads(row["pv_uci"]) if row["pv_uci"] else []
        return EngineScore(
            cp=row["cp"],
            mate=row["mate"],
            best_move_uci=row["best_move_uci"],
            pv_uci=pv,
            depth=row["depth"],
        )

    def put_cached_score(self, fen_key: str, settings_key: str, score: EngineScore) -> None:
        self.conn.execute(
            """
            INSERT INTO position_cache (fen_key, settings_key, cp, mate, best_move_uci, pv_uci, depth)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(fen_key, settings_key) DO UPDATE SET
                cp=excluded.cp,
                mate=excluded.mate,
                best_move_uci=excluded.best_move_uci,
                pv_uci=excluded.pv_uci,
                depth=excluded.depth,
                created_at=datetime('now')
            """,
            (
                fen_key,
                settings_key,
                score.cp,
                score.mate,
                score.best_move_uci,
                json.dumps(score.pv_uci or []),
                score.depth,
            ),
        )
        self.conn.commit()

    # --- reviews ---

    def upsert_review(
        self,
        *,
        review_id: str,
        title: str,
        pgn: str,
        headers: Dict[str, str],
        starting_fen: str,
        status: str,
        settings: Dict[str, Any],
        review: Optional[Dict[str, Any]] = None,
        white_accuracy: Optional[float] = None,
        black_accuracy: Optional[float] = None,
        error: Optional[str] = None,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO reviews (
                id, title, pgn, headers_json, starting_fen, status,
                review_json, white_accuracy, black_accuracy, settings_json, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                status=excluded.status,
                review_json=excluded.review_json,
                white_accuracy=excluded.white_accuracy,
                black_accuracy=excluded.black_accuracy,
                settings_json=excluded.settings_json,
                error=excluded.error,
                updated_at=datetime('now')
            """,
            (
                review_id,
                title,
                pgn,
                json.dumps(headers),
                starting_fen,
                status,
                json.dumps(review) if review is not None else None,
                white_accuracy,
                black_accuracy,
                json.dumps(settings),
                error,
            ),
        )
        self.conn.commit()

    def get_review(self, review_id: str) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            "SELECT * FROM reviews WHERE id = ?", (review_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_review(row)

    def list_reviews(self, limit: int = 50) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, title, status, white_accuracy, black_accuracy, created_at
            FROM reviews
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "status": r["status"],
                "white_accuracy": r["white_accuracy"],
                "black_accuracy": r["black_accuracy"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    def _row_to_review(self, row: sqlite3.Row) -> Dict[str, Any]:
        review_json = json.loads(row["review_json"]) if row["review_json"] else None
        if review_json:
            return review_json
        return {
            "id": row["id"],
            "status": row["status"],
            "title": row["title"],
            "pgn": row["pgn"],
            "headers": json.loads(row["headers_json"]),
            "starting_fen": row["starting_fen"],
            "moves": [],
            "white": None,
            "black": None,
            "settings": json.loads(row["settings_json"]),
            "progress": {},
            "error": row["error"],
        }


db = Database()
