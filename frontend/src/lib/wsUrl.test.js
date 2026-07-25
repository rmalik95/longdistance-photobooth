import { buildWsUrl } from "./wsUrl";

describe("buildWsUrl", () => {
  const originalBackendUrl = process.env.REACT_APP_BACKEND_URL;

  afterEach(() => {
    process.env.REACT_APP_BACKEND_URL = originalBackendUrl;
  });

  test("uses wss and encodes the room code and capability token for HTTPS backends", () => {
    process.env.REACT_APP_BACKEND_URL = "https://booth.example.com/";

    expect(buildWsUrl("AB/CD", "guest", "token with spaces")).toBe(
      "wss://booth.example.com/api/ws/AB%2FCD?role=guest&token=token+with+spaces"
    );
  });

  test("uses ws for local HTTP backends and includes the selected role", () => {
    process.env.REACT_APP_BACKEND_URL = "http://localhost:8000";

    expect(buildWsUrl("ABCDEFGH", "host", "host-token")).toBe(
      "ws://localhost:8000/api/ws/ABCDEFGH?role=host&token=host-token"
    );
  });
});
