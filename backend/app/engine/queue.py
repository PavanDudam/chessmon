"""In-memory analysis job queue with SSE fan-out."""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app import config
from app.db.cache import Database, db
from app.engine.analyzer import analyze_game
from app.engine.stockfish import AnalysisSettings, EnginePool, pool

logger = logging.getLogger(__name__)


@dataclass
class Job:
    id: str
    pgn: str
    settings: AnalysisSettings
    subscribers: List[asyncio.Queue] = field(default_factory=list)
    done: bool = False


class JobQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[Job] = asyncio.Queue()
        self._jobs: Dict[str, Job] = {}
        self._workers: List[asyncio.Task] = []
        self._pool: EnginePool = pool
        self._db: Database = db
        self._running = False

    def start(self, worker_count: int = 2) -> None:
        if self._running:
            return
        self._running = True
        for i in range(worker_count):
            self._workers.append(asyncio.create_task(self._worker(i)))

    async def stop(self) -> None:
        self._running = False
        for w in self._workers:
            w.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    def submit(
        self,
        pgn: str,
        settings: Optional[AnalysisSettings] = None,
    ) -> str:
        job_id = uuid.uuid4().hex
        settings = settings or AnalysisSettings(movetime_ms=config.DEFAULT_MOVETIME_MS)
        job = Job(id=job_id, pgn=pgn, settings=settings)
        self._jobs[job_id] = job
        self._queue.put_nowait(job)
        return job_id

    def subscribe(self, job_id: str) -> asyncio.Queue:
        job = self._jobs.get(job_id)
        q: asyncio.Queue = asyncio.Queue()
        if job is None:
            # May already be completed and only in DB
            q.put_nowait({"type": "error", "message": "Unknown job id"})
            return q
        job.subscribers.append(q)
        if job.done:
            # Late subscriber — client should GET /games/{id}
            q.put_nowait({"type": "done", "message": "already_finished"})
        return q

    def unsubscribe(self, job_id: str, q: asyncio.Queue) -> None:
        job = self._jobs.get(job_id)
        if job and q in job.subscribers:
            job.subscribers.remove(q)

    async def _broadcast(self, job: Job, event: Dict[str, Any]) -> None:
        dead = []
        for q in job.subscribers:
            try:
                q.put_nowait(event)
            except Exception:
                dead.append(q)
        for q in dead:
            if q in job.subscribers:
                job.subscribers.remove(q)

    async def _worker(self, worker_id: int) -> None:
        logger.info("Job worker %s started", worker_id)
        while True:
            job: Job = await self._queue.get()
            try:

                async def on_event(event: Dict[str, Any]) -> None:
                    await self._broadcast(job, event)

                await analyze_game(
                    job_id=job.id,
                    pgn=job.pgn,
                    pool=self._pool,
                    database=self._db,
                    settings=job.settings,
                    on_event=on_event,
                )
            except Exception as exc:
                logger.exception("Job %s failed", job.id)
                await self._broadcast(job, {"type": "error", "message": str(exc)})
            finally:
                job.done = True
                self._queue.task_done()


job_queue = JobQueue()
