# Video pipeline

This folder belongs to the scene intro videos. The app in `apps/web` needs only this contract.

## Pre-made scenes

Put the files in `apps/web/public/scenes/`:

- `<id>.jpg` - title page cover
- `<id>.mp4` - intro video

Scene ids: `cafe`, `interview`, `pitch`, `laugh`.

Video pattern: first-person POV. Establish the place, approach the character, end on the character
looking into the camera. The last frame stays on screen as the background of the live call.
A missing file is fine: the app falls back to a gradient and skips the intro.

## Custom scenes

The app calls `POST /api/intro` after it creates a custom scene. The route does not exist yet.

- Request: `{ "imagePrompt": string }` (already moderated)
- Response: `{ "cover": string, "video"?: string }` (URLs)

Add it as `apps/web/app/api/intro/route.ts`. The title page shows at once and picks up the cover
and the video when the response arrives.
