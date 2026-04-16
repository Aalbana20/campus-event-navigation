## Campus Event Navigation — Copilot Instructions

Purpose
- Short guidance so an AI coding agent can be productive quickly in this mono-repo (Web + Expo mobile + Supabase).

High-level architecture
- Web SPA: `src/` (React + Vite). Mobile: `mobile/campus-event-mobile/` (Expo / React Native). Backend: Supabase with SQL migrations in `supabase/migrations.sql`.
- Social data split: Stories, Posts (discover_posts), Events. Media stored in Supabase storage (bucket `stories` by current code).

Read these first (high ROI)
- `src/discoverPosts.js` — canonical post upload & load logic for web.
- `src/components/DiscoverCreateComposer.jsx` — unified web composer (Post / Story / Event / Live).
- `src/components/DiscoverPostsFeed.jsx` and `src/pages/Discover.jsx` — feed rendering and plus/create wiring.
- `src/pages/PublicProfile.jsx` — web profile lower area (Posts / Reposts / Events target).
- `supabase/migrations.sql` — authoritative DB schema (create discover_posts table here).
- Mobile: `mobile/campus-event-mobile/app/` and `mobile/campus-event-mobile/components/mobile/` — look for story/camera composer and Discover screens.

Important patterns & expectations
- Media is stored as a bucket-relative path (e.g. `posts/<authorId>/<ts>.jpg`) in `discover_posts.media_url`. Code resolves public URL via `supabase.storage.from(bucket).getPublicUrl(path)`.
- `discover_posts.author_id` is expected to match `profiles.id`. Verify currentUser id mapping before changing schema.
- Composer modes are kept minimal; prefer wiring new modes into existing composer components instead of creating entirely new flows.

Build / test / run
- Web dev: `npm install` then `npm run dev` (Vite). `npm run build` for production build.
- E2E: Playwright is configured — run `npm run test:e2e` or `npm run test:e2e:ui`.
- Mobile: open `mobile/campus-event-mobile` and use Expo CLI (`expo start`) to test on simulator/device.

Env & secrets
- Web uses `src/supabaseClient.js` — check expected env var names (Vite conventions use `VITE_` prefix). Mobile envs live in `mobile/.../app.json` or `app.config.js`.
- Do not hardcode API keys; follow existing env name conventions found in repo.

Safe-edit rules for AI agents
- Make small, targeted changes. Do not redesign navigation, camera capture, or event creation flows.
- When adding DB-backed behavior, update `supabase/migrations.sql`. Do not assume runtime-only migrations exist.
- Preserve UX of Story composer when adding Post mode; reuse patterns from `src/components/DiscoverCreateComposer.jsx`.

Debugging checklist (for publish failures)
- If post publish fails, check browser console for Supabase errors: common causes are missing `discover_posts` table, missing `stories` bucket, storage policy restricting client upload, or FK violation (author_id vs profiles.id).
- To validate media URL resolution: run `supabase.storage.from('stories').getPublicUrl(path)` in Supabase UI or via client.

Where to edit safely (common tasks)
- Add web/mobile post helpers: mirror `src/discoverPosts.js` for mobile under `mobile/.../lib` and use mobile Supabase client.
- Composer changes: edit `src/components/DiscoverCreateComposer.jsx` (web) and the mobile story composer under `mobile/campus-event-mobile/components/mobile/`.
- Profile tabs: edit `src/pages/PublicProfile.jsx` and mobile profile screen under `mobile/.../app/profile/`.

If you update this file
- Keep it concise (20–50 lines). When modifying project behavior, include a one-line rationale and link to the modified files.

Questions
- Tell me which area you want stronger examples for (exact code snippets, diffs, or mobile helper implementation) and I will expand this file.
