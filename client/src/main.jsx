import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AdminApp from "./components/AdminApp.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { getSession, logout } from "./api.js";
import "./App.css";

function Root() {
  const [session, setSession] = useState(getSession);

  async function handleLogout() {
    await logout().catch(() => {});
    setSession(null);
  }

  if (!session) return <LoginPage onLogin={setSession} />;
  if (session.role === "admin") {
    return <AdminApp userId={session.userId} onLogout={handleLogout} />;
  }
  return (
    <App
      userId={session.userId}
      role={session.role}
      canDelete={session.role === "principal"}
      onLogout={handleLogout}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
