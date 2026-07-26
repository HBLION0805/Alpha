"""Alpha fixed-validation Python network guard."""

import os
import socket

if os.environ.get("ALPHA_NETWORK_DISABLED") != "1":
    raise RuntimeError("Alpha Python network guard requires disabled policy.")


def _deny(*_args, **_kwargs):
    raise RuntimeError("Network access is disabled by Alpha validation policy.")


class _DisabledSocket:
    def __init__(self, *_args, **_kwargs):
        _deny()


socket.socket = _DisabledSocket
socket.create_connection = _deny
os.environ["ALPHA_PYTHON_NETWORK_GUARD_ACTIVE"] = "1"
