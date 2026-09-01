# Build log — AI usage

This project was built with Claude as a learning-focused pair, not a code generator. The approach for almost every route and function: understand the concept and the "why" first (with an analogy or a walkthrough of the real-world scenario), then write the code myself, with Claude reviewing and pointing out bugs rather than rewriting it.

## Where AI helped

- Explaining new concepts before writing code: CORS (via a "doorman at an apartment building" analogy), rate limiting (a coffee shop with one barista), fallback chains (calling a second restaurant if the first is busy), and the honeypot spam pattern.
- Reviewing code I wrote and pointing out specific bugs — logic inversions (`if (!x)` vs `if (x)`), variable shadowing (`const` re-declaring a variable inside a block instead of assigning the outer one), missing `await`, and SQL syntax errors — without rewriting the code for me.
- Diagnosing environment issues: a recurring WSL2 optional-component deactivation on Windows, Docker Desktop disk-space and disk-location problems, and a stray duplicate Node process holding a port.

## Where it was wrong, or where I had to push back

- Multiple times, code was handed to me with wrong variable naming that I had to fix.
- A `.env` file was rewritten with the wrong `DATABASE_URL` while updating Supabase credentials — pointed at the wrong project's database — caught by checking before running anything.
- `src/db.js` was accidentally reduced to just the `init()` function body at some point, losing the `Pool` setup and `module.exports` line — this caused `pool.query is not a function` errors downstream in `/widgets`.

## What I changed or decided myself

- Chose to reuse a single existing Supabase project (already set up for a separate `CRUD-todo-api` project) rather than provisioning a new one — a deliberate scope decision to save setup time, since nothing in the brief requires per-project isolation of the Identity Provider.
- Decided the honeypot check should run before the widget-existence database query, for efficiency — reasoning through the general "cheap checks before expensive checks" principle before writing the code.
- Chose to keep the widget field list flexible (JSONB) rather than fixed columns, after reasoning through a concrete example (a contact form vs. an investor-relations form needing different fields).
