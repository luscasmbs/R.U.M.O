import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rumo_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("rumo_token");
      localStorage.removeItem("rumo_user");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export async function login(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem("rumo_token", data.access_token);
  localStorage.setItem("rumo_user", JSON.stringify(data.user));
  return data.user;
}

export function logout() {
  localStorage.removeItem("rumo_token");
  localStorage.removeItem("rumo_user");
}

export function getStoredUser() {
  const raw = localStorage.getItem("rumo_user");
  return raw ? JSON.parse(raw) : null;
}
