# GitHub + Supabase cutover

All pages are built for GitHub Pages. The independent backend is a Postgres RPC, so no Edge Function or service role key is needed by this app.

## Deploy in order

1. Provision `psychology-game` in the chosen Supabase organization. Do not upgrade its plan or enable paid add-ons without authorization.
2. Apply the two SQL files in `migrations/` in filename order through the Supabase migration connector. Existing D1 migrations are a separate backend and remain immutable.
3. Obtain the project's URL and an enabled `sb_publishable_...` key. These are public client settings. Never use a service role/secret key in Pages.
4. Add the lecturer's explicitly chosen email to `jom_private.approved_emails` using an admin SQL operation. The browser cannot write this list. Confirmed Auth accounts matching that list are bound to a lecturer ID. Disabled lecturer IDs remain disabled. There is no first-user-wins rule.
5. The lecturer creates their account and chooses their own password on `host.html`, confirms the email and signs in. Auth email delivery must be configured/verified for the chosen address; Supabase's default email service may restrict recipients. Do not disable email confirmation to bypass delivery issues.
6. Set `backend` to `supabase` in `config/pages.json`, supply the verified project URL/publishable key and remove `apiBase`. Run checks, `pages:build` and build, then publish the generated root shells and `docs/` to GitHub.
7. Verify the published host login, anonymous student join, synchronized question, hidden score before reveal, locked answer, owner control, private CSV and logout. Only then describe the migration as complete.

## Authorization and concurrency

Private tables have RLS enabled, no browser grants and no public-schema exposure. Only `public.jom_live` is executable by `anon`/`authenticated`. Its locked search path, server-verified `auth.uid()`, approved lecturer list and room owner check protect teacher operations. User metadata cannot grant roles. Anonymous students use independent 256-bit tokens; storage contains SHA-256 hashes only. Browser CORS is not an authorization boundary.

Each join, answer and transition locks the room inside one Postgres transaction. The server reads its clock after acquiring that lock. Capacity, unique names, one answer per question, version checks and deadlines are enforced in the database. Snapshots strip correctness and current-round scores until reveal. A lecturer's daily create quota is serialized with an advisory lock.

The tests execute the actual migrations and RPC in PGlite (Postgres WASM) with a simulated Auth schema. PGlite has one connection, so queued calls do not prove concurrent hosted connections. Hosted REST/Auth and actual browser QA remain necessary.

Do not delete the original Site/D1 records during cutover. They remain historical records on the original service unless an authorized export/import is separately verified. Never commit those records.
