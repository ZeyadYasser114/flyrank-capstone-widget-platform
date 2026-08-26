# Design — Embeddable Widget & Lead-Capture Platform

## Problem

Businesses (like Acme Steel) want a form — a "Contact Us" box, a signup form, a popover — on their website, without building or hosting the form-handling logic themselves. This platform lets a customer create a widget through an authenticated dashboard and get back a single `<script>` tag. They paste that tag into their own website. When a visitor on that site fills out the form, the submission is not stored on the customer's own server — it travels to this platform's server instead, the same way a YouTube "like" on an embedded video is recorded by YouTube, not by the website that embedded the video.

The core difficulty: this system receives requests directly from browsers on websites it does not control. Every public endpoint must treat incoming traffic as untrusted.

## The three actors

1. **Widget owner** — a customer (e.g. someone at Acme Steel) who logs into the platform, creates and manages widgets, and views submissions.
2. **Visitor** — an anonymous person browsing the customer's website who fills out the embedded form. Has no account on this platform.
3. **The customer's website** — not a person; just where the widget's script tag is pasted and rendered.

## Data model

```
tenants
- id            (unique identifier)
- email
- created_at

widgets
- id              (unique identifier — this is the "abc123" referenced in the embed snippet)
- tenant_id       (which tenant owns this widget)
- type            ("signup_form" | "cta" | "popover")
- title
- description
- fields          (JSONB — the list of questions this widget asks, e.g. ["name","email","phone","residence"];
                    flexible because different widgets ask different things — an investor widget might ask for
                    "investment_range" instead of "residence")
- button_text
- created_at

submissions
- id           (unique identifier)
- widget_id    (which widget this came through — the link back to the owning tenant)
- data         (JSONB — the visitor's actual answers, shaped by whatever that widget's `fields` asked;
                 flexible for the same reason `widgets.fields` is flexible: different widgets, different answers)
- ip_address   (the visitor's IP — used for rate limiting and geo enrichment)
- country      (nullable — filled in by geo enrichment, may be absent if enrichment fails)
- city         (nullable — same as above)
- created_at
```

**Why the tenant link is one step removed:** a submission does not store "tenant_id" directly. It stores `widget_id`. To find out which tenant owns a submission, the system looks up the widget the submission came through, and that widget already records its owning `tenant_id`. This chain — `submission → widget → tenant` — is how tenant isolation is enforced: every query for "show me my submissions" starts by finding the tenant's own widgets, then only pulls submissions tied to those specific widget IDs.

## API surface

**Widget owner (authenticated)**
- `POST /widgets` — create a widget
- `GET /widgets` — list this tenant's widgets
- `GET /widgets/:id` — get one widget (must belong to the requesting tenant)
- `PUT /widgets/:id` — update a widget
- `DELETE /widgets/:id` — delete a widget
- `GET /dashboard/submissions?widget_id=` — view submissions for one of this tenant's widgets, with basic stats

**Customer website (public, cached)**
- `GET /widgets/:id/config` — public, cached widget config (title, fields, button text)
- `GET /widget.js` — the versioned embeddable script

**Website visitor (public, cross-origin)**
- `POST /submissions` — the public form-submission endpoint: CORS-enabled, rate-limited, spam-checked, validated, enriched with geo data, stored

## Layer sketch

```
routes/           — HTTP layer: parses requests, calls services, formats responses
services/
  widgets.service.js       — widget CRUD + tenant-isolation checks
  submissions.service.js   — validation, rate limiting, spam check, enrichment, storage
  enrichment.service.js    — geo provider fallback chain (Provider A → Provider B → none)
repositories/
  widgets.repository.js     — raw DB queries for widgets
  submissions.repository.js — raw DB queries for submissions
middleware/
  auth.js         — verifies the widget owner is authenticated (same pattern as the todo-api's requireAuth)
  cors.js          — CORS handling for public endpoints
  rateLimit.js      — per-IP / per-widget rate limiting
```

Routes never touch the database directly — they call services, services call repositories. Same layered pattern used in earlier assignments, extended here with `enrichment.service.js`, which owns the geo-provider fallback logic in one place.

## Non-goal

This capstone will not build a visual, drag-and-drop widget-builder UI. Widgets are configured directly through the authenticated API (or a minimal static form) — not a polished no-code editor. The engineering challenge, and the grade, live in how the backend handles untrusted, cross-origin, high-volume traffic — not in frontend tooling.
