"""Alpha fixed-validation Python network guard."""

import os
import socket
import subprocess

if os.environ.get("ALPHA_NETWORK_DISABLED") != "1":
    raise RuntimeError("Alpha Python network guard requires disabled policy.")


def _deny(*_args, **_kwargs):
    raise RuntimeError("Network access is disabled by Alpha validation policy.")


class _DisabledSocket:
    def __init__(self, *_args, **_kwargs):
        _deny()


socket.socket = _DisabledSocket
socket.create_connection = _deny
subprocess.Popen = _deny
subprocess.run = _deny
subprocess.call = _deny
subprocess.check_call = _deny
subprocess.check_output = _deny
os.system = _deny
os.popen = _deny
for _name in (
    "execl",
    "execle",
    "execlp",
    "execlpe",
    "execv",
    "execve",
    "execvp",
    "execvpe",
    "spawnl",
    "spawnle",
    "spawnlp",
    "spawnlpe",
    "spawnv",
    "spawnve",
    "spawnvp",
    "spawnvpe",
    "posix_spawn",
    "posix_spawnp",
    "fork",
    "forkpty",
    "startfile",
):
    if hasattr(os, _name):
        setattr(os, _name, _deny)
os.environ["ALPHA_PYTHON_NETWORK_GUARD_ACTIVE"] = "1"
os.environ["ALPHA_PYTHON_SUBPROCESS_GUARD_ACTIVE"] = "1"
