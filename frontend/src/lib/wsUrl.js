export function buildWsUrl(code, role) {
  const backend = process.env.REACT_APP_BACKEND_URL || "";
  const wsProtocol = backend.startsWith("https") ? "wss" : "ws";
  const host = backend.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${host}/api/ws/${code}?role=${role}`;
}
