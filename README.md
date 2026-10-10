# psychology-game

## Jom Philosophy!

This repository is the working home for Teacher Reen's FSPU0012 classroom game. Continue development from this repository.

Current app: https://jom-philosophy-reen.izreenaisya.chatgpt.site

Teacher-led classroom game and browser-local individual revision for FSPU0012.

## Modes

- Classroom Arena: one projected/shared screen, 2–8 teams, 13 challenges in four rounds. The host records votes, reveals explanations and awards oral-reasoning/rubric points. No phone-to-host voting, join PIN or remote scoreboard.
- Solo Quest: 10 randomly selected questions from a 90-question bank, a written reason before feedback, personal review, missed-question retry and text export. MCQ choices are automatically marked; explanations are self-assessed.
- Class plan: a 60-minute plan, print view, and adaptation to 110 minutes.
- Revision kit: the three original student practice PDFs.

Scores and progress use localStorage in the current browser. No external AI calls, student accounts, analytics or submission endpoint. Classroom CSV export and individual text downloads happen locally.

The simulated AI claims are intentionally written educational examples, not live model output. This is a revision activity, not a secure examination system.

## Run locally

Requirements: Node.js 20 or newer and Python 3. There are no npm dependencies to install.

```bash
npm run dev
```

Open `http://localhost:8000`. The app is a buildless static site; its browser files are in `dist/`.

## Checks

```bash
npm test
npm run check
```

Node tests cover question integrity, score calculation, repeat-reveal protection, rubric correction, random quest uniqueness, escaping, and classroom/solo interaction paths with a lightweight DOM harness. This is not visual browser verification.

Buildless static site: `dist/`. Hosting configuration: `.openai/hosting.json`.

## Continue development

- `dist/app.js`: screens, classroom interaction, solo play, downloads and browser-local progress.
- `dist/engine.mjs`: scoring, ranking, question selection and escaping.
- `dist/deck.mjs`: the 13 classroom challenges and rubrics.
- `dist/bank.mjs`: the 90-question solo revision bank.
- `dist/style.css`: responsive interface and printable lesson plan.
- `dist/assets/`: the three original student practice PDFs.
- `tests/game.test.mjs`: scoring and interaction checks.

## Next requested feature: student submissions and lecturer dashboard

The current app has no shared database, student submission endpoint or lecturer dashboard. A student's solo answers are stored only in that student's browser. The classroom score table is updated by the lecturer during discussion.

Future work should add a submit action, shared storage, and an authenticated lecturer view of students' answers, reasons and scores. Student answers must not be committed to this public GitHub repository or exposed in a public dashboard. GitHub stores the project code; it is not the student-results database.

The existing hosted app uses Sites. GitHub commits do not automatically update that deployment. Continue code changes here and explicitly deploy a verified revision through the hosting workflow. Preserve the existing project identity in `.openai/hosting.json` when updating that Site; never place credentials in source files.
