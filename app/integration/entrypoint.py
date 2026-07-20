"""Fixed stdin/stdout entry point for the local Python integration transport."""

from __future__ import annotations

import json
import sys
from typing import Any

from app.integration.registry import dispatch_request


MAXIMUM_INPUT_BYTES = 1_048_576


def _read_request() -> Any:
    payload = sys.stdin.buffer.read(MAXIMUM_INPUT_BYTES + 1)
    if len(payload) > MAXIMUM_INPUT_BYTES:
        return None
    try:
        return json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def main() -> int:
    """Read exactly one request and write exactly one protocol response."""

    response = dispatch_request(_read_request())
    sys.stdout.write(
        json.dumps(
            response,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
