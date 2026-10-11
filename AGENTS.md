# Project continuation

This repository is the canonical working copy of Teacher Reen’s Jom Philosophy game for FSPU0012.

- Keep course content in simple English and preserve attributed course conventions. Never copy the actual upcoming examination into public source.
- Score transparently. Live MCQs are automatic; oral reasons and manual open rubrics are judged by the lecturer. Live play does not collect or AI-grade written explanations.
- Preserve server-side room ownership, hashed student tokens, unique single submissions, authoritative deadlines, state transitions and hidden correctness/scores before reveal.
- Full answer records and controls require the owning lecturer. Public session snapshots may show the nicknames and scores intended for projection. Never commit student records or credentials.
- Run `npm test` and `npm run check` for gameplay or scoring changes. Build before publication. SQLite/DOM harnesses do not verify rendering in a real browser.
- Edit from this checkout. Regenerate `docs/`, root `index.html` and `host.html` using `npm run pages:build`. Support existing root and `/docs` publishing sources. The user authorized migration of all pages to GitHub and live storage/auth to Supabase. Preserve historical Site/D1 records during cutover.
- Review usability from both student and lecturer views, including navigation back and forth, saved-progress resumption, existing sessions, downloads and projection controls. The top-left logo always opens the main site home; My sessions opens the lecturer dashboard. Verify actual browser journeys as well as tests, and state which signed-in or cross-device flows could not be verified.
- The legacy Site bridge permits only student cross-origin routes. Supabase host requests use verified user JWTs, an administrator-controlled lecturer list and room ownership; browser CORS never replaces those checks. Never send service role keys or credentialed cookies from Pages.
- The main page preserves audience/route/action guards and Join/Practice/Revision navigation. At the user's request, its navigation includes a Pensyarah link to the canonical GitHub `host.html` URL so the lecturer can enter from the main page. Host controls remain on the separate dashboard and require an approved lecturer account. Never turn this link into anonymous host access or render host controls inside student views. Do not claim cutover complete until deployed Supabase, Auth and browser flows are verified.
- Generate D1 schema changes with `npm run db:generate`. Supabase migrations live separately in `supabase/migrations/`. Applied migrations are immutable. Never create tables in request handlers.
