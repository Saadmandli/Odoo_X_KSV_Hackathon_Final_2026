// Single place that knows how to talk to the API. VITE_ vars are inlined at
// build time, so this must be set in the host's env BEFORE the build runs —
// otherwise a deployed bundle quietly calls localhost.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const TOKEN_KEY = "carpool.token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, signal } = {}) {
  const token = getToken();

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === "TypeError" || err.message === "Failed to fetch") {
      throw new ApiError(503, "Cannot connect to server. Please ensure the backend server is running on http://localhost:4000.");
    }
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // A dead token should log the user out rather than leave them on a screen
    // where every request silently fails.
    if (res.status === 401 && token) {
      clearToken();
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const get = (p, opts) => api(p, opts);
export const post = (p, body, opts) => api(p, { ...opts, method: "POST", body });
export const put = (p, body, opts) => api(p, { ...opts, method: "PUT", body });
export const del = (p, opts) => api(p, { ...opts, method: "DELETE" });
