"""Per-player accuracy score and label counts."""

from __future__ import annotations

from collections import Counter
from typing import Dict, Iterable, List

from app.chess.classifier import MoveLabel


def move_accuracy_from_loss(win_pct_loss: float) -> float:
    """Map a win% drop to a 0-100 accuracy contribution for that move."""
    # Soft exponential: 0 loss → 100, large loss → approaches 0
    # 10pp loss ≈ 60 accuracy, 20pp ≈ 36, etc.
    return max(0.0, min(100.0, 100.0 * (0.95 ** win_pct_loss)))


def compute_player_stats(
    labels: Iterable[MoveLabel],
    losses: Iterable[float],
) -> Dict:
    label_list = list(labels)
    loss_list = list(losses)
    counts = Counter(l.value for l in label_list)

    # Book moves excluded from accuracy average
    scored = [
        move_accuracy_from_loss(loss)
        for label, loss in zip(label_list, loss_list)
        if label != MoveLabel.BOOK
    ]
    accuracy = sum(scored) / len(scored) if scored else None

    return {
        "accuracy": round(accuracy, 1) if accuracy is not None else None,
        "move_count": len(label_list),
        "counts": {
            "Book": counts.get(MoveLabel.BOOK.value, 0),
            "Best": counts.get(MoveLabel.BEST.value, 0),
            "Good": counts.get(MoveLabel.GOOD.value, 0),
            "Inaccuracy": counts.get(MoveLabel.INACCURACY.value, 0),
            "Mistake": counts.get(MoveLabel.MISTAKE.value, 0),
            "Blunder": counts.get(MoveLabel.BLUNDER.value, 0),
        },
    }


def split_by_side(
    move_labels: List[MoveLabel],
    move_losses: List[float],
    moved_by_white: List[bool],
) -> Dict:
    white_labels, white_losses = [], []
    black_labels, black_losses = [], []
    for label, loss, is_white in zip(move_labels, move_losses, moved_by_white):
        if is_white:
            white_labels.append(label)
            white_losses.append(loss)
        else:
            black_labels.append(label)
            black_losses.append(loss)
    return {
        "white": compute_player_stats(white_labels, white_losses),
        "black": compute_player_stats(black_labels, black_losses),
    }
