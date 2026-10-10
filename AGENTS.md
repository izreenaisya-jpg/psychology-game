# Project continuation

This repository is the canonical working copy of Teacher Reen’s Jom Philosophy game for FSPU0012.

- Keep course content in simple English and preserve attributed course conventions. Never copy the actual upcoming examination into public source.
- Score transparently. Live MCQs are automatic; oral reasons and manual open rubrics are judged by the lecturer. Live play does not collect or AI-grade written explanations.
- Preserve server-side room ownership, hashed student tokens, unique single submissions, authoritative deadlines, state transitions and hidden correctness/scores before reveal.
- Full answer records and controls require the owning lecturer. Public session snapshots may show the nicknames and scores intended for projection. Never commit student records or credentials.
- Run `npm test` and `npm run check` for gameplay or scoring changes. Build before publication. SQLite/DOM harnesses do not verify rendering in a real browser.
- Edit from this checkout. GitHub is canonical source; deploy separately through Sites with the retained project ID. Preserve Site access unless the user requests an audience change.
- Generate schema changes using `npm run db:generate`; commit SQL and metadata. Applied migrations are immutable. Never create tables in request handlers.
