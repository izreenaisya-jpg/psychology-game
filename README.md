# psychology-game · Jom Philosophy!

Canonical source for Teacher Reen’s FSPU0012 revision game.
Student site (GitHub Pages): https://izreenaisya-jpg.github.io/psychology-game/
Lecturer dashboard: https://izreenaisya-jpg.github.io/psychology-game/host.html
Live backend: Supabase project `general` (`iheutatkmiwoazmnggoi`).

## GitHub Pages publishing

The student webpage is prepared in `docs/`, including a complete `index.html`, relative assets and the original revision PDFs. It opens on the PIN/name join screen. Pages is already enabled on this repository. Publishing supports **main → /(root)** and **main → /docs**: the generated root `index.html` loads the same student app from `docs/`. Keep the configured publishing source; GitHub publishes updates pushed to `main`.

After changing browser code, run `npm run pages:build` and commit the regenerated `docs/` files and root shells. GitHub Pages serves both pages. Synchronized sessions, scoring and student answers use the Supabase Postgres API. Student requests omit browser cookies and authenticate submissions with their player token. Lecturer requests use a verified Supabase Auth JWT. The lecturer screen shares the GitHub student URL.

The main GitHub webpage provides Join game, Practice and Revision kit, plus a **Pensyarah** navigation link to the separate lecturer dashboard. Everyone can see the link; the dashboard still requires an approved, confirmed lecturer account. Student views contain no teacher setup or classroom controls. Direct host/setup hashes resolve to the student join screen, and the student client refuses host API calls. Interface guards supplement database authorization and room ownership checks. The navigation uses the canonical host URL so OAuth returns to the configured page for either Pages publishing source.

**Deployment status:** the game schema, 100 revision questions and teacher email approval are deployed to `general`. Both GitHub pages use its public URL and publishable key. Google OAuth uses a PKCE callback on `host.html`; public Auth settings now report Google enabled, and the lecturer has completed login and returned to GitHub. There is no separate password or manual signup step. An ambiguous room alias in the dashboard's sessions query caused an error immediately after login; a deployed migration fixes that query while preserving authorization and room ownership. Regression tests cover empty, populated and other-lecturer session lists. Hosted SQL QA using the approved lecturer identity passed dashboard loading, PIN creation, player join, answer privacy, reveal, results and finish in a rolled-back transaction. Existing email/password login remains available as a collapsed fallback. Earlier hosted SQL gameplay QA passed for 30 players; public REST authorization and deployed student join/error/route guards also passed. A complete game in the published browser remains to be verified after the lecturer refreshes the dashboard. Historical Site/D1 records remain on the original service and have not been imported into Supabase.

The live pool now uses 90 enabled questions sampled randomly for every new game. The lecturer dashboard includes a private question editor and recoverable session removal; hosted SQL QA for those features passed with all fixtures rolled back. Automated tests cover both interfaces and authorization. Signed-in browser bank editing/removal and full cross-device gameplay have not been verified in this environment.

See [Supabase deployment instructions](supabase/README.md). Public connection settings live in `config/pages.json`; the build refuses incomplete Supabase settings. `host.html` has its own configuration and route handling. Signup or a public URL alone does not grant host privileges.

## Play live

1. Lecturer: open the main page and click **Pensyarah**, then choose **Continue with Google** and use the approved lecturer email. Choose 10/15/20 questions and a 30/45/60/75-second timer, then create a session. Existing email/password accounts can use the collapsed fallback.
2. Project the lobby. Up to 60 students open **Join game**, enter its six-digit PIN and choose a display name. The host can copy the direct join link.
3. Start once everyone has joined. All phones receive the same question. A tap submits and locks the answer. The server enforces the question, deadline and one answer per player.
4. **Reveal & discuss** shows the answer, response distribution and leaderboard. Invite oral explanations, then open the next question. Correct choice = 1,000 points; an optional speed bonus adds up to 200.
5. Download all choices and scores as CSV. **My sessions** shows the latest 30 active sessions. **Remove** closes access to a PIN and moves it into **Removed sessions**; **Restore** recovers the session and its records. Restoring does not reset the original deadline or eight-hour public expiry.

