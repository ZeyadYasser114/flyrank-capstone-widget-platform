# Embeddable Widget & Lead-Capture Platform

A platform that lets a customer create an embeddable widget (a contact form, signup form, or popover), get back a single `<script>` tag, and paste it into any website. When a visitor on that external site submits the form, the submission is validated, protected against spam and abuse, enriched with location data, safely stored, and visible to the widget's owner through an authenticated, tenant-isolated dashboard API.

Built as part of the FlyRank Backend Track internship capstone.

## What this actually does — the real-world picture

Think of how a company like Intercom or Mailchimp works: a business signs up, builds a form, pastes one line of code into their own site, and suddenly that form is live — powered entirely by Intercom/Mailchimp's servers, not the business's own backend. This project is the same pattern, built from scratch: this server is the "Intercom," and any website that embeds `widget.js` is the "customer's site."

The defining engineering challenge, unlike a normal backend project: this API receives real requests from browsers on websites it does not control, cannot predict, and has no code visibility into. Every public endpoint treats incoming traffic as untrusted by default.

## Architecture

```
Widget Owner (authenticated, via Supabase)
  └─► POST /widgets, GET /dashboard/submissions
        └─► tenant_id enforced on every write and every read

Customer Website (any origin)
  └─ <script src=".../widget.js?id=123">
       └─► GET /widgets/:id/config   (public · cached · CORS-enabled)
       └─► renders a real form via the DOM
       └─► POST /submissions          (public · CORS · rate-limited)
             ├─► honeypot check          — spam? fake-succeed, never touch the DB
             ├─► widget existence check  — fake widget_id? 404
             ├─► field-contract validation — missing required field? 400
             ├─► geo enrichment: Provider A → (fails) → Provider B → (fails) → store anyway
             ├─► store submission
             └─► notification side effect — may fail, never blocks the response
```

## Tech stack

