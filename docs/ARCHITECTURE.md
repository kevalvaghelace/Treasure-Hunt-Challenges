# Architecture

```
Browser (public/)            Express API (server/)           SQLite
 hash router + views  --->   /api/register, /login           users
 localStorage state          /api/complete (validates)       progress
                             /api/leaderboard                badges
```

- **Frontend:** `app.js` holds config, content, state, views and a hash router. `route()` renders into `#app`.
- **Backend:** `server/index.js`; `content.json` is the answer key extracted from the frontend content (regenerate it if quiz answers change).
- **Data model:** `users(id, username, hash, xp, streak, longest, last)`, `progress(user_id, kind, item, score)` with a composite key that enforces one reward per item, `badges(user_id, badge, at)`.
- **Config sync:** XP values exist in `public/js/app.js` (`CFG`) and `server/index.js` (`XP`); keep them equal until the frontend reads them from the API.
