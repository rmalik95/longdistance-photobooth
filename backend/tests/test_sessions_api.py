"""
Tests for REST session endpoints in server.py:
- POST /api/sessions (create session)
- GET /api/sessions/{code} (lookup session)
No auth/DB involved - purely in-memory session_manager.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestCreateSession:
    def test_create_session_default_duration(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/sessions", json={})
        assert resp.status_code == 200
        data = resp.json()
        assert "code" in data
        assert isinstance(data["code"], str)
        assert len(data["code"]) == 5
        assert data["countdown_duration"] == 3

    def test_create_session_duration_5(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/sessions", json={"countdown_duration": 5})
        assert resp.status_code == 200
        data = resp.json()
        assert data["countdown_duration"] == 5

    def test_create_session_invalid_duration_falls_back_to_3(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/sessions", json={"countdown_duration": 10})
        assert resp.status_code == 200
        data = resp.json()
        assert data["countdown_duration"] == 3

    def test_create_session_codes_are_unique(self, api_client):
        codes = set()
        for _ in range(5):
            resp = api_client.post(f"{BASE_URL}/api/sessions", json={})
            codes.add(resp.json()["code"])
        assert len(codes) == 5


class TestGetSession:
    def test_get_existing_session(self, api_client):
        create_resp = api_client.post(f"{BASE_URL}/api/sessions", json={"countdown_duration": 5})
        code = create_resp.json()["code"]

        get_resp = api_client.get(f"{BASE_URL}/api/sessions/{code}")
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["exists"] is True
        assert data["full"] is False
        assert data["countdown_duration"] == 5
        assert data["state"] == "waiting"

    def test_get_session_case_insensitive(self, api_client):
        create_resp = api_client.post(f"{BASE_URL}/api/sessions", json={})
        code = create_resp.json()["code"]

        get_resp = api_client.get(f"{BASE_URL}/api/sessions/{code.lower()}")
        assert get_resp.status_code == 200

    def test_get_nonexistent_session_returns_404(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/sessions/ZZZZZ")
        assert resp.status_code == 404
        data = resp.json()
        assert "detail" in data

    def test_root_endpoint(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        assert "message" in resp.json()
