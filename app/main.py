
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from app.decision_engine import (
    DecisionAction,
    evaluate_event_contract,
    evaluate_stock,
)
from app.portfolio import Portfolio, create_sample_portfolio
from app.risk_engine import RiskEngine

console = Console()


def format_money(value: float) -> str:
    """Format a number as US currency."""
    return f"${value:,.2f}"


def get_profit_style(value: float) -> str:
    """Return a Rich color based on profit or loss."""
    return "green" if value >= 0 else "red"


def display_summary(portfolio: Portfolio) -> None:
    """Display the portfolio overview."""

    profit_style = get_profit_style(
        portfolio.total_unrealized_profit
    )

    summary = (
        f"[bold]Total Capital[/bold]\n"
        f"[cyan]{format_money(portfolio.total_value)}[/cyan]\n\n"
        f"[bold]Unrealized Profit / Loss[/bold]\n"
        f"[{profit_style}]"
        f"{format_money(portfolio.total_unrealized_profit)}"
        f"[/{profit_style}]"
    )

    console.print(
        Panel(
            summary,
            title="Alpha Mission Control",
            border_style="blue",
        )
    )


def display_allocation(portfolio: Portfolio) -> None:
    """Display portfolio allocation by asset class."""

    table = Table(title="Portfolio Allocation")

    table.add_column("Asset Class")
    table.add_column("Value", justify="right")
    table.add_column("Allocation", justify="right")

    asset_rows = [
        ("Cash", portfolio.cash.market_value),
        ("Stocks", portfolio.stock_value),
        ("Event Contracts", portfolio.event_value),
    ]

    for asset_name, asset_value in asset_rows:
        allocation = portfolio.allocation_percentage(asset_value)

        table.add_row(
            asset_name,
            format_money(asset_value),
            f"{allocation:.2f}%",
        )

    console.print(table)


def display_stock_positions(portfolio: Portfolio) -> None:
    """Display all stock positions."""

    table = Table(title="Stock Positions")

    table.add_column("Ticker", style="cyan")
    table.add_column("Company")
    table.add_column("Shares", justify="right")
    table.add_column("Average Cost", justify="right")
    table.add_column("Current Price", justify="right")
    table.add_column("Market Value", justify="right")
    table.add_column("Profit / Loss", justify="right")
    table.add_column("Return", justify="right")

    for position in portfolio.stocks:
        profit_style = get_profit_style(
            position.unrealized_profit
        )

        table.add_row(
            position.ticker,
            position.company_name,
            f"{position.shares:g}",
            format_money(position.average_cost),
            format_money(position.current_price),
            format_money(position.market_value),
            (
                f"[{profit_style}]"
                f"{format_money(position.unrealized_profit)}"
                f"[/{profit_style}]"
            ),
            (
                f"[{profit_style}]"
                f"{position.return_percentage:.2f}%"
                f"[/{profit_style}]"
            ),
        )

    console.print(table)


def display_event_contracts(portfolio: Portfolio) -> None:
    """Display all open event contract positions."""

    table = Table(title="Event Contracts")

    table.add_column("Event")
    table.add_column("Selection")
    table.add_column("Contracts", justify="right")
    table.add_column("Average Price", justify="right")
    table.add_column("Current Price", justify="right")
    table.add_column("Market Value", justify="right")
    table.add_column("Profit / Loss", justify="right")
    table.add_column("Return", justify="right")

    for contract in portfolio.event_contracts:
        profit_style = get_profit_style(
            contract.unrealized_profit
        )

        table.add_row(
            contract.event_name,
            contract.selection,
            f"{contract.contracts:g}",
            f"{contract.average_price:.0%}",
            f"{contract.current_price:.0%}",
            format_money(contract.market_value),
            (
                f"[{profit_style}]"
                f"{format_money(contract.unrealized_profit)}"
                f"[/{profit_style}]"
            ),
            (
                f"[{profit_style}]"
                f"{contract.return_percentage:.2f}%"
                f"[/{profit_style}]"
            ),
        )

    console.print(table)

def get_decision_style(action: DecisionAction) -> str:
    """Return a Rich style for a decision action."""

    styles = {
        DecisionAction.HOLD: "green",
        DecisionAction.REVIEW: "yellow",
        DecisionAction.PARTIAL_TAKE_PROFIT: "dark_orange",
        DecisionAction.TAKE_PROFIT: "red",
        DecisionAction.STRONG_TAKE_PROFIT: "bold red",
    }

    return styles[action]


def display_stock_decisions(portfolio: Portfolio) -> None:
    """Display Alpha recommendations for stock positions."""

    table = Table(title="Stock Decisions")

    table.add_column("Ticker", style="cyan")
    table.add_column("Action")
    table.add_column("Confidence", justify="right")
    table.add_column("Reason")

    for position in portfolio.stocks:
        decision = evaluate_stock(position)
        decision_style = get_decision_style(decision.action)

        table.add_row(
            position.ticker,
            f"[{decision_style}]{decision.action.value}[/{decision_style}]",
            f"{decision.confidence}%",
            decision.reason,
        )

    console.print(table)


def display_event_decisions(portfolio: Portfolio) -> None:
    """Display Alpha recommendations for event contracts."""

    table = Table(title="Event Decisions")

    table.add_column("Event")
    table.add_column("Selection")
    table.add_column("Action")
    table.add_column("Confidence", justify="right")
    table.add_column("Reason")

    for contract in portfolio.event_contracts:
        decision = evaluate_event_contract(contract)
        decision_style = get_decision_style(decision.action)

        table.add_row(
            contract.event_name,
            contract.selection,
            f"[{decision_style}]{decision.action.value}[/{decision_style}]",
            f"{decision.confidence}%",
            decision.reason,
        )

    console.print(table)

def display_risk_limits(portfolio: Portfolio) -> None:
    """Display deterministic portfolio risk limits."""

    risk_engine = RiskEngine()
    limits = risk_engine.get_summary(portfolio.total_value)

    table = Table(title="Risk Limits")

    table.add_column("Risk Control")
    table.add_column("Amount", justify="right")

    table.add_row(
        "Maximum Total Position",
        format_money(limits["maximum_total_position"]),
    )
    table.add_row(
        "Minimum Cash Reserve",
        format_money(limits["minimum_cash_reserve"]),
    )
    table.add_row(
        "Maximum Daily Loss",
        format_money(limits["maximum_daily_loss"]),
    )
    table.add_row(
        "Maximum Single Trade",
        format_money(limits["maximum_single_trade"]),
    )

    console.print(table)

def main() -> None:
    """Run the Alpha terminal dashboard."""

    portfolio = create_sample_portfolio()

    console.print(
        "\n[bold cyan]Alpha[/bold cyan]"
        " — Capital Operating System\n"
    )

    display_summary(portfolio)
    display_allocation(portfolio)
    display_stock_positions(portfolio)
    display_event_contracts(portfolio)
    display_stock_decisions(portfolio)
    display_event_decisions(portfolio)
    display_risk_limits(portfolio)

if __name__ == "__main__":
    main()