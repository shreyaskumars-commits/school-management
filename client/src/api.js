const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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

export function getChatHistory() {
  return request("/chat/history");
}

export function clearChatHistory() {
  return request("/chat/history", { method: "DELETE" });
}

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

    const cleanedChunk = chunk.replace(/\*\*/g, "");

    onChunk(cleanedChunk);
  }

  const remaining = decoder.decode();
  if (remaining) onChunk(remaining);
}

export function getConfig() {
  return request("/config");
}

export function addRemark(remark) {
  return request("/remarks", { method: "POST", body: JSON.stringify(remark) });
}

export function getAdminConfig() {
  return request("/admin/config");
}

export function saveAdminConfig(changes) {
  return request("/admin/config", { method: "PUT", body: JSON.stringify(changes) });
}

export function uploadExcel(file) {
  return request("/admin/excel", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": file.name,
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    body: file,
  });
}

export async function downloadSampleExcel() {
  const res = await fetch(`${BASE}/admin/sample.xlsx`, {
    headers: session ? { Authorization: `Bearer ${session.token}` } : {},
  });
  if (!res.ok) throw new Error("Could not download the sample");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-reviews.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
