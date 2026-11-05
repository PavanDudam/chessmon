"""Stockfish UCI wrapper and process pool."""

from __future__ import annotations

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List, Optional

import chess
import chess.engine

from app import config

logger = logging.getLogger(__name__)


@dataclass
class EngineScore:
    """Evaluation always from White's point of view."""

    cp: Optional[int] = None
    mate: Optional[int] = None
    best_move_uci: Optional[str] = None
    pv_uci: List[str] | None = None
    depth: Optional[int] = None

    def to_cp_float(self) -> float:
        from app.chess.classifier import score_to_cp_white

        return score_to_cp_white(self.cp, self.mate)


@dataclass
class AnalysisSettings:
    movetime_ms: Optional[int] = None
    depth: Optional[int] = None

    def cache_token(self) -> str:
        if self.depth is not None:
            return f"depth:{self.depth}"
        ms = self.movetime_ms if self.movetime_ms is not None else config.DEFAULT_MOVETIME_MS
        return f"movetime:{ms}"

    def limit(self) -> chess.engine.Limit:
        if self.depth is not None:
            return chess.engine.Limit(depth=self.depth)
        ms = self.movetime_ms if self.movetime_ms is not None else config.DEFAULT_MOVETIME_MS
        return chess.engine.Limit(time=ms / 1000.0)


class EnginePool:
    """Pool of Stockfish processes. One search per process at a time."""

    def __init__(
        self,
        path: Optional[str] = None,
        pool_size: Optional[int] = None,
        hash_mb: Optional[int] = None,
    ) -> None:
        self.path = path or config.STOCKFISH_PATH
        self.pool_size = pool_size or config.ENGINE_POOL_SIZE
        self.hash_mb = hash_mb or config.ENGINE_HASH_MB
        self._engines: List[chess.engine.SimpleEngine] = []
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._executor: Optional[ThreadPoolExecutor] = None
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        if not os.path.isfile(self.path):
            raise FileNotFoundError(
                f"Stockfish not found at {self.path}. "
                "Set STOCKFISH_PATH or place the binary in backend/bin/stockfish"
            )

        cpu = os.cpu_count() or 4
        threads_each = max(1, cpu // self.pool_size)
        logger.info(
            "Starting engine pool size=%s threads_each=%s path=%s",
            self.pool_size,
            threads_each,
            self.path,
        )

        for _ in range(self.pool_size):
            engine = chess.engine.SimpleEngine.popen_uci(self.path)
            engine.configure({"Threads": threads_each, "Hash": self.hash_mb})
            self._engines.append(engine)

        self._semaphore = asyncio.Semaphore(self.pool_size)
        self._executor = ThreadPoolExecutor(max_workers=self.pool_size, thread_name_prefix="sf")
        self._engine_locks = [asyncio.Lock() for _ in range(self.pool_size)]
        self._started = True

    def stop(self) -> None:
        for engine in self._engines:
            try:
                engine.quit()
            except Exception:
                logger.exception("Error quitting engine")
        self._engines.clear()
        if self._executor:
            self._executor.shutdown(wait=False, cancel_futures=True)
            self._executor = None
        self._started = False

    def _analyze_sync(
        self,
        engine: chess.engine.SimpleEngine,
        fen: str,
        settings: AnalysisSettings,
    ) -> EngineScore:
        board = chess.Board(fen)
        limit = settings.limit()
        info = engine.analyse(board, limit, info=chess.engine.INFO_ALL)

        score = info["score"].white()
        cp = score.score()
        mate = score.mate()

        pv = info.get("pv") or []
        pv_uci = [m.uci() for m in pv]
        best = pv_uci[0] if pv_uci else None
        depth = info.get("depth")

        return EngineScore(
            cp=cp,
            mate=mate,
            best_move_uci=best,
            pv_uci=pv_uci,
            depth=depth,
        )

    async def analyze(self, fen: str, settings: Optional[AnalysisSettings] = None) -> EngineScore:
        if not self._started:
            raise RuntimeError("Engine pool not started")
        assert self._semaphore and self._executor

        settings = settings or AnalysisSettings(movetime_ms=config.DEFAULT_MOVETIME_MS)

        async with self._semaphore:
            # Pick first free engine by trying locks non-blocking-ish
            index = None
            for i, lock in enumerate(self._engine_locks):
                if not lock.locked():
                    index = i
                    break
            if index is None:
                index = 0

            async with self._engine_locks[index]:
                loop = asyncio.get_running_loop()
                return await loop.run_in_executor(
                    self._executor,
                    self._analyze_sync,
                    self._engines[index],
                    fen,
                    settings,
                )


# Module-level singleton managed by FastAPI lifespan
pool = EnginePool()
