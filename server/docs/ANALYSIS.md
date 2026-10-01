# Code analysis

**Size:** one HTML file (~25 KB) with inline CSS and JS, no dependencies.

## Strengths
- Zero build step; fast load; no external requests
- Central `CFG` for XP values and level size; data (`T`, `CH`, `B`) separated from rendering
- User text is HTML-escaped (`esc`); storage access is wrapped in try/catch
- Semantic landmarks, focus styles, `aria-pressed`, progress bars with ARIA values, reduced-motion and dark-mode support
- XP cannot be farmed: lessons, quizzes and challenges pay once

## Limitations
- Progress and "accounts" live in `localStorage`; anyone can edit them, so XP is not trustworthy and the leaderboard is not shared
- Quiz answers are in the client; scoring must move server-side for real rewards (the API already does this)
- Dark-mode toggle compares a computed colour string, which is fragile; a stored boolean would be safer
- Streak uses UTC dates, so it can roll over at an odd local time
- No search, admin area, charts or tests; 6 topics only
- Whole-page `innerHTML` re-render on each interaction loses focus position; fine at this size, worth improving
- Single global click handler is compact but harder to maintain

## Suggested next steps
See the Roadmap in `README.md`.
