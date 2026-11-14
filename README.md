# Express Student API

A small REST API for the "Node.js and Backend Development" classroom deck
(`Node_Express_Backend.pptx`). ES modules, Express 5, the `cors` package, an
in-memory array instead of a database.

## Run it

```bash
cd server
npm install
npm start          # or: npm run dev  (restarts on save, uses nodemon)
npm test

# in a second terminal
cd client
npm install
npm run dev        # http://localhost:5173
```

Log in as `principal` / `principal123` (can delete) or `teacher` / `teacher123` (cannot delete).

Server: http://localhost:3000 (needs Node 18 or newer).

The data lives in an array, so it **resets every time the server restarts**.
A real application would store students in a database.

## Endpoints

| Method | URL | What it does | Success |
|---|---|---|---|
| GET | `/` | Welcome message | 200 |
| GET | `/students?department=CSE&page=1&limit=10` | List, filter, paginate | 200 |
| GET | `/students/:id` | One student | 200 |
| POST | `/students` | Create (JSON body) | 201 |
| PATCH | `/students/:id?notify=true` | Change some fields | 200 |
| DELETE | `/students/:id` | Delete | 204 |
| GET | `/classroom/notes` | Needs header `x-classroom-key: learn-node` (middleware activity) | 200 / 401 |
| GET | `/classroom/crash` | Throws on purpose to show the error handler | 500 |

Error codes used: 400 (bad or missing input), 404 (no such student or route),
422 (well-formed but invalid, e.g. `year: 9`), 401 (missing classroom key), 500.

## Test with curl

```bash
curl http://localhost:3000/students
curl "http://localhost:3000/students?department=CSE&page=1&limit=2"
curl http://localhost:3000/students/101
curl -X POST http://localhost:3000/students -H "Content-Type: application/json" -d '{"name":"Zoya","department":"IT","year":2}'
curl -X PATCH "http://localhost:3000/students/101?notify=true" -H "Content-Type: application/json" -d '{"department":"AI"}'
curl -X DELETE http://localhost:3000/students/104
curl http://localhost:3000/classroom/notes -H "x-classroom-key: learn-node"
```

## Insomnia and Postman

`api-tests/` holds the same 24 requests in two formats:

- `college-api.insomnia.json`: Insomnia (Application → Import).
- `college-api.postman.json`: Postman (Import). Every request has a test that checks the status code.

Both use a base URL variable (`base_url` in Insomnia, `baseUrl` in Postman) set to
`http://localhost:3000`. Run the requests from top to bottom against a freshly started
server. Folders: Basics, Students (CRUD), Errors and validation, Middleware activity, CORS.

## CORS in a real browser

The API allows the origin `http://localhost:5173`. The sibling project
`../react-lifting-state` has a **Students API** page that calls this server:

```bash
cd ../react-lifting-state
npm install
npm run dev -- --port 5173      # allowed origin: the list loads
npm run dev -- --port 5175      # any other port: the browser blocks it (see the Console)
```

Insomnia, Postman and curl are not browsers, so they never show a CORS error.

## AI chatbot (CollegeBuddy)

After login, principals and teachers get a chat bubble that answers questions
about student reviews. The principal sees all reviews; a teacher never sees the
confidential ones (filtered in the database query, not in the prompt). An admin
account manages prompts, model settings and the data source and has no chat.

- **V1:** answers from a small JSON seed (5 students, 3 reviews each).
- **V2:** school reviews from MongoDB or an uploaded Excel file, editable
  prompts and temperature, and a teacher remark form.

Setup (needs MongoDB and an OpenAI key):

```bash
cd server
cp .env.example .env     # set OPENAI_API_KEY and LLM_MODEL
npm install
npm start                # http://localhost:3000
```

Demo logins: `principal/principal123`, `teacher/teacher123`, `admin/admin123`.
Without a key the chat returns "AI is not configured correctly." and the rest
of the portal still works. See `PROJECT_SUMMARY.md` for the design, data flow
and API reference.

## Files

| Path | Purpose |
|---|---|
| `server/server.js` | Entry point: starts the server |
| `server/src/app.js` | Builds the Express app: middleware, routes, 404 and error handler |
| `server/src/apis/` | Route definitions (students, auth, classroom) |
| `server/src/controllers/` | Request handlers |
| `server/src/middlewares/` | Logger, auth and roles, validation, loaders, error handlers |
| `server/src/services/` | Login and session logic |
| `server/src/data/`, `config/`, `utils/` | In-memory store, settings, validators |
| `server/tests/` | API tests (`npm test`) |
| `client/` | React front end |
| `api-tests/` | Insomnia and Postman collections |
| `Node_Express_Backend.pptx` | The 48-slide classroom deck (speaker notes on every slide). The code on the "Complete app" slides is the original single-file `server.js` |
