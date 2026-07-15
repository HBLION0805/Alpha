from dataclasses import dataclass
from enum import Enum
from config.decision_rules import (
    EVENT_PARTIAL_TAKE_PROFIT_PERCENTAGE,
    EVENT_REVIEW_LOSS_PERCENTAGE,
    EVENT_STRONG_TAKE_PROFIT_PERCENTAGE,
    EVENT_TAKE_PROFIT_PERCENTAGE,
    STOCK_PARTIAL_TAKE_PROFIT_PERCENTAGE,
    STOCK_REVIEW_LOSS_PERCENTAGE,
)
from app.models import EventContract, StockPosition


class DecisionAction(str, Enum):
    """Available actions returned by the decision engine."""

    HOLD = "HOLD"
    REVIEW = "REVIEW"
    PARTIAL_TAKE_PROFIT = "PARTIAL TAKE PROFIT"
    TAKE_PROFIT = "TAKE PROFIT"
    STRONG_TAKE_PROFIT = "STRONG TAKE PROFIT"


@dataclass
class Decision:
    """Represents one recommendation produced by Alpha."""

    action: DecisionAction
    confidence: int
    reason: str


def evaluate_stock(position: StockPosition) -> Decision:
    """Evaluate a stock position using early Alpha rules."""

    return_percentage = position.return_percentage

    if return_percentage <= STOCK_REVIEW_LOSS_PERCENTAGE:
        return Decision(
            action=DecisionAction.REVIEW,
            confidence=82,
            reason=(
                "The position has fallen more than 10%. "
                "Review the original investment thesis before taking action."
            ),
        )

    if return_percentage >= STOCK_PARTIAL_TAKE_PROFIT_PERCENTAGE:
        return Decision(
            action=DecisionAction.PARTIAL_TAKE_PROFIT,
            confidence=72,
            reason=(
                "The stock has produced a strong unrealized return. "
                "Consider reducing a small portion while preserving the core position."
            ),
        )

    return Decision(
        action=DecisionAction.HOLD,
        confidence=80,
        reason=(
            "The position remains within the normal holding range. "
            "No immediate portfolio action is required."
        ),
    )


def evaluate_event_contract(contract: EventContract) -> Decision:
    """Evaluate an event contract using stricter profit-taking rules."""

    return_percentage = contract.return_percentage

    if return_percentage <= EVENT_REVIEW_LOSS_PERCENTAGE:
        return Decision(
            action=DecisionAction.REVIEW,
            confidence=88,
            reason=(
                "The event contract has lost more than 20%. "
                "Event contracts can deteriorate quickly, so reassess the position."
            ),
        )

    if return_percentage >= EVENT_STRONG_TAKE_PROFIT_PERCENTAGE:
        return Decision(
            action=DecisionAction.STRONG_TAKE_PROFIT,
            confidence=95,
            reason=(
                "The contract has doubled in value. "
                "Protect the gain instead of relying on the final event outcome."
            ),
        )

    if return_percentage >= EVENT_TAKE_PROFIT_PERCENTAGE:
        return Decision(
            action=DecisionAction.TAKE_PROFIT,
            confidence=91,
            reason=(
                "The contract has entered the primary profit-taking zone. "
                "Event prices can reverse rapidly."
            ),
        )

    if return_percentage >= EVENT_PARTIAL_TAKE_PROFIT_PERCENTAGE:
        return Decision(
            action=DecisionAction.PARTIAL_TAKE_PROFIT,
            confidence=84,
            reason=(
                "The contract has a meaningful unrealized gain. "
                "Consider locking in part of the profit."
            ),
        )

    return Decision(
        action=DecisionAction.HOLD,
        confidence=74,
        reason=(
            "The contract has not reached a profit-taking threshold. "
            "Continue monitoring the event and market price."
        ),
    )