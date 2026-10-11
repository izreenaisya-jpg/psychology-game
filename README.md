# psychology-game · Jom Philosophy!

Canonical source for Teacher Reen’s FSPU0012 revision game.
Student site (GitHub Pages): https://izreenaisya-jpg.github.io/psychology-game/
Lecturer dashboard: https://izreenaisya-jpg.github.io/psychology-game/host.html
Live backend: Supabase project `general` (`iheutatkmiwoazmnggoi`).

## GitHub Pages publishing

The student webpage is prepared in `docs/`, including a complete `index.html`, relative assets and the original revision PDFs. It opens on the PIN/name join screen. Pages is already enabled on this repository. Publishing supports **main → /(root)** and **main → /docs**: the generated root `index.html` loads the same student app from `docs/`. Keep the configured publishing source; GitHub publishes updates pushed to `main`.

After changing browser code, run `npm run pages:build` and commit the regenerated `docs/` files and root shells. GitHub Pages serves both pages. Synchronized sessions, scoring and student answers use the Supabase Postgres API. Student requests omit browser cookies and authenticate submissions with their player token. Lecturer requests use a verified Supabase Auth JWT. The lecturer screen shares the GitHub student URL.

The main GitHub webpage is explicitly a **student audience**: Join game, Practice and Revision kit. It has no host links, teacher setup or classroom-control views. Direct host/setup hashes resolve to the student join screen, and the student client refuses host API calls. The separate host URL requires an approved, confirmed lecturer account. Interface guards supplement database authorization and room ownership checks.

**Deployment status:** the game schema, 100 revision questions and teacher email approval are deployed to `general`. Both GitHub pages are configured to use its public URL and publishable key. Auth's confirmation Site URL still needs to be set to the GitHub host URL in the Supabase dashboard; the connector cannot configure it and the dashboard requires sign-in. The first lecturer must then create their Supabase Auth account on `host.html`, choose their password, confirm their email and sign in. Hosted SQL gameplay QA passed for 30 players inside a rolled-back transaction; public REST authorization also passed. This does not substitute for a complete browser game after the lecturer signs in. Historical Site/D1 records have been preserved on the original service; they have not been imported into Supabase.

See [Supabase deployment instructions](supabase/README.md). Public connection settings live in `config/pages.json`; the build refuses incomplete Supabase settings. `host.html` has its own configuration and route handling. Signup or a public URL alone does not grant host privileges.

## Play live

1. Lecturer: open the separate **lecturer dashboard**, sign in with the approved email and password, choose 10/15/20 questions and a 30/45/60/75-second timer, then create a session. For the first login, use **Create account** and confirm the email first.
2. Project the lobby. Up to 60 students open **Join game**, enter its six-digit PIN and choose a display name. The host can copy the direct join link.
3. Start once everyone has joined. All phones receive the same question. A tap submits and locks the answer. The server enforces the question, deadline and one answer per player.
4. **Reveal & discuss** shows the answer, response distribution and leaderboard. Invite oral explanations, then open the next question. Correct choice = 1,000 points; an optional speed bonus adds up to 200.
5. Download all choices and scores as CSV. **My sessions** retains the lecturer’s latest 30 sessions and their records.

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
