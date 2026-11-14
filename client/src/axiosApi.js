import axios from "axios";

let session = JSON.parse(sessionStorage.getItem("session") ?? "null");

export const getSession = () => session;

function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem("session", JSON.stringify(value));
  else sessionStorage.removeItem("session");
}
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  if (session) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response.data || null, 
  (error) => {
    const { response, config } = error;

    if (!response) {
      return Promise.reject(new Error("Cannot reach the server"));
    }

    if (response.status === 401 && config.url !== "/login") {
      saveSession(null);
    }
    return Promise.reject(new Error(response.data?.error ?? "Request failed"));
  }
);

export async function login(userId, password) {
  const result = await http.post("/login", { userId, password });
  saveSession(result);
  return result;
}

export async function logout() {
  try {
    await http.post("/logout");
  } finally {
    saveSession(null);
  }
}

export function getStudents({ page, limit, department }) {
  return http.get("/students", {
    params: { page, limit, department: department || undefined },
  });
}

export function createStudent(student) {
  return http.post("/students", student);
}

export function updateStudent(id, changes) {
  return http.patch(`/students/${id}`, changes);
}

export function deleteStudent(id) {
  return http.delete(`/students/${id}`);
}
