# Project Summary: College Portal + CollegeBuddy AI Chatbot

## 1. What this is

A Student Management Portal (Express + MongoDB + React) with an AI assistant,
**CollegeBuddy**, that answers questions about student reviews. What the
assistant can see depends on who is logged in.

| Folder | What it is | API / UI ports |
|---|---|---|
| `server/` | Express API: student CRUD, login, roles, chatbot, admin settings, remarks | 3000 |
| `client/` | React app: student table, chat bubble, admin page, remark form | 5173 |
| `api-tests/` | Postman and Insomnia collections for the student API | n/a |

The chatbot was added on the `feature/chatbot` branch in four steps: V1 (chat
over a JSON seed), admin and V2 (settings, school reviews), Excel import, and
teacher remarks. Everything below describes the chatbot features.

**Stack:** Node (ES modules), Express 5, Mongoose 9, OpenAI SDK (streaming chat
completions), `exceljs`, `express-rate-limit`; React 19, Vite; tests with
`node:test` (server) and Vitest + Testing Library (client).

**Demo logins:** `principal/principal123`, `teacher/teacher123`, `admin/admin123`.

---

## 2. Roles and who can do what

| Capability | Teacher | Principal | Admin |
|---|---|---|---|
| Student table (view, add, edit) | yes | yes | no |
| Delete student | no | yes | no |
| Chat with CollegeBuddy | yes | yes | no (403) |
| See open (non-confidential) reviews in chat | yes | yes | n/a |
| See **confidential** reviews in chat | **no** | **yes** | n/a |
| Add a remark (V2 + school DB only) | yes (UI button) | no button | no (403) |
| Edit prompts, temperature, max tokens | no | no | yes |
| Switch V1/V2, DB/Excel, upload Excel | no | no | yes |

Enforcement is on the server (`requireLogin`, `requireRole`); hiding a button
in React is only a convenience.

---

## 3. Authentication and sessions

- `POST /login` checks the password (scrypt hash, constant-time compare) and
  returns a random 24-byte token plus the role.
- Sessions live in an in-memory `Map` (token -> `{userId, role, id}`), so a
  server restart logs everyone out. This is a deliberate classroom-scale
  choice; production would use a store such as Redis or signed tokens.
- The client sends `Authorization: Bearer <token>` and keeps the session in
  `sessionStorage` (per tab).
- **The role always comes from the session, never from the request body.**
  A user cannot claim to be a principal by sending `{"role":"principal"}`.
- Demo accounts are seeded on startup. The `admin` account is also added to
  databases that already have users.

---

## 4. The AI workflow, step by step

A chat message, from keystroke to saved history:

```
Browser (ChatWidget)                    Express (server)                 OpenAI
--------------------                    ------------------------                 ------
1. user types, presses Send
2. add user bubble + empty
   assistant bubble to the UI
3. fetch POST /chat {message}  ------>  4. requireLogin  (401 if no session)
   (AbortController attached)           5. block admin  (403)
                                        6. chatLimiter: 10 msgs/min per user (429)
                                        7. validate message: 1..2000 chars (400)
                                        8. Conversation.reserveMessage():
                                           atomic daily quota, 50/day (429)
                                        9. build the prompt (section 5)
                                       10. llm.startChatStream(...) ----------->  11. model streams
                                       12. for each delta: res.write(piece) <----     tokens back
13. reader.read() gets a chunk  <----- (plain-text chunked HTTP response)
14. append chunk to the assistant
    bubble (live typing effect)
                                       15. res.end()
                                       16. save user msg + full reply to the
                                           conversation (keep newest 200)
```

### 4.1 How streaming works

- The server calls the OpenAI SDK with `stream: true`. The SDK returns an
  async iterable of chunks; each `chunk.choices[0].delta.content` is a few
  characters of the reply.
- Each piece is written straight to the HTTP response with `res.write(piece)`.
  The response is `Content-Type: text/plain` with chunked transfer encoding.
  There is **no SSE or WebSocket**: a plain streamed `fetch` body is enough
  because the traffic is one-way (server to browser) per request.
- The client uses `fetch` (not axios, which waits for the whole body) and
  reads `res.body.getReader()` in a loop, decoding with a streaming
  `TextDecoder` so multi-byte characters split across chunks are not broken.
  Each decoded piece is appended to the last assistant message in React state.
- The client strips Markdown bold markers (`**`) from each chunk because the
  chat bubble renders plain text. A marker split across two chunks could slip
  through; this is a known cosmetic limitation.

### 4.2 Cancelling and failure handling

- **User closes the chat mid-reply:** the client aborts the fetch. On the
  server, `res.on("close")` fires while `res.writableEnded` is still false, so
  an `AbortController` cancels the OpenAI request and we stop paying for
  tokens. The aborted turn is still saved with whatever was received.
- **Failure before streaming starts** (bad key, rate limit, timeout): headers
  are not sent yet, so the server answers with a real status code and a
  friendly JSON error (`toFriendlyError`): 429 "AI is busy", 500 "took too
  long", 500 "not configured correctly". Details are logged server-side only.
