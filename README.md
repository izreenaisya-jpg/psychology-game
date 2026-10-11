# psychology-game · Jom Philosophy!

Canonical source for Teacher Reen’s FSPU0012 revision game.
Student site (GitHub Pages): https://izreenaisya-jpg.github.io/psychology-game/
Lecturer/live server: https://jom-philosophy-reen.izreenaisya.chatgpt.site

## GitHub Pages publishing

The student webpage is prepared in `docs/`, including a complete `index.html`, relative assets and the original revision PDFs. It opens on the PIN/name join screen. Pages is already enabled on this repository. Publishing supports **main → /(root)** and **main → /docs**: the generated root `index.html` loads the same student app from `docs/`. Keep the configured publishing source; GitHub publishes updates pushed to `main`.

After changing browser code, run `npm run pages:build` and commit the regenerated `docs/` files. GitHub Pages serves the webpage; synchronized sessions and student answers still use the existing Worker/D1 server. Student requests omit browser cookies and authenticate submissions with their player token. The server allows this GitHub origin only on the public room snapshot, join and answer routes. Host controls and full results stay on the authenticated server origin. The lecturer screen shares the GitHub student URL.

The GitHub webpage is explicitly a **student audience**: Join game, Practice and Revision kit. It has no host links, teacher setup or classroom-control views. Direct host/setup hashes resolve to the student join screen, and the student client refuses host API calls. These interface guards supplement the server’s existing owner checks and CORS restrictions; they do not replace server authorization.

**Migration status:** the student webpage is on GitHub, while the authenticated lecturer page, API and D1 records still run on the existing ChatGPT Site. Removing ChatGPT hosting entirely requires an independently provisioned backend and lecturer authentication, because GitHub Pages cannot execute the live API. Do not describe the current split deployment as fully hosted on GitHub.

## Play live

1. Lecturer: open **Host live**, sign in with ChatGPT, choose 10/15/20 questions and a 30/45/60/75-second timer, then create a session.
2. Project the lobby. Up to 60 students open **Join game**, enter its six-digit PIN and choose a display name. The host can copy the direct join link.
3. Start once everyone has joined. All phones receive the same question. A tap submits and locks the answer. The server enforces the question, deadline and one answer per player.
4. **Reveal & discuss** shows the answer, response distribution and leaderboard. Invite oral explanations, then open the next question. Correct choice = 1,000 points; an optional speed bonus adds up to 200.
5. Download all choices and scores as CSV. **My sessions** retains the lecturer’s latest 30 sessions and their records.

Synchronization uses HTTP polling every two seconds. A server deadline closes answers even if a phone’s timer is inaccurate. Allow a reliable internet connection and short delivery delays. Joining closes at start; players can resume in the same browser using their saved token. Session join/play links expire after eight hours; owner results remain available.

Student display names and scores appear on the shared game screen. Full answer records and controls require the owning lecturer’s ChatGPT identity on the server. Anonymous players authenticate submissions with random tokens stored in their browser; only token hashes are stored in D1. Names are unique per session. Results live in D1, never in the GitHub repository. This is formative revision, not a secure exam: the original revision question bank is available in client source. Oral explanations are discussed by the lecturer and are not collected or AI-graded by the live game.

Site audience is a separate hosting setting. If owner-private, students cannot access the join page. The PIN flow is ready for anonymous students when the owner enables public link access; lecturer controls remain protected.

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

Development uses Vinext on Cloudflare Workers. Generate schema changes with `npm run db:generate`, inspect the generated SQL, and commit the migration and metadata. Apply generated SQL to local D1 separately when running a preview. Hosted Sites publication applies migrations and supplies the logical `DB` binding declared in `.openai/hosting.json`.

```bash
npm run build
```

`public/` holds the browser app, styles, revision modules and PDFs. `app/` contains the shell, ChatGPT authentication helper and live API route. `lib/live-service.mjs` owns synchronized state and scoring. `db/schema.ts` and `drizzle/` own shared storage. `tests/` checks manual/solo interactions and multiplayer behavior with a SQLite-backed D1 adapter.

Tests include 30 concurrent players, late/stale/duplicate submissions, lecturer isolation, 60-player capacity, resume tokens, complete games, saved records and speed-score bounds. They do not replace visual testing on actual phones and a projector.

Continue development here. Run `npm run pages:build` and commit its generated root shell and `docs/` files to publish the student website. GitHub pushes do not automatically publish changes to the live server. Deploy a verified revision through Sites and preserve its project ID and access policy. Never commit credentials, student records, local databases or generated build output.
