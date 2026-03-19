import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Auth
export async function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  body.set("grant_type", "password");
  const res = await api.post("/api/v1/auth/login", body);
  return res.data as { access_token: string; refresh_token: string; token_type: string };
}

export async function getMe() {
  const res = await api.get("/api/v1/auth/me");
  return res.data;
}

// Verification
export async function uploadMedia(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/api/v1/verify/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { session_id: string; status: string };
}

export async function startLiveSession() {
  const res = await api.post("/api/v1/verify/start-live");
  return res.data as { session_id: string; websocket_url: string };
}

export async function endLiveSession(sessionId: string) {
  await api.delete(`/api/v1/verify/end-live/${sessionId}`);
}

// Sessions
export async function getSessions(params?: { page?: number; limit?: number; status?: string; mode?: string }) {
  const res = await api.get("/api/v1/sessions", { params });
  return res.data;
}

export async function getSession(sessionId: string) {
  const res = await api.get(`/api/v1/sessions/${sessionId}`);
  return res.data;
}

export async function getDashboardStats() {
  const res = await api.get("/api/v1/analytics/dashboard");
  return res.data;
}

export async function getSignalMetrics() {
  const res = await api.get("/api/v1/analytics/signals");
  return res.data;
}

