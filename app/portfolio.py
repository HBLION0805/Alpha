from dataclasses import dataclass

from app.models import CashBalance, EventContract, StockPosition


@dataclass
class Portfolio:
    """Contains all assets currently managed by Alpha."""

    cash: CashBalance
    stocks: list[StockPosition]
    event_contracts: list[EventContract]

    @property
    def stock_value(self) -> float:
        """Return the total market value of all stock positions."""
        return sum(position.market_value for position in self.stocks)

    @property
    def event_value(self) -> float:
        """Return the total market value of all event contracts."""
        return sum(
            contract.market_value
            for contract in self.event_contracts
        )

    @property
    def total_value(self) -> float:
        """Return the total current portfolio value."""
        return (
            self.cash.market_value
            + self.stock_value
            + self.event_value
        )

    @property
    def stock_profit(self) -> float:
        """Return total unrealized stock profit or loss."""
        return sum(
            position.unrealized_profit
            for position in self.stocks
        )

    @property
    def event_profit(self) -> float:
        """Return total unrealized event profit or loss."""
        return sum(
            contract.unrealized_profit
            for contract in self.event_contracts
        )

    @property
    def total_unrealized_profit(self) -> float:
        """Return total unrealized profit or loss."""
        return self.stock_profit + self.event_profit

    def allocation_percentage(self, asset_value: float) -> float:
        """Return an asset's percentage of total portfolio value."""
        if self.total_value == 0:
            return 0.0

        return (asset_value / self.total_value) * 100


def create_sample_portfolio() -> Portfolio:
    """Create temporary portfolio data for development."""

    cash = CashBalance(amount=300.00)

    sk_hynix = StockPosition(
        ticker="SKHY",
        company_name="SK Hynix",
        shares=5,
        average_cost=170.00,
        current_price=190.00,
    )

    spain_contract = EventContract(
        event_name="France vs Spain",
        selection="Spain to Advance",
        contracts=50,
        average_price=0.44,
        current_price=0.63,
    )

    return Portfolio(
        cash=cash,
        stocks=[sk_hynix],
        event_contracts=[spain_contract],
    )