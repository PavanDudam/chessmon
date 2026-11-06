"""Pydantic request/response models."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AnalyzePositionRequest(BaseModel):
    fen: str
    movetime_ms: Optional[int] = None
    depth: Optional[int] = None


class AnalyzePositionResponse(BaseModel):
    fen: str
    cp: Optional[int] = None
    mate: Optional[int] = None
    best_move_uci: Optional[str] = None
    pv_uci: List[str] = Field(default_factory=list)
    depth: Optional[int] = None
    win_percent: float


class CreateGameRequest(BaseModel):
    pgn: str
    movetime_ms: Optional[int] = None
    depth: Optional[int] = None


class CreateGameResponse(BaseModel):
    job_id: str


class MoveReview(BaseModel):
    ply: int
    move_number: int
    san: str
    uci: str
    fen_before: str
    fen_after: str
    moved_by_white: bool
    label: str
    cp_before: Optional[float] = None
    cp_after: Optional[float] = None
    mate_before: Optional[int] = None
    mate_after: Optional[int] = None
    win_pct_before: Optional[float] = None
    win_pct_after: Optional[float] = None
    win_pct_loss: Optional[float] = None
    best_move_uci: Optional[str] = None
    best_move_san: Optional[str] = None
    pv_uci: List[str] = Field(default_factory=list)
    pv_san: List[str] = Field(default_factory=list)
    is_check: bool = False
    is_checkmate: bool = False
    is_stalemate: bool = False
    comment: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    comment_id: Optional[str] = None
    audio_url: Optional[str] = None


class PlayerStats(BaseModel):
    accuracy: Optional[float] = None
    move_count: int = 0
    counts: Dict[str, int] = Field(default_factory=dict)


class GameReview(BaseModel):
    id: str
    status: str
    title: str
    pgn: str
    headers: Dict[str, str] = Field(default_factory=dict)
    starting_fen: str
    moves: List[MoveReview] = Field(default_factory=list)
    white: Optional[PlayerStats] = None
    black: Optional[PlayerStats] = None
    settings: Dict[str, Any] = Field(default_factory=dict)
    progress: Dict[str, int] = Field(default_factory=dict)
    error: Optional[str] = None


class GameListItem(BaseModel):
    id: str
    title: str
    status: str
    white_accuracy: Optional[float] = None
    black_accuracy: Optional[float] = None
    created_at: str
