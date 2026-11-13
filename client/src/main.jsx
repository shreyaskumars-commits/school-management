import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { getSession, logout } from "./api.js";
import "./App.css";

// shows the login page until someone logs in; the role decides what App allows
function Root() {
  const [session, setSession] = useState(getSession);

  async function handleLogout() {
    await logout().catch(() => {}); // the local session is cleared either way
    setSession(null);
  }

  if (!session) return <LoginPage onLogin={setSession} />;
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
