import AdminPage from "./AdminPage.jsx";

// what the admin sees: the settings page only (no student table, no chat)
export default function AdminApp({ userId, onLogout }) {
  return (
    <>
      <header className="topbar">
        <h1>Admin Settings</h1>
        <span>
          {userId} &nbsp;
          <button className="btn small" onClick={onLogout}>Log out</button>
        </span>
      </header>
      <AdminPage />
    </>
  );
}
