const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// { token, userId, role } of the logged-in user; kept for the browser tab
let session = JSON.parse(sessionStorage.getItem("session") ?? "null");

export const getSession = () => session;

function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem("session", JSON.stringify(value));
  else sessionStorage.removeItem("session");
}

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body;
}

export async function login(userId, password) {
  const result = await request("/login", {
    method: "POST",
    body: JSON.stringify({ userId, password }),
  });
  saveSession(result);
  return result;
}

export async function logout() {
  try {
    await request("/logout", { method: "POST" });
  } finally {
    saveSession(null);
  }
}

export function getStudents({ page, limit, department }) {
  const params = new URLSearchParams({ page, limit });
  if (department) params.set("department", department);
  return request(`/students?${params}`);
}

export function createStudent(student) {
  return request("/students", {
    method: "POST",
    body: JSON.stringify(student),
  });
}

export function updateStudent(id, changes) {
  return request(`/students/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function deleteStudent(id) {
  return request(`/students/${id}`, { method: "DELETE" });
}

// ---- chatbot ----

export function getChatHistory() {
  return request("/chat/history");
}

export function clearChatHistory() {
  return request("/chat/history", { method: "DELETE" });
}

// Sends one message and calls onChunk(text) for every piece of the reply as it
// arrives. fetch is used because axios waits for the whole response.
export async function streamChat(message, onChunk, signal) {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    // Remove Markdown bold markers
    const cleanedChunk = chunk.replace(/\*\*/g, "");

    onChunk(cleanedChunk);
  }

  // Flush any remaining decoded characters
  const remaining = decoder.decode();
  if (remaining) onChunk(remaining);
}

