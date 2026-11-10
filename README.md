# Prova

Practice hard conversations by voice. Pick a scene, talk to an AI character, get a verdict and a
debrief on your words, your voice and your face.

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
