# Talk Better

Practice hard conversations by voice. Pick a scene, talk to an AI character, get a verdict and a
debrief on your words, your voice and your face.

Live: https://www.talkbetter.app

Built in one evening at the Vapi hackathon in San Francisco, 9 November 2026.

## How it works

1. Pick one of four scenes (a cafe, a job interview, an investor pitch, a tough crowd) or describe your own.
2. A short first-person video leads into the scene. The live voice call starts on its last frame.
3. Talk to the character. A judge follows each turn: the scene ends when you reach the goal, and also
   when the character has had enough of you.
4. The debrief shows the verdict, how the character warmed to you, scores for your script, numbers for
   your voice, readings of your face and three notes on what to say next time.

## What does what

| Tool | Job |
|---|---|
| [Vapi](https://vapi.ai) | The live voice call in the browser. One inline assistant per scene. |
| [Deepgram](https://deepgram.com) | Speech-to-text and the character voices inside the call. After the call: pace, filler words and pauses from the recorded audio. |
| [TypeSafe](https://typesafe.ai) | The judge. After each turn: goal reached, scene lost, character mood, moderation. After the call: pass or fail and the script scores. |
| [Exa](https://exa.ai) | Public facts about the company or investor you name, so the character asks real questions. |
| Claude | Writes custom scenes and the debrief notes. |
| MediaPipe | Reads smile, eye contact and brow tension from the webcam. It runs in the browser; no video leaves the device. |

## Repo

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

- Vercel project `talkbetter`, root directory `apps/web`. A push to `main` deploys to
  production. A push to another branch makes a preview deployment.
- The keys from `.env.example` are set in Vercel for Production and Preview. A new key must be added
  there too.
- There is no separate backend. The API routes in `apps/web/app/api` run as Vercel Functions.

## Data

Supabase project `talkbetter`:

- Table `scenes` (`id`, `created_at`, `scene` as JSON): the custom scenes that users create. The start
  page shows the latest ones to all visitors.
- Public file bucket `scenes`: for custom scene covers and intro videos. Empty until `/api/intro` exists.

Only the server reads and writes Supabase. The browser has no Supabase key.
