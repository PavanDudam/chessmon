"""Win-probability conversion and move classification."""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class MoveLabel(str, Enum):
    BOOK = "Book"
    BEST = "Best"
    EXCELLENT = "Excellent"
    GOOD = "Good"
    INACCURACY = "Inaccuracy"
    MISTAKE = "Mistake"
    BLUNDER = "Blunder"


# win% drop thresholds (percentage points)
# Best is the engine's move. Excellent is a strong move that is not that move.
THRESH_EXCELLENT = 1.0
THRESH_GOOD = 2.0
THRESH_INACCURACY = 5.0
THRESH_MISTAKE = 10.0

# Map mate-in-N to a large centipawn magnitude for win% math
MATE_CP = 10_000


def cp_to_win_percent(cp: float) -> float:
    """Convert White-perspective centipawns to White win probability (0-100)."""
    return 50.0 + 50.0 * (2.0 / (1.0 + math.exp(-0.00368 * cp)) - 1.0)


def mate_to_cp(mate: int) -> float:
    """Map mate-in-N (White POV signed) to a large CP value."""
    if mate == 0:
        return 0.0
    # Positive mate = White mates; negative = Black mates
    return MATE_CP if mate > 0 else -MATE_CP


def score_to_cp_white(cp: Optional[int], mate: Optional[int]) -> float:
    """Normalize a White-perspective score to a CP float."""
    if mate is not None:
        return mate_to_cp(mate)
    if cp is None:
        return 0.0
    return float(cp)


@dataclass
class Classification:
    label: MoveLabel
    win_pct_before: float
    win_pct_after: float
    win_pct_loss: float
    cp_before: float
    cp_after: float


def classify_move(
    *,
    cp_before_white: float,
    cp_after_white: float,
    moved_by_white: bool,
    is_book: bool = False,
    missed_mate: bool = False,
    is_engine_best: Optional[bool] = None,
) -> Classification:
    """Classify a played move from White-perspective evals before/after the move.

    Win% loss is measured for the side that just moved:
    - White moved: loss = white_win%_before - white_win%_after
    - Black moved: loss = black_win%_before - black_win%_after
                 = (100 - white_before) - (100 - white_after)
                 = white_after - white_before
    """
    wp_before = cp_to_win_percent(cp_before_white)
    wp_after = cp_to_win_percent(cp_after_white)

    if moved_by_white:
        loss = wp_before - wp_after
    else:
        loss = wp_after - wp_before

    # Numerical noise / tiny improvements count as zero loss
    loss = max(0.0, loss)

    if is_book:
        label = MoveLabel.BOOK
    elif missed_mate:
        label = MoveLabel.BLUNDER
    elif is_engine_best:
        label = MoveLabel.BEST
    elif loss < THRESH_EXCELLENT:
        # No engine move to compare: a near-zero loss is still Best.
        label = (
            MoveLabel.BEST
            if is_engine_best is None and loss < 0.5
            else MoveLabel.EXCELLENT
        )
    elif loss < THRESH_GOOD:
        label = MoveLabel.GOOD
    elif loss < THRESH_INACCURACY:
        label = MoveLabel.INACCURACY
    elif loss < THRESH_MISTAKE:
        label = MoveLabel.MISTAKE
    else:
        label = MoveLabel.BLUNDER

    return Classification(
        label=label,
        win_pct_before=wp_before,
        win_pct_after=wp_after,
        win_pct_loss=loss,
        cp_before=cp_before_white,
        cp_after=cp_after_white,
    )


def missed_forced_mate(
    mate_before: Optional[int],
    mate_after: Optional[int],
    moved_by_white: bool,
) -> bool:
    """True if the mover had a forced mate and threw it away."""
    if mate_before is None:
        return False
    # Mate score is White POV: positive means White is mating
    mover_was_mating = (mate_before > 0) if moved_by_white else (mate_before < 0)
    if not mover_was_mating:
        return False
    if mate_after is None:
        return True
    mover_still_mating = (mate_after > 0) if moved_by_white else (mate_after < 0)
    return not mover_still_mating
