"""Pytest collection policy for the backend test suite.

The photo-strip tests are self-contained. REST and WebSocket tests are live
integration tests and must never fail merely because no server was started.
Use LIVE_TESTS=1 REACT_APP_BACKEND_URL=https://... pytest -m live to opt in.
"""
import os
import sys
from pathlib import Path

import pytest


# Tests use the same top-level imports as `uvicorn server:app`; make those
# imports work consistently when pytest is launched from backend/ or the repo
# root, without requiring PYTHONPATH to be set by the caller.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

LIVE_TEST_FILES = {"test_sessions_api.py", "test_websocket_relay.py"}


def pytest_collection_modifyitems(config, items):
    live = os.environ.get("LIVE_TESTS") == "1"
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    skip_reason = (
        "live integration tests require LIVE_TESTS=1 and "
        "REACT_APP_BACKEND_URL pointing at a running backend"
    )
    skip_live = pytest.mark.skip(reason=skip_reason)

    for item in items:
        if item.fspath.basename in LIVE_TEST_FILES:
            item.add_marker(pytest.mark.live)
            if not live or not backend_url:
                item.add_marker(skip_live)
