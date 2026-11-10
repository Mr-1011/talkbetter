# Talk Better

Practice hard conversations by voice. Pick a scene, talk to an AI character, get a verdict and a
debrief on your words, your voice and your face.

Live: https://www.talkbetter.app

- `apps/web` - Next.js app. The frontend and the backend (`app/api/*`) deploy together.
- `video` - scene intro video pipeline. Contract in `video/README.md`.

## Run

```
cd apps/web
cp .env.example .env.local   # fill in the keys
pnpm install
pnpm dev
```

Test: `node --test lib/audioStats.test.ts`

## Deploy

- Vercel project `talkbetter` (team FluidLabs), root directory `apps/web`. A push to `main` deploys to
  production. A push to another branch makes a preview deployment.
- The keys from `.env.example` are set in Vercel for Production and Preview. A new key must be added
  there too.
- There is no separate backend. The API routes in `apps/web/app/api` run as Vercel Functions.

## Data

Supabase project `talkbetter` (FluidLabs, Frankfurt):

- Table `scenes` (`id`, `created_at`, `scene` as JSON): the custom scenes that users create. The start
  page shows the latest ones to all visitors.
- Public file bucket `scenes`: for custom scene covers and intro videos. Empty until `/api/intro` exists.

Only the server reads and writes Supabase. The browser has no Supabase key.
