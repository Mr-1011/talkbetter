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

The app calls `POST /api/intro` after it creates a custom scene, and calls it again every 10 seconds
until the response has a `video`. The route is `apps/web/app/api/intro/route.ts`.

- Request: `{ "id": string }` (the scene id; the prompt comes from the saved, moderated scene)
- Response: `{ "cover"?: string, "still"?: string, "video"?: string }` (URLs on fal.ai; `still` is the first frame of the video)

One call does one step: the cover (about 30 s), then the first frame and the start of the video job
(about 30 s), then a status check until the video is done (about 3 minutes for 5 seconds of video).
The route saves each result in the scene row, so the gallery shows the cover and the video too.
The title page shows at once and picks up the cover and the video when they arrive. It needs `FAL_KEY`.
