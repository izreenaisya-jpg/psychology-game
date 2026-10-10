# Project continuation

This repository is the canonical working copy of Teacher Reen's Jom Philosophy game for FSPU0012.

- Keep the course content in simple English and preserve attributed course conventions. Do not copy the actual upcoming examination into public source.
- Keep scoring transparent: quiz choices are marked automatically; oral reasoning and open rubrics are judged by the lecturer. Do not describe written reasons as AI-assessed unless such assessment actually exists.
- The current Classroom Arena uses one shared screen and manual teacher recording. Do not claim it has a join PIN, synchronized voting or remote results unless implemented and verified.
- Shared student submissions and a lecturer dashboard are planned but not implemented. If added, protect the lecturer routes on the server and use shared storage. Never store student answers or credentials in GitHub source files.
- Run `npm test` and `npm run check` for changes affecting gameplay or scoring. The existing DOM harness does not verify visual rendering in a real browser.
- Edit from this checkout. Retain the Sites project ID when updating the existing hosted app. GitHub is the source repository; publishing remains an explicit separate operation until a deployment integration is configured.
