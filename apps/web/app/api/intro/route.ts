// Video pipeline entry point for custom scenes. Not built yet: see /video/README.md.
// Request:  { imagePrompt: string }  (already moderated)
// Response: { cover: string, video?: string }  (URLs; the app merges them into the scene)
export async function POST() {
  return Response.json({ error: "not implemented" }, { status: 501 });
}
