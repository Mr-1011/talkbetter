import { BLOCKED, jev } from "@/lib/judge";
import { ask } from "@/lib/llm";

// Supabase table `scenes` (id uuid, created_at timestamptz, scene jsonb). RLS is on with no policy: only this server key reads and writes.
const db = (query: string, init?: RequestInit) =>
  fetch(`${process.env.SUPABASE_URL}/rest/v1/scenes${query}`, {
    ...init,
    headers: { apikey: process.env.SUPABASE_SECRET_KEY!, "Content-Type": "application/json", Prefer: "return=representation" },
  }).then((r) => r.json());

// Public gallery: the latest custom scenes of all users.
// shortcut: latest 20 only, add paging when the gallery grows.
export async function GET() {
  const rows: { id: string; scene: object }[] = await db("?select=id,scene&order=created_at.desc&limit=20");
  return Response.json(rows.map((r) => ({ ...r.scene, id: r.id })));
}

// Custom scene: moderation, then a scene config from the user's own text. The scene is saved for the gallery.
export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim() || text.length > 1000)
    return Response.json({ allowed: false, reason: "Describe the scene in up to 1000 characters." }, { status: 400 });

  const a = await jev(text, {
    blocked: BLOCKED,
    gender: {
      type: "choice",
      instructions: "The gender of the other person in the conversation the user wants to practice",
      criteria: { female: "A woman", male: "A man or not stated" },
    },
  });
  if (a.blocked.noul > 0.5) return Response.json({ allowed: false, reason: "This scene is not allowed. Try a different one." });

  const fallback = {
    title: "Your Scene",
    goal: "Get what you came for.",
    judgeGoal: `The user got what they wanted in this scene: ${text}`,
    gender: a.gender.choice,
    systemPrompt: `The user wants to practice this conversation: "${text}"\nYou play the other person. Open the scene with one short line.`,
    imagePrompt: `First-person POV photo, the other person looks into the camera. Scene: ${text}`,
  };
  const scene = await ask<Partial<typeof fallback> & { firstMessage?: string }>(
    `The user describes a conversation they want to practice by voice. Write the scene.
Return {"title": string (2-3 words, like a film title), "goal": string (max 7 words, what the user must get, imperative), "gender": "female" | "male", "systemPrompt": string (second person "You are <name>, ...": who the character is, the place, why they resist), "firstMessage": string (the character's first spoken line, one short sentence), "imagePrompt": string (first-person POV photo of the character in the place, looking into the camera)}.`,
    text,
  ).catch((): { goal?: string; firstMessage?: string } => ({}));
  const s = { ...fallback, ...scene };

  const saved = {
    title: s.title,
    goal: s.goal,
    judgeGoal: scene.goal ? undefined : fallback.judgeGoal,
    emoji: "🎬",
    gradient: "from-stone-700 to-stone-950",
    voiceId: s.gender === "female" ? "asteria" : "orion",
    firstMessage: s.firstMessage,
    systemPrompt: `${s.systemPrompt}\nStay in character. Speak like a real person: one or two short sentences per turn. Never mention that you are an AI. Do not make it easy: the user must earn what they want.`,
    imagePrompt: s.imagePrompt,
  };
  const [{ id }] = await db("", { method: "POST", body: JSON.stringify({ scene: saved }) });
  return Response.json({ allowed: true, id, ...saved });
}
