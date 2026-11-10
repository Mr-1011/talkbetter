import { BLOCKED, jev } from "@/lib/judge";
import { db } from "@/lib/db";
import { ask } from "@/lib/llm";

// Custom scene: moderation, then a scene config from the user's own text. The scene is saved in Supabase.
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
  const scene = await ask<Partial<typeof fallback> & { firstMessage?: string; tagline?: string }>(
    `The user describes a conversation they want to practice by voice. Write the scene.
Return {"title": string (2-3 words, like a film title), "goal": string (max 7 words, what the user must get, imperative), "tagline": string (film-poster tagline, 2 or 3 very short sentences, max 8 words in total), "gender": "female" | "male", "systemPrompt": string (second person "You are <name>, ...": who the character is, the place, why they resist), "firstMessage": string (the character's first spoken line, one short sentence), "imagePrompt": string (first-person POV photo of the character in the place, looking into the camera), "rules": {"win": string (one statement that is true when the user has reached the goal, names the character), "winReason": string (max 8 words, second person, e.g. "She gave you her number."), "lose": [{"rule": string (one clear statement about the transcript that ends the scene as failed), "reason": string (max 10 words, second person)}] (exactly 3: the user is rude or pushy; a mistake typical for this scene; the character has clearly refused or ended it)}}.`,
    text,
  ).catch((): { goal?: string; firstMessage?: string; tagline?: string } => ({}));
  const s = { ...fallback, ...scene };

  const saved = {
    title: s.title,
    goal: s.goal,
    tagline: s.tagline,
    judgeGoal: scene.goal ? undefined : fallback.judgeGoal,
    emoji: "🎬",
    gradient: "from-stone-700 to-stone-950",
    voiceId: s.gender === "female" ? "asteria" : "orion",
    firstMessage: s.firstMessage,
    rules: (scene as { rules?: unknown }).rules,
    systemPrompt: `${s.systemPrompt}\nStay in character. Speak like a real person: one or two short sentences per turn. Never mention that you are an AI. Do not make it easy: the user must earn what they want.`,
    imagePrompt: s.imagePrompt,
  };
  const [{ id }] = await db("", { method: "POST", body: JSON.stringify({ scene: saved }) });
  return Response.json({ allowed: true, id, ...saved });
}
