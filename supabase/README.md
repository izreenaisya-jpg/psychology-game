# GitHub + Supabase cutover

All pages are built for GitHub Pages. The independent backend is a Postgres RPC, so no Edge Function or service role key is needed by this app.

## Current project

The user-created project **general** (`iheutatkmiwoazmnggoi`, organization `izreenaisya`) is the active backend. Its API is `https://iheutatkmiwoazmnggoi.supabase.co`. All four migrations below are deployed and their filenames match the project's migration history. Lecturer email approval was configured through admin SQL; it is not a browser-controlled role or an Auth account. Google OAuth with PKCE is enabled according to public Auth settings, and the lecturer has completed login and returned to GitHub. Google creates/signs in the Auth account automatically, without a separate password signup. Provider credentials and URL settings remain owner-managed; the connector has no Auth configuration operation.

- `20261011020837_jom_live_game.sql`: private schema, authorization and game RPC.
- `20261011020858_jom_revision_questions.sql`: 100 original revision questions.
- `20261011021543_jom_answer_player_index.sql`: covering index for the player/room foreign key.
- `20261011025635_jom_host_sessions_alias.sql`: fixes the ambiguous room alias that blocked the sessions dashboard after login. The guarded migration changes only that query, preserving function ownership, grants, search path and authorization.

Public REST checks confirmed that anonymous callers cannot list host sessions, and the GitHub-origin CORS preflight succeeded. Previous browser checks verified the student join form, invalid-PIN API response, student host-route guard and lecturer login gate. A hosted database transaction tested 30 joins, synchronized questions, locked answers, hidden correctness/scores before reveal and full lecturer results. After the dashboard fix, hosted SQL QA using the actual approved lecturer identity also passed empty/populated sessions, PIN creation, player join, answer privacy, reveal, results and finish. All QA fixtures were rolled back. Regression tests now cover the dashboard before games exist, owned sessions and exclusion of other lecturers' sessions, alongside Google PKCE binding, callback cleanup, expired/unsolicited codes, cancelled consent, disabled providers, blocked storage, session/JWT separation and forged student sign-in actions. A complete game in the published browser remains to be verified after the lecturer refreshes the dashboard.

## Enable Google login

Follow [Supabase's Google login guide](https://supabase.com/docs/guides/auth/social-login/auth-google). Use an existing Google Cloud project or an owner-created one; no billing upgrade is required by this app. Configure the Google Auth Platform audience, branding and only the normal `openid`, email and profile scopes. When the Google app is in testing, add the approved lecturer email as a test user.

Create/use a **Web application** OAuth client with these settings:

| Setting | Value |
| --- | --- |
| Google authorized JavaScript origin | `https://izreenaisya-jpg.github.io` |
| Google authorized redirect URI | `https://iheutatkmiwoazmnggoi.supabase.co/auth/v1/callback` |
| Supabase Auth Site URL | `https://izreenaisya-jpg.github.io/psychology-game/host.html` |
| Supabase additional redirect URL | `https://izreenaisya-jpg.github.io/psychology-game/host.html` |

Enter the OAuth Client ID and Client Secret directly in **general → Authentication → Sign In / Providers → Google**, enable the provider and save. Keep the secret in Supabase; never send it to chat or commit it to GitHub. Leave nonce/email verification protections enabled. Keep signup enabled so a first Google sign-in can create the account; the separate approved-email and owner checks still enforce host privileges.

The callback opens the exact current `host.html` path, exchanges an auth code with its tab's one-time random verifier and clears callback parameters before API requests. It never accepts access/refresh tokens supplied in the URL fragment. Google identity alone does not grant host access: a confirmed email must match the admin-controlled approval list. Reload the host page after enabling the provider; the button reads live Auth settings and becomes available without another code deployment.

## Deploy in order

1. Use the user-selected project in the chosen Supabase organization. Do not upgrade its plan or enable paid add-ons without authorization.
2. Apply SQL files in `migrations/` in filename order through the Supabase migration connector. Existing D1 migrations are a separate backend and remain immutable.
3. Obtain the project's URL and an enabled `sb_publishable_...` key. These are public client settings. Never use a service role/secret key in Pages.
4. Add the lecturer's explicitly chosen email to `jom_private.approved_emails` using an admin SQL operation. The browser cannot write this list. Confirmed Auth accounts matching that list are bound to a lecturer ID. Disabled lecturer IDs remain disabled. There is no first-user-wins rule.
5. Enable Google using the instructions above and set the Auth Site URL/redirect allowlist to the GitHub `host.html` URL. The lecturer uses **Continue with Google** with the approved email. For the retained email/password fallback, the lecturer chooses their own password and confirms their email. Do not disable email confirmation to bypass delivery issues.
6. Set `backend` to `supabase` in `config/pages.json`, supply the verified project URL/publishable key and remove `apiBase`. Run checks, `pages:build` and build, then publish the generated root shells and `docs/` to GitHub.
7. Verify the published host login, anonymous student join, synchronized question, hidden score before reveal, locked answer, owner control, private CSV and logout. Only then describe the migration as complete.

## Authorization and concurrency

Private tables have RLS enabled, no browser grants and no public-schema exposure. The Data API exposes only the `public.jom_live` invoker wrapper. It calls the private `jom_private.live_api` function using narrowly granted schema usage and execution privileges; table access remains denied. The privileged code stays in an unexposed schema. Its locked search path, server-verified `auth.uid()`, approved lecturer list and room owner check protect teacher operations. User metadata cannot grant roles. Anonymous students use independent 256-bit tokens; storage contains SHA-256 hashes only. Browser CORS is not an authorization boundary.

Each join, answer and transition locks the room inside one Postgres transaction. The server reads its clock after acquiring that lock. Capacity, unique names, one answer per question, version checks and deadlines are enforced in the database. Snapshots strip correctness and current-round scores until reveal. A lecturer's daily create quota is serialized with an advisory lock.

The tests execute the actual migrations and RPC in PGlite (Postgres WASM) with a simulated Auth schema. PGlite has one connection, so queued calls do not prove concurrent hosted connections. Hosted REST/Auth and actual browser QA remain necessary.

The native security advisor reports informational [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) notices for private tables: default-deny is intentional, with no browser table grants and access through the authorized RPC. The Auth advisor also reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), relevant to the retained password fallback; Google login uses no app password. The dashboard patch leaves table privileges, function owner, execution grants and the locked search path unchanged. A covering index may report [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) until real games exercise it.

Do not delete the original Site/D1 records during cutover. They remain historical records on the original service unless an authorized export/import is separately verified. Never commit those records.
