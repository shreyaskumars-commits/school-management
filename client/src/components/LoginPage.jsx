import { useState } from "react";
import { login } from "../api.js";

export default function LoginPage({ onLogin }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      onLogin(await login(userId.trim(), password));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main>
      <section className="card">
        <h2>Log in</h2>
        <form onSubmit={handleSubmit}>
          <label>
            User id
            <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <div className="actions">
            <button type="submit" className="btn primary">Log in</button>
          </div>
        </form>
        <p className="message error" role="alert">{error}</p>
      </section>
    </main>
  );
}
