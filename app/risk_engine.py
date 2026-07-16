"""
Alpha Risk Engine.

This module applies deterministic capital protection rules.
It does not use AI for calculations.
"""

from dataclasses import dataclass

from config.risk_config import (
    MAX_DAILY_LOSS_PERCENT,
    MAX_SINGLE_TRADE_PERCENT,
    MAX_TOTAL_POSITION_PERCENT,
    MIN_CASH_RESERVE_PERCENT,
)


@dataclass(frozen=True)
class RiskLimits:
    """Immutable risk limits loaded from the Config System."""

    max_total_position_percent: float
    min_cash_reserve_percent: float
    max_daily_loss_percent: float
    max_single_trade_percent: float


class RiskEngine:
    """Evaluate deterministic capital and position limits."""

    def __init__(self) -> None:
        self.limits = RiskLimits(
            max_total_position_percent=MAX_TOTAL_POSITION_PERCENT,
            min_cash_reserve_percent=MIN_CASH_RESERVE_PERCENT,
            max_daily_loss_percent=MAX_DAILY_LOSS_PERCENT,
            max_single_trade_percent=MAX_SINGLE_TRADE_PERCENT,
        )

    def maximum_total_position(self, total_capital: float) -> float:
        """Return the maximum capital allowed in total open positions."""
        self._validate_capital(total_capital)
        return total_capital * self.limits.max_total_position_percent

    def minimum_cash_reserve(self, total_capital: float) -> float:
        """Return the minimum cash that must remain uncommitted."""
        self._validate_capital(total_capital)
        return total_capital * self.limits.min_cash_reserve_percent

    def maximum_daily_loss(self, total_capital: float) -> float:
        """Return the maximum permitted loss for one day."""
        self._validate_capital(total_capital)
        return total_capital * self.limits.max_daily_loss_percent

    def maximum_single_trade(self, total_capital: float) -> float:
        """Return the maximum capital allowed in one trade."""
        self._validate_capital(total_capital)
        return total_capital * self.limits.max_single_trade_percent

    def get_summary(self, total_capital: float) -> dict[str, float]:
        """Return calculated risk limits for the supplied capital."""
        return {
            "maximum_total_position": self.maximum_total_position(
                total_capital
            ),
            "minimum_cash_reserve": self.minimum_cash_reserve(
                total_capital
            ),
            "maximum_daily_loss": self.maximum_daily_loss(
                total_capital
            ),
            "maximum_single_trade": self.maximum_single_trade(
                total_capital
            ),
        }

    @staticmethod
    def _validate_capital(total_capital: float) -> None:
        """Reject zero or negative capital values."""
        if total_capital <= 0:
            raise ValueError("Total capital must be greater than zero.")