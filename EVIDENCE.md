# Evidence

One piece of proof per Definition-of-Done checkbox (§6 of the brief), based on manual testing performed during development. Real command output and responses, captured as the features were built and verified.

## Widget management

**Authenticated CRUD; requests without valid auth are rejected**

`POST /widgets` with no `Authorization` header:
```json
{ "error": "Access token required" }
```

`POST /widgets` with a valid Supabase bearer token:
```json
{
  "id": 3,
  "type": "contact_form",
  "title": "Acme Contact Us",
  "description": "Get in touch",
  "fields": ["name", "email"],
  "button_text": "Send",
  "created_at": "2026-09-01T02:13:40.114Z",
  "tenant_id": "0545df90-aa51-4570-bc6c-6f735715e50d"
}
```

**Multi-tenant isolation**

`widgets.tenant_id` is set from `req.user.id` (the authenticated Supabase user) on creation. `GET /dashboard/submissions` joins `submissions` to `widgets` and filters `WHERE widgets.tenant_id = $1` using the requesting user's own ID — verified by creating a submission against a widget owned by the test account and confirming it appears in that account's dashboard response, while submissions against an earlier widget with no `tenant_id` do not appear.

## Widget delivery

**Public config endpoint, correct cache headers**

`GET /widgets/1/config` response headers (Postman):
```
Cache-Control: public, max-age=300
Access-Control-Allow-Origin: *
Status: 200 OK
```

**Widget renders on a page from a different origin**

`widget.js` served from `http://localhost:3000`, embedded via `<script src="http://localhost:3000/widget.js?id=1">` on a page served from `http://localhost:5500` (a separate `serve` instance, simulating a customer's website on a different origin/port). Console confirmed the script read its own `id` from the embed URL, fetched config cross-origin, and rendered a real title, two input fields, and a submit button on the page.

## Public submission API

**Cross-origin submissions work (CORS)**

Before `cors()` was added, the browser console showed:
```
Access to fetch at 'http://localhost:3000/public/test' from origin 'http://localhost:5500'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```
After adding `app.use(cors())`, the same cross-origin request succeeded with no error, response body `{message: 'Hello from the widget platfrom'}`.

**Validation — malformed/missing input rejected with clean 4xx**

`POST /submissions` with `data: {"name": "Ahmed"}` against a widget requiring `name, email, phone, residence`:
```json
{ "error": "Missing required fields" }
```
(Status 400.)

`POST /submissions` with `widget_id: 9999` (nonexistent widget):
```json
{ "error": "Widget not found" }
```
(Status 404.)

**Valid submissions stored, linked to the right widget**

```json
{
  "id": 8,
  "widget_id": 1,
  "data": { "name": "Zeyad", "email": "z@z.com", "phone": "010", "residence": "Cairo" },
  "ip_address": "::1",
  "country": null,
  "city": null,
  "created_at": "2026-08-30T17:14:22.409Z"
}
```
(Status 201.)

## Abuse protection

**Rate limiting returns 429 under a burst**

Sending the same valid submission 6 times in under a minute (limit configured at 5/minute per IP): the 6th request returned:
```json
{ "error": "Too many submissions, please try again later." }
```
(Status 429. Requests 1–5 succeeded normally.)

**Honeypot blocks spam without exposing the mechanism**

`POST /submissions` with a non-empty `honeypot` field:
```json
{ "message": "Submission recieved" }
```
(Status 201 — identical shape to a real success response; nothing is actually stored. Verified by checking the honeypot request does not appear in `GET /dashboard/submissions` afterward, while a normal submission sent immediately after does.)

## Enrichment & safe side effects

**Provider fallback chain; submission succeeds even with no geo data**

`enrichIp()` tries `ip-api.com` first, then `ipapi.co` on failure, returning `{country: null, city: null}` if both fail. Tested against `::1` (a non-public loopback address neither provider can resolve): the submission still returned `201` with `country: null, city: null` — the insert never failed even though enrichment had nothing useful to return.

**A failing side effect does not block the submission**

`sendNotification()` is deliberately randomized to fail ~50% of the time (`Math.random() < 0.5`) to prove this under real failure, not just the happy path. Server log across several consecutive submissions:
```
Notification failed (non-critical): Simulated email provider failure
Notification failed (non-critical): Simulated email provider failure
EMAIL: New submission received for widget 1
EMAIL: New submission received for widget 1
Notification failed (non-critical): Simulated email provider failure
```
Every one of these requests still returned `201` to the client, regardless of which outcome occurred — confirmed in Postman across the same test run.

## Known gaps in evidence

No automated test suite exists yet (see README "Known limitations") — all evidence above is from manual testing during development, not a repeatable test command. This is an honest limitation, not an oversight.
