"""Chessmon FastAPI application."""

from __future__ import annotations

import logging
import mimetypes
from contextlib import asynccontextmanager

mimetypes.add_type("audio/wav", ".wav")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import config
from app.api import analyze, games
from app.db.cache import db
from app.db.schema import init_db
from app.engine.queue import job_queue
from app.engine.stockfish import pool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("chessmon")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    db.connect()
    pool.start()
    job_queue.start(worker_count=max(1, config.ENGINE_POOL_SIZE))
    logger.info("Chessmon backend ready (stockfish=%s)", config.STOCKFISH_PATH)
    try:
        yield
    finally:
        await job_queue.stop()
        pool.stop()
        db.close()
        logger.info("Chessmon backend stopped")


app = FastAPI(title="Chessmon", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)
app.include_router(analyze.router)

config.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(config.AUDIO_DIR)), name="audio")


@app.get("/api/health")
async def health():
    return {"status": "ok", "engine_pool": config.ENGINE_POOL_SIZE}