New live games draw 10/15/20 enabled questions randomly, without replacement, from the Chapters 4–6 bank. There is no fixed opening sequence; independent games can still share individual questions. Existing sessions keep their frozen decks. The initial live pool contains 90 active revision questions; the former ten core questions are retained inactive for lecturer review.

Open **Question bank** in the lecturer navigation to search, add, edit or enable/disable MCQs. Each question has four distinct choices, one correct answer, an explanation and optional discussion/AI claim. Chapter metadata supports 4, 5, 6 or mixed 4–6. Existing questions start with mixed metadata until the lecturer classifies them. This private Supabase bank is editable only through approved lecturer RPCs; student views cannot manage it. Edits have version checks to prevent stale tabs overwriting newer changes.

Synchronization uses HTTP polling every two seconds. A server deadline closes answers even if a phone’s timer is inaccurate. Allow a reliable internet connection and short delivery delays. Joining closes at start; players can resume in the same browser using their saved token. Session join/play links expire after eight hours; owner results remain available.

Student display names and scores appear on the shared game screen. Full answer records and controls require the owning lecturer’s approved Supabase identity. Anonymous players authenticate submissions with random tokens stored in their browser; only token hashes are stored in Postgres. Names are unique per session. New results live in Supabase, never in the GitHub repository. This is formative revision, not a secure exam: the original revision question bank is available in client source. Oral explanations are discussed by the lecturer and are not collected or AI-graded by the live game.

## Other modes

- **Classroom Arena**: one-screen manual team game, 13 challenges; correct answers, oral-reasoning bonuses and open rubrics.
- **Solo Quest**: 10 random questions from 90, reason before feedback, self-review, retry and text export. Progress stays in that browser.
- **Class plan**: a printable 60-minute plan and a 110-minute adaptation.
- **Revision kit**: three original practice papers. The actual upcoming examination and lecturer answer guide are not in this public repository.

## Development

Node >=22.13.0 and pnpm 11.25.0 (as pinned in package.json). Install dependencies with the included `install:ci` script; portable clones can use Corepack.

```bash
corepack pnpm install --frozen-lockfile
npm test
npm run check
npm run dev
```

The browser source is in `public/`; GitHub deployment is generated by `npm run pages:build`. Generate new Supabase migrations with `supabase migration new <name>` and apply them separately through the Supabase connector. Keep applied SQL immutable and filenames aligned with the project migration history. Never add service role or secret keys to the browser.

The retained legacy preview uses Vinext on Cloudflare Workers and D1. Its schema generation is `npm run db:generate`; it is separate from the active Supabase backend. Building or publishing GitHub Pages does not migrate either database.

```bash
npm run build
```

`public/` holds the browser app, styles, revision modules and PDFs. `public/backend.mjs` handles Supabase Auth and RPC transport; `supabase/migrations/` owns the live Postgres schema, authorization and scoring. `app/`, `lib/live-service.mjs`, `db/` and `drizzle/` retain the legacy Site/D1 implementation. Tests cover both backends plus student route guards, token/JWT separation and revision interactions.

Tests include 30 players, late/stale/duplicate submissions, lecturer isolation, 60-player capacity, resume tokens, complete games, saved records and speed-score bounds. Postgres tests use PGlite with one connection; they do not prove simultaneous hosted database connections or replace testing on actual phones and a projector.

Continue development here. Run `npm run pages:build` and commit both generated root shells and `docs/` files to publish the GitHub pages. GitHub pushes do not apply Supabase migrations. Follow the verified cutover order in `supabase/README.md`, and retain historical D1 records. Never commit credentials, student records, local databases or generated framework build output.