- **Failure after streaming started:** the status is already 200, so the
  server cannot change it. It appends `[Sorry, the reply was cut off...]` and
  ends the response.
- The OpenAI client has a 30 s per-attempt timeout and 2 automatic retries
  (429, 5xx, timeouts).
- If `OPENAI_API_KEY` or `LLM_MODEL` is missing the app still runs; chat
  answers "AI is not configured correctly."

### 4.3 Conversation memory

- One `conversation` document per user (unique index on `user`) holding the
  message list, capped to the newest 200 (`$push` with `$slice: -200`).
- The model is stateless, so each request re-sends history. `trimHistory`
  walks backwards from the newest message and keeps messages until a budget of
  about 3000 tokens or 20 messages is reached. Token count is estimated as
  `characters / 4`, which is cheap and good enough for a budget (not exact).
- `GET /chat/history` returns the last 50 messages for display;
  `DELETE /chat/history` clears them.
- The user message and the reply are saved **after** the stream finishes, in
  one `$push`. If saving were done before, a failed model call would leave a
  question without an answer in the history.

### 4.4 Usage limits (cost and abuse control)

Two independent layers:

1. **Per-minute:** `express-rate-limit`, 10 requests per minute, keyed by user
   id (falls back to IP). Stops bursts and runaway loops.
2. **Per-day quota:** 50 messages per user per UTC day, stored in
   `conversation.usage`. `reserveMessage` does three small updates: create the
   document if missing, reset the counter on a new day, then
   `findOneAndUpdate({count: {$lt: 50}}, {$inc: {count: 1}})`. The last step is
   a single atomic operation, so two parallel requests cannot both take the
   last slot. The quota is reserved **before** calling the model.

A message is limited to 2000 characters, checked server-side.

---

## 5. How the prompt is built (and why role-based access is safe)

Every request builds a fresh message list:

```
[ system: persona + locked rules + REVIEW DATA (filtered for this role) ]
[ ...trimmed history ]
[ user: the new message ]
```

### 5.1 Role-based data division

`reviewFilterFor(role)` returns a MongoDB filter:

| Role | Filter | Result |
|---|---|---|
| principal | `{}` | all reviews |
| teacher | `{confidential: {$ne: true}}` | open reviews only |
| anything else | `null` | no data at all |

**The filter is applied to the database query, not to the prompt text.**
Confidential rows for a teacher are never read from the database, so they are
never sent to the model and cannot leak through jailbreaks, clever questions
or prompt-injection. A line in the system prompt saying "don't reveal
confidential data" is *not* a security boundary; withholding the data is.

### 5.2 Prompt-injection hardening

The fixed rules, appended to every prompt, tell the model to answer only from
the data, to say it lacks access when the data does not cover a question, to
refuse unrelated or harmful requests, to never reveal its instructions, and to
treat any text inside the review data or user messages as data, never as new
instructions. These rules reduce risk but are a second line of defence; the
first is the data filtering above.

### 5.3 Review data formatting

Each review becomes one line (student name, id, department, year, rating,
date, reviewer, a `CONFIDENTIAL` tag, comment). Compact text keeps token cost
low. The whole filtered data set is placed in the prompt (no retrieval/vector
search): fine for tens or hundreds of reviews, and it would need retrieval or
summarising at larger scale.

---

## 6. Admin settings and the V1 / V2 modes

The admin page controls everything through one document in the `setting`
collection (key `main`, created with defaults on first read).

### 6.1 Version toggle

| Mode | Prompt | Review data source | Model options |
|---|---|---|---|
| **V1** (default) | Original fixed prompt | `review` collection (5 students, from `reviews.json`) | provider defaults |
| **V2 > school DB** | Admin-edited persona + locked rules | `school_review` (10 students, 1-3 reviews each) | admin temperature / max tokens |
| **V2 > Excel** | same as above | `excel_review` (parsed from uploaded `.xlsx`) | same |

V1 is kept byte-for-byte as the original behaviour, so switching back is a
safe rollback. The role filter in 5.1 applies to **all three** sources.

### 6.2 Editable prompt, locked rules

The admin edits only the persona/tone part of the prompt per role (principal,
teacher), plus temperature (0-2) and max tokens (16-4096). The security rules
(5.2) live in code (`LOCKED_RULES`) and are appended after the editable text,
so an admin edit, a typo, or a compromised admin account cannot remove the
data-only and anti-injection rules. Role filtering is code, not prompt, so it
is also unaffected.

All values are validated on the server (type, range, integer tokens, prompt
length 1-4000); the UI limits are only a convenience. Settings are read on
every chat request, so changes apply to the next message without a restart.

### 6.3 Excel upload

- The browser sends the file as raw bytes (`application/octet-stream`,
  5 MB limit) with the file name in an `X-File-Name` header. This avoids a
  multipart library (`multer`) for a single file.
- `exceljs` reads the first sheet. Row 1 must contain the columns
  `studentId, studentName, department, year, rating, comment, reviewedBy,
  date, confidential` (case-insensitive; `confidential` optional).
