import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export async function createSession({ countdownDuration = 3, layout = "1x3", frame = "classic", filter = "warm" } = {}) {
  const res = await axios.post(`${API}/sessions`, {
    countdown_duration: countdownDuration,
    layout,
    frame,
    filter,
  });
  return res.data;
}

export async function fetchSessionStatus(code) {
  const res = await axios.get(`${API}/sessions/${code}`);
  return res.data;
}
