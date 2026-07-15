from dataclasses import dataclass


@dataclass
class CashBalance:
    """Represents available cash in the portfolio."""

    amount: float

    @property
    def market_value(self) -> float:
        """Return the current cash value."""
        return self.amount


@dataclass
class StockPosition:
    """Represents a stock position in the portfolio."""

    ticker: str
    company_name: str
    shares: float
    average_cost: float
    current_price: float

    @property
    def cost_basis(self) -> float:
        """Return the total amount originally invested."""
        return self.shares * self.average_cost

    @property
    def market_value(self) -> float:
        """Return the current value of the position."""
        return self.shares * self.current_price

    @property
    def unrealized_profit(self) -> float:
        """Return the unrealized profit or loss."""
        return self.market_value - self.cost_basis

    @property
    def return_percentage(self) -> float:
        """Return the percentage gain or loss."""
        if self.cost_basis == 0:
            return 0.0

        return (self.unrealized_profit / self.cost_basis) * 100


@dataclass
class EventContract:
    """Represents an event contract position."""

    event_name: str
    selection: str
    contracts: float
    average_price: float
    current_price: float

    @property
    def cost_basis(self) -> float:
        """Return the total amount paid for the contracts."""
        return self.contracts * self.average_price

    @property
    def market_value(self) -> float:
        """Return the current market value of the contracts."""
        return self.contracts * self.current_price

    @property
    def unrealized_profit(self) -> float:
        """Return the unrealized profit or loss."""
        return self.market_value - self.cost_basis

    @property
    def return_percentage(self) -> float:
        """Return the percentage gain or loss."""
        if self.cost_basis == 0:
            return 0.0

        return (self.unrealized_profit / self.cost_basis) * 100