- Every row is validated (year 1-4, rating 1-5, date `YYYY-MM-DD`, etc.).
  If **any** row is bad, the whole upload is rejected with up to five readable
  messages and **nothing is written**, so the collection is never half-updated.
  A good upload replaces the previous one. Max 5000 rows.
- `GET /admin/sample.xlsx` generates a valid workbook from the mock data.

### 6.4 Teacher remarks

`POST /remarks` (`rating` 1-5, `comment` up to 500 chars) looks the student up
in the main `student` collection, copies name/department/year into a new
`school_review` document, and stamps today's date and the author's role.
Remarks are always non-confidential because teachers cannot read confidential
reviews. The endpoint returns 409 unless the mode is V2 + school DB, which is
also why the button is disabled in V1 and Excel mode (the client re-checks the
mode when the browser tab regains focus; the server check is the real guard).

---

## 7. Data model (MongoDB, database `School`)

| Collection | Purpose | Key fields |
|---|---|---|
| `student` | Students (numeric auto-increment `id`) | id, name, department, year |
| `user` | Logins | Username, Password (scrypt hash), role (principal/teacher/admin) |
| `review` | V1 review data | studentId, studentName, department, year, rating, comment, reviewedBy, date, confidential |
| `school_review` | V2 school DB (same shape as `review`) | same |
| `excel_review` | V2 Excel rows (same shape) | same |
| `conversation` | Chat history + daily usage, one per user | user, messages[], usage{date,count} |
| `setting` | Admin configuration, single doc | version, v2Source, prompts{principal,teacher}, excel file info |
| `counter` | Auto-increment helper for student ids | |

Student details are **copied** into each review (denormalised) so the
chatbot's data does not depend on the student collection and one query returns
everything the prompt needs.

---

## 8. API reference (server)

| Method + path | Who | Notes |
|---|---|---|
| `POST /login`, `POST /logout` | public / any | session token |
| `GET/POST/PATCH/DELETE /students...` | logged in (delete: principal) | original CRUD |
| `POST /chat` | teacher, principal | streamed plain text |
| `GET /chat/history`, `DELETE /chat/history` | teacher, principal | |
| `GET /config` | any logged in | `{version, source, remarksEnabled}` |
| `POST /remarks` | teacher (principal allowed by API) | V2 + DB only |
| `GET/PUT /admin/config` | admin | modes, prompts, temp, tokens |
| `POST /admin/excel` | admin | raw `.xlsx` body |
| `GET /admin/sample.xlsx` | admin | download |

---

## 9. Key technical decisions and trade-offs

| Decision | Why | Trade-off / what changes in production |
|---|---|---|
| Filter data in the DB query per role | Only real security boundary against leaks and prompt injection | Needs one query per request (cheap at this size) |
| Locked rules in code, persona editable | Admin flexibility without weakening safety | Admin cannot change the safety wording |
| Plain-text `fetch` streaming, no SSE/WebSocket | Simplest thing that gives live typing; one-way data | No structured events (e.g. usage, tool calls); SSE would add these |
| Reserve quota atomically before the model call | No race on the last message; no free calls | A failed model call still consumes one message |
| Save messages after the stream ends | History never holds unanswered questions | A server crash mid-stream loses that turn |
| Token estimate `chars/4` | No tokenizer dependency | Approximate; real tokenizer for tight budgets |
| In-memory sessions | Zero setup for a demo | Lost on restart, single instance only |
| Single global fixed salt for password hashes | Demo simplicity | Production: per-user random salt, or bcrypt/argon2 |
| Whole review set in the prompt | No retrieval infrastructure | Does not scale to thousands of reviews |
| Excel as raw-bytes upload, all-or-nothing import | No multipart dependency; no partial data | 5 MB / 5000-row cap |
| Config applied to V2 only, V1 frozen | Safe rollback to known behaviour | Admin edits have no effect in V1 (UI says so) |
| Separate `School_test` database for tests, fake model | Real data and the OpenAI bill are never touched | Real model behaviour is not covered by tests |

### Known limitations

- The admin password is a well-known demo value; change it before any real use.
- CORS allows one fixed origin (`http://localhost:5173`).
- Sessions have no expiry besides restart.
- Some OpenAI models reject a custom `temperature`; if `LLM_MODEL` is one of
  them, V2 chats will return an error until the admin's temperature handling
  is adjusted for that model.
- Markdown bold stripping is per chunk (see 4.1).

---

## 10. Running and testing

```bash
# API (needs MongoDB on localhost:27017 and an OpenAI key for real answers)
cd server && npm install
# create server/.env with OPENAI_API_KEY=... and LLM_MODEL=...
# (optional: MONGO_URI, PORT, CHAT_DAILY_LIMIT, CHAT_PER_MINUTE)
npm start                 # http://localhost:3000
npm test                  # 58 tests, School_test database, fake model

# React app
cd client && npm install
npm run dev               # http://localhost:5173
npm test                  # 50 tests
```

Test coverage highlights: role filtering (teacher never sees confidential
text), history trimming, per-minute limiting, streaming and partial-failure
handling, admin access control, config validation, V1 unchanged, V2 DB/Excel
data sources, Excel import validation and all-or-nothing behaviour, remarks
validation and mode gating, and the admin/teacher UI.
