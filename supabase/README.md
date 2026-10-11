# GitHub + Supabase cutover

All pages are built for GitHub Pages. The independent backend is a Postgres RPC, so no Edge Function or service role key is needed by this app.

## Current project

The user-created project **general** (`iheutatkmiwoazmnggoi`, organization `izreenaisya`) is the active backend. Its API is `https://iheutatkmiwoazmnggoi.supabase.co`. All three migrations below are deployed and their filenames match the project's migration history. Lecturer email approval was configured through admin SQL; it is not a browser-controlled role or an Auth account. Auth's confirmation Site URL still needs to be set to the GitHub host URL; its management UI requires sign-in and this connector has no Auth configuration operation. The first lecturer then needs to create and confirm their Auth account on the GitHub dashboard.

- `20261011020837_jom_live_game.sql`: private schema, authorization and game RPC.
- `20261011020858_jom_revision_questions.sql`: 100 original revision questions.
- `20261011021543_jom_answer_player_index.sql`: covering index for the player/room foreign key.

Public REST checks confirmed that anonymous callers cannot list host sessions. A hosted database transaction tested 30 joins, synchronized questions, locked answers, hidden correctness/scores before reveal and full lecturer results. All its fixtures were rolled back. First-account login and a complete game in the published browser remain to be verified after the lecturer chooses their password.

## Deploy in order

1. Use the user-selected project in the chosen Supabase organization. Do not upgrade its plan or enable paid add-ons without authorization.
2. Apply SQL files in `migrations/` in filename order through the Supabase migration connector. Existing D1 migrations are a separate backend and remain immutable.
3. Obtain the project's URL and an enabled `sb_publishable_...` key. These are public client settings. Never use a service role/secret key in Pages.
4. Add the lecturer's explicitly chosen email to `jom_private.approved_emails` using an admin SQL operation. The browser cannot write this list. Confirmed Auth accounts matching that list are bound to a lecturer ID. Disabled lecturer IDs remain disabled. There is no first-user-wins rule.
5. Set the Auth Site URL to the GitHub `host.html` URL and allow that confirmation redirect. The lecturer creates their account and chooses their own password there, confirms the email and signs in. Auth email delivery must be configured/verified for the chosen address; Supabase's default email service may restrict recipients. Do not disable email confirmation to bypass delivery issues.
6. Set `backend` to `supabase` in `config/pages.json`, supply the verified project URL/publishable key and remove `apiBase`. Run checks, `pages:build` and build, then publish the generated root shells and `docs/` to GitHub.
7. Verify the published host login, anonymous student join, synchronized question, hidden score before reveal, locked answer, owner control, private CSV and logout. Only then describe the migration as complete.

## Authorization and concurrency

Private tables have RLS enabled, no browser grants and no public-schema exposure. The Data API exposes only the `public.jom_live` invoker wrapper. It calls the private `jom_private.live_api` function using narrowly granted schema usage and execution privileges; table access remains denied. The privileged code stays in an unexposed schema. Its locked search path, server-verified `auth.uid()`, approved lecturer list and room owner check protect teacher operations. User metadata cannot grant roles. Anonymous students use independent 256-bit tokens; storage contains SHA-256 hashes only. Browser CORS is not an authorization boundary.

Each join, answer and transition locks the room inside one Postgres transaction. The server reads its clock after acquiring that lock. Capacity, unique names, one answer per question, version checks and deadlines are enforced in the database. Snapshots strip correctness and current-round scores until reveal. A lecturer's daily create quota is serialized with an advisory lock.

The tests execute the actual migrations and RPC in PGlite (Postgres WASM) with a simulated Auth schema. PGlite has one connection, so queued calls do not prove concurrent hosted connections. Hosted REST/Auth and actual browser QA remain necessary.

The native security advisor reports only informational [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices for private tables: default-deny is intentional, with no browser table grants and access through the authorized RPC. A newly created covering index may report [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) until real games exercise it. There were no warning or error findings at deployment.

Do not delete the original Site/D1 records during cutover. They remain historical records on the original service unless an authorized export/import is separately verified. Never commit those records.
