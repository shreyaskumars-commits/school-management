import { useEffect, useRef, useState } from "react";
import { getChatHistory, clearChatHistory, streamChat } from "../api.js";


const SUGGESTIONS = {
  principal: [
    "Which students need attention?",
    "Show confidential reviews for Ravi",
    "Who has the best reviews?",
  ],
  teacher: [
    "Which students need attention?",
    "Summarise Asha's reviews",
    "Who has the best reviews?",
  ],
};

export default function ChatWidget({ role }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);
  const abortRef = useRef(null);
  const endRef = useRef(null);

  // load the saved conversation the first time the window opens
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    getChatHistory()
      .then((data) => setMessages(data?.messages ?? []))
      .catch((err) => setError(err.message));
  }, [open]);

  // keep the newest text in view
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, open]);

  // stop a running reply if the widget goes away
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text) {
    const message = text.trim();
    if (!message || sending) return;
    setError("");
    setInput("");
    setSending(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(
        message,
        (piece) =>
          setMessages((m) => {
            const copy = m.slice();
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + piece };
            return copy;
          }),
        controller.signal,
      );
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        // drop the empty assistant bubble when nothing arrived
        setMessages((m) =>
          m.at(-1)?.content === "" ? m.slice(0, -1) : m,
        );
      }
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    try {
      await clearChatHistory();
      setMessages([]);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {open && (
        <section
          className="chat-window"
          role="dialog"
          aria-label="CollegeBuddy chat"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <header className="chat-head">
            <strong>CollegeBuddy</strong>
            <button
              className="chat-icon"
              onClick={handleClear}
              disabled={sending || messages.length === 0}
              title="Clear chat"
              aria-label="Clear chat"
            >
              Clear
            </button>
            <button
              className="chat-icon"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div className="chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p>Ask me about student reviews.</p>
                {(SUGGESTIONS[role] ?? []).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chat-chip"
                    onClick={() => send(s)}
                    disabled={sending}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              // plain text only: React escapes it, never render model output as HTML
              <div key={i} className={`chat-bubble ${m.role}`}>
                {m.content || (sending && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a question"
              aria-label="Message"
              maxLength={2000}
              autoFocus
            />
            <button className="btn" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        aria-expanded={open}
      >
        {open ? "×" : "💬"}
      </button>
    </>
  );
}
