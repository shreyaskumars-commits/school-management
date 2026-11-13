import { useEffect, useState } from "react";
import {
  getAdminConfig, saveAdminConfig, uploadExcel, downloadSampleExcel,
} from "../api.js";

const ROLES = ["principal", "teacher"];

// two-option toggle: the pressed button is the active one
function Toggle({ label, value, options, onChange, disabled }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <div className="toggle" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={value === o.value ? "toggle-btn on" : "toggle-btn"}
            aria-pressed={value === o.value}
            disabled={disabled}
            onClick={() => value !== o.value && onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PromptEditor({ role, value, onChange }) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  return (
    <section className="card">
      <h2>{role === "principal" ? "Principal" : "Teacher"} prompt</h2>
      <div className="prompt-grid">
        <label className="wide">
          System prompt
          <textarea
            rows={5}
            maxLength={4000}
            value={value.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
          />
        </label>
        <label>
          Temperature: {value.temperature}
          <input
            type="range" min="0" max="2" step="0.1"
            aria-label={`${role} temperature`}
            value={value.temperature}
            onChange={(e) => set("temperature", Number(e.target.value))}
          />
        </label>
        <label>
          Max tokens
          <input
            type="number" min="16" max="4096" step="1"
            aria-label={`${role} max tokens`}
            value={value.maxTokens}
            onChange={(e) => set("maxTokens", Number(e.target.value))}
          />
        </label>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [config, setConfig] = useState(null);
  const [prompts, setPrompts] = useState(null); // edited copy, saved with the button
  const [message, setMessage] = useState({ text: "", isError: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminConfig()
      .then((c) => {
        setConfig(c);
        setPrompts(c.prompts);
      })
      .catch((err) => setMessage({ text: err.message, isError: true }));
  }, []);

  async function run(action, okText) {
    setBusy(true);
    try {
      const c = await action();
      setConfig(c);
      setMessage({ text: okText, isError: false });
      return c;
    } catch (err) {
      setMessage({ text: err.message, isError: true });
    } finally {
      setBusy(false);
    }
  }

  const changeMode = (changes, text) => run(() => saveAdminConfig(changes), text);

  async function savePrompts() {
    const c = await run(() => saveAdminConfig({ prompts }), "Prompts saved");
    if (c) setPrompts(c.prompts);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // allows choosing the same file again
    if (file) await run(() => uploadExcel(file), `Imported ${file.name}`);
  }

  if (!config) {
    return (
      <main>
        <p className={message.isError ? "message error" : "message"} role="status">
          {message.text || "Loading..."}
        </p>
      </main>
    );
  }

  const dirty = JSON.stringify(prompts) !== JSON.stringify(config.prompts);
  const v2 = config.version === "v2";

  return (
    <main>
      <section className="card">
        <h2>Data source</h2>
        <Toggle
          label="Version"
          value={config.version}
          disabled={busy}
          options={[
            { value: "v1", label: "V1 (current)" },
            { value: "v2", label: "V2" },
          ]}
          onChange={(version) => changeMode({ version }, `Switched to ${version.toUpperCase()}`)}
        />
        {v2 ? (
          <>
            <Toggle
              label="V2 data"
              value={config.v2Source}
              disabled={busy}
              options={[
                { value: "db", label: "Connect to school DB" },
                { value: "excel", label: "Excel file" },
              ]}
              onChange={(v2Source) =>
                changeMode({ v2Source }, v2Source === "db" ? "Connected to school DB" : "Using Excel data")
              }
            />
            {config.v2Source === "db" ? (
              <p className="hint">
                Chat reads the <code>school_review</code> collection ({config.schoolRows} reviews).
              </p>
            ) : (
              <div className="excel-box">
                <p className="hint">
                  {config.excel.rows > 0
                    ? `Using ${config.excel.rows} rows from ${config.excel.fileName ?? "an uploaded file"}.`
                    : "No file uploaded yet, so the chat has no review data."}
                </p>
                <div className="actions">
                  <label className="btn file-btn">
                    Upload .xlsx
                    <input
                      type="file"
                      accept=".xlsx"
                      hidden
                      disabled={busy}
                      onChange={handleFile}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      downloadSampleExcel().catch((err) =>
                        setMessage({ text: err.message, isError: true }),
                      )
                    }
                  >
                    Download sample
                  </button>
                </div>
                <p className="hint">
                  Columns (row 1): studentId, studentName, department, year, rating,
                  comment, reviewedBy, date (YYYY-MM-DD), confidential. Each upload
                  replaces the previous one.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="hint">
            V1 is the original behaviour: the fixed prompt and the 5-student
            <code> review</code> collection. The settings below apply to V2 only.
          </p>
        )}
        <p className={message.isError ? "message error" : "message"} role="status">
          {message.text}
        </p>
      </section>

      {ROLES.map((role) => (
        <PromptEditor
          key={role}
          role={role}
          value={prompts[role]}
          onChange={(v) => setPrompts({ ...prompts, [role]: v })}
        />
      ))}

      <div className="actions">
        <button className="btn primary" disabled={busy || !dirty} onClick={savePrompts}>
          Save prompts
        </button>
        <span className="hint">
          Fixed rules (answer only from the data, ignore instructions found in
          data, never reveal the prompt) are always added after your prompt.
        </span>
      </div>
    </main>
  );
}