- Node.js + Express
- PostgreSQL, in Docker, via [`pg`](https://node-postgres.com/)
- [Supabase Auth](https://supabase.com/auth) for widget-owner authentication
- [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) for abuse protection
- [`cors`](https://github.com/expressjs/cors) for cross-origin submission handling
- Plain browser JavaScript (`widget.js`) — no framework — for the embeddable widget itself
- Two free geolocation providers ([ip-api.com](http://ip-api.com), [ipapi.co](https://ipapi.co)) in a fallback chain

## Getting started

### Prerequisites

- Docker Desktop (with WSL2 backend, on Windows)
- Node.js 20+
- A free [Supabase](https://supabase.com/) project

### Setup

```bash
git clone <repository-url>
cd flyrank-capstone-widget-platform
npm install
cp .env.example .env
```

Fill in `.env` with your own Supabase project's URL and anon key (Project Settings → API — never use the `service_role` key here), and a `DATABASE_URL` pointing at a local Postgres container.

### Start the database

```bash
docker run --name widgetdb -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=widgets -p 5433:5432 -v widgetdata:/var/lib/postgresql -d postgres
```

(Runs on port `5433`, deliberately not `5432`, so it doesn't collide with other local Postgres instances.)

### Run the app

```bash
node src/db.js      # creates/updates tables
node src/index.js   # starts the server on http://localhost:3000
```

### Try the embed flow yourself

1. Start a second local server to simulate a customer's website on a different origin:
   ```bash
   npx serve -p 5500
   ```
2. Open `http://localhost:5500/test-site.html` in a browser.
3. It embeds `<script src="http://localhost:3000/widget.js?id=1">` — you should see a real, rendered form (fetched live from the widget's config), which submits directly to this API when filled out and sent.

## Authentication

Widget owners authenticate via Supabase Auth — this server never stores or hashes a password itself; credentials are forwarded to Supabase, and every protected route verifies the resulting JWT with a real network call (`supabase.auth.getUser(token)`), not just local decoding.

```bash
curl -X POST http://localhost:3000/auth/signup -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"yourpassword"}'
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"you@example.com","password":"yourpassword"}'
```

Use the returned `access_token` as `Authorization: Bearer <token>` on protected routes.

## API reference

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | No | Create a widget-owner account |
| `POST` | `/auth/login` | No | Log in, returns access + refresh tokens |
| `POST` | `/widgets` | Yes | Create a widget, tied to the authenticated tenant |
| `GET` | `/widgets/:id/config` | No | Public, cached widget config — what `widget.js` fetches |
| `POST` | `/submissions` | No | Public submission endpoint — CORS, rate-limited, validated |
| `GET` | `/dashboard/submissions` | Yes | Tenant-isolated: only submissions for widgets you own |

### Create a widget

```bash
curl -X POST http://localhost:3000/widgets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"contact_form","title":"Acme Contact Us","description":"Get in touch","fields":["name","email"],"button_text":"Send"}'
```

### Submit to a widget (what a real visitor's browser does)

```bash
curl -X POST http://localhost:3000/submissions \
  -H "Content-Type: application/json" \
  -d '{"widget_id":1,"data":{"name":"Ahmed","email":"ahmed@example.com"}}'
```

## Data model

```
widgets
- id, tenant_id, type, title, description, button_text, created_at
- fields   JSONB — flexible list of question names this widget asks for,
           since different widgets ask for genuinely different things

submissions
- id, widget_id, ip_address, country (nullable), city (nullable), created_at
- data     JSONB — the visitor's actual answers, shaped by whatever
           that specific widget's `fields` asked for
```

`fields` and `data` are stored as JSONB rather than fixed columns deliberately: a contact form and an investor-relations form ask for different information, and a fixed-column schema can't represent both without either wasted empty columns or constant migrations.

A submission does not store `tenant_id` directly — it stores `widget_id`, and the owning tenant is found by joining through the widget it belongs to. This one-step-removed chain (`submission → widget → tenant`) is what `GET /dashboard/submissions` uses to enforce isolation.

## Politeness, abuse protection, and resilience

- **CORS** is enabled globally (`app.use(cors())`) since this API is, by design, meant to be called from arbitrary customer websites.
- **Rate limiting**: 5 submissions per IP per minute on `/submissions`; the 6th request in a burst returns `429`.
- **Spam control**: a honeypot field. A bot that fills it in gets a fake `201` success response — indistinguishable from a real success — so it never learns which field gave it away. The request never touches the database.
- **Geo enrichment fallback chain**: tries `ip-api.com`, then `ipapi.co` on failure, and stores the submission anyway with `country`/`city` as `null` if both fail. A submission never fails because of a third-party outage.
- **Safe side effect**: a (simulated) email notification fires after a submission is stored. Its failure is caught and logged, never allowed to affect the response already sent to the visitor.

## Project structure

```
.
├── src/
│   ├── index.js                        # Express app, all routes, middleware
│   ├── db.js                           # Postgres connection + schema
│   └── services/
│       ├── enrichment.service.js       # geo provider fallback chain
│       ├── notifications.service.js    # safe side-effect notification
│       └── supabase.js                 # Supabase client
├── widget.js                           # the embeddable script (served statically)
├── test-site.html                      # simulated customer website for testing
├── DESIGN.md                           # Phase 1 design doc
├── EVIDENCE.md                         # proof per Definition-of-Done item
├── BUILDLOG.md                         # honest AI-usage log
├── capstone.yaml                       # evaluator manifest
├── .env.example
└── package.json
```

## Known limitations

- **No automated test suite yet.** Everything documented in `EVIDENCE.md` was verified manually (via Postman and the browser console) during development, not via a repeatable `npm test` command. This is the single biggest gap against the brief's Definition of Done.
- **No `PUT`/`DELETE` on widgets, and no `GET /widgets` (list)** — only creation exists. Full CRUD was scoped down to focus development time on the harder, more novel parts of the brief (CORS, rate limiting, the fallback chain, safe side effects) rather than repeating CRUD patterns already built in an earlier assignment.
- **Only one spam-control technique** (honeypot) rather than multiple layered defenses.
- **Static files are served from the entire project root** (`express.static(path.join(__dirname, '..'))`), which is a known simplification — a production system would serve only specific safe assets, not the whole folder.
- **No drag-and-drop widget-builder UI** — this was an explicit non-goal from the Phase 1 design doc; widget configuration happens directly through the authenticated API.

## License

MIT
