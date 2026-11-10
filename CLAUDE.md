# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Prova: a voice scene trainer. The user picks a scene (or writes one), talks out loud to an AI character,
and gets a verdict plus a debrief on words, voice and face.

- `apps/web` - the only app. Next.js (App Router); frontend and backend (`app/api/*`) deploy together.
- `video` - no code. `video/README.md` is the contract for scene intro media.

## Commands

Run all commands from `apps/web` (pnpm, no workspace root package).

```
pnpm install
pnpm dev                              # needs .env.local, see .env.example
pnpm build
pnpm exec tsc --noEmit                # type check
node --test lib/audioStats.test.ts    # tests: node's built-in runner, runs .ts directly
```

There is no lint script and no test framework. A new test is a `*.test.ts` file next to the code,
run with `node --test <file>`. Test files import with the `.ts` extension; app code uses the `@/` alias.

## Next.js version

`apps/web/AGENTS.md` applies: this Next.js (16.x, React 19, Tailwind 4 through `@tailwindcss/turbopack`)
differs from older versions. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before
you write Next.js code. `next dev` re-creates that block in `AGENTS.md`; do not remove it.

`next.config.ts` turns `reactStrictMode` off on purpose: the dev double-mount starts two Vapi calls.

## Architecture

One client page drives everything. `app/page.tsx` holds a stage machine:
`pick -> title -> intro -> call -> debrief`. `title`, `intro` and `call` share one full-screen stage so
the intro video's last frame stays as the background of the live call.

**Scene** (`lib/scenes.ts`) is the central type: prompt, voice, goal, optional cover/video. The four
built-in scenes live there. A custom scene comes from `POST /api/scene` with the same shape and
`id: "custom"`, plus `judgeGoal` (what the judge checks instead of the display `goal`).

**Live call** (`components/Call.tsx`), all in one mount effect:
- Gets a short-lived public-scope JWT from `/api/vapi-token` (signed with the private key on the
  server), then starts a Vapi web call. Assistant config is inline: Deepgram STT and voice, OpenAI model.
- In parallel and optional: camera + mic through `getUserMedia`, a `MediaRecorder` on the mic, and
  MediaPipe FaceLandmarker blendshapes sampled once per second (smile, brow tension, eye contact).
  Video never leaves the browser; only the averaged numbers do.
- After each final user transcript it calls `/api/turn`. The response sets the mood bar, ends the call
  when the turn is flagged, and on goal reached tells the character to close the scene. Otherwise it
  injects the mood into the call as a silent system message.

**Debrief** (`components/Debrief.tsx`): posts the recorded mic audio to `/api/audio` (Deepgram
pre-recorded STT, then `lib/audioStats.ts` for pace, fillers and pauses), then posts transcript +
face stats + audio stats to `/api/debrief`, which returns the pass/fail and three tip lists.

**Judge** (`lib/judge.ts`): `jev()` is the single wrapper for TypeSafe Jev. Each call sends a state
and typed questions (`noul` = probability, `score`, `choice`) and reads structured answers. All
judging, mood, moderation (`BLOCKED`) and rubric scores go through it; routes apply their own
thresholds on the answers. Tip texts are fixed strings in the routes, not model output.

**Facts** (`/api/facts`): for scenes with `lookup`, one Exa answer call about the name the user
typed. The result is appended to the scene's system prompt before the call starts.

**Intro media**: built-in scenes read `public/scenes/<id>.jpg|mp4`. A missing file is fine: the cover
falls back to the scene gradient and the intro is skipped. `/api/intro` (custom scenes) is a 501
stub; its contract is in `video/README.md`.

## Conventions

- Known limits are marked in code as `// shortcut: <the limit>, <when to upgrade>`.
- Styling uses the theme tokens and the `btn`, `kicker` and `animate-rise` classes from `app/globals.css`.
