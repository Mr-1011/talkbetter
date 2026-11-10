import { db } from "@/lib/db";

// Intro media for a custom scene, made on fal.ai. One call does one step, so no call runs for long:
//   1. no cover      -> make the cover (the last frame of the intro) and save it
//   2. no video job  -> make the first frame from the cover and start the video job
//   3. video job     -> ask for its status; when it is done, add ambient sound and save the video url
// The page calls this again until `video` is in the response.
// Request:  { id: string }  (scene id; the prompt comes from the saved, moderated scene, never from the client)
// Response: { cover?: string, still?: string, video?: string }  (still = the first frame of the video)
// shortcut: two calls at the same moment for one scene can make the same step twice, add a lock when many users create scenes.
// shortcut: the media stays on fal's file host, copy it to own storage when the gallery must last.
export const maxDuration = 120;

type Row = { imagePrompt?: string; cover?: string; still?: string; video?: string; videoJob?: string };

const LOOK =
  "Dark, intimate, moody low-key cinematic lighting, warm practical lamps, rich amber highlights and near-black shadows, photorealistic film still, natural skin texture. No text, no watermark, no logos.";

const fal = (url: string, body?: object) =>
  fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  }).then((r) => r.json());

const image = (endpoint: string, body: object): Promise<string | undefined> =>
  fal(`https://fal.run/${endpoint}`, { ...body, aspect_ratio: "16:9", resolution: "2K", num_images: 1, output_format: "jpeg" }).then(
    (r) => r.images?.[0]?.url,
  );

export async function POST(req: Request) {
  const { id } = await req.json();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const rows: { scene: Row }[] = await db(`?select=scene&id=eq.${id}`);
  const scene = rows[0]?.scene;
  if (!scene?.imagePrompt) return Response.json({ error: "no such scene" }, { status: 404 });

  const save = async (patch: Row) => {
    Object.assign(scene, patch);
    await db(`?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ scene }) });
    return Response.json({ cover: scene.cover, still: scene.still, video: scene.video });
  };

  if (scene.video) return Response.json({ cover: scene.cover, still: scene.still, video: scene.video });

  if (!scene.cover) {
    const cover = await image("fal-ai/nano-banana-pro", {
      prompt: `${scene.imagePrompt} First-person POV, the viewer sits or stands directly in front of the person. Only this one person is in the foreground, centered in the frame, looking straight into the camera. 35mm lens, shallow depth of field. ${LOOK}`,
    });
    if (!cover) return Response.json({ error: "cover failed" }, { status: 502 });
    return save({ cover });
  }

  if (!scene.videoJob) {
    const first = await image("fal-ai/nano-banana-pro/edit", {
      image_urls: [scene.cover],
      prompt: `Same place, same person, same clothes, same lighting and color grade as the reference image. New camera position: first-person POV of someone who has just arrived, standing about six meters away. Very wide eye-level shot of the whole place. The person is small, in the center of the frame, busy with something, not looking at the camera. No other person near them, nobody in the foreground. 20mm wide-angle lens. ${LOOK}`,
    });
    if (!first) return Response.json({ error: "first frame failed" }, { status: 502 });
    const job = await fal("https://queue.fal.run/fal-ai/kling-video/o1/image-to-video", {
      start_image_url: first,
      end_image_url: scene.cover,
      duration: "5",
      prompt:
        "One continuous first-person POV shot, no cuts. The camera is the viewer's own eyes. The viewer's body is never visible. Start at @Image1. This is a pure camera move with no people in the foreground: a slow, smooth dolly forward, straight toward the person in the center of the frame. The space in front of the camera is empty the whole time. The camera arrives close to the person and settles at eye level. The person lifts their head and looks straight into the camera. The shot holds still, ending exactly on @Image2. Natural handheld motion, photorealistic.",
    });
    if (!job.response_url) return Response.json({ error: "video start failed" }, { status: 502 });
    return save({ videoJob: job.response_url, still: first });
  }

  const { status } = await fal(`${scene.videoJob}/status`);
  if (status === "COMPLETED") {
    const silent: string | undefined = (await fal(scene.videoJob)).video?.url;
    if (silent) {
      // Ambient sound that follows the picture. If this step fails, the scene keeps the silent video.
      const sound = await fal("https://fal.run/fal-ai/mmaudio-v2", {
        video_url: silent,
        duration: 5,
        prompt: `Quiet ambient sound of this place, room tone, soft footsteps that come closer. The place: ${scene.imagePrompt}`,
        negative_prompt: "speech, voice, talking, singing, music, laughter",
      }).catch(() => ({}));
      return save({ video: sound.video?.url ?? silent, videoJob: undefined });
    }
  } else if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
    return Response.json({ cover: scene.cover, still: scene.still });
  }
  // The job failed: forget it, so that the next call starts a new one.
  await save({ videoJob: undefined });
  return Response.json({ error: "video failed" }, { status: 502 });
}
