const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Request failed");
  return body;
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
