import { BLOCKED, jev } from "@/lib/judge";

// Custom scene: moderation, then a scene config from the user's own text.
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

  return Response.json({
    allowed: true,
    id: "custom",
    title: "Your Scene",
    goal: "Get what you came for.",
    judgeGoal: `The user got what they wanted in this scene: ${text}`,
    emoji: "🎬",
    gradient: "from-stone-700 to-stone-950",
    voiceId: a.gender.choice === "female" ? "asteria" : "orion",
    systemPrompt: `The user wants to practice this conversation: "${text}"\nYou play the other person. Open the scene with one short line. Stay in character. Speak like a real person: one or two short sentences per turn. Never mention that you are an AI. Do not make it easy: the user must earn what they want.`,
    imagePrompt: `First-person POV photo, the other person looks into the camera. Scene: ${text}`,
  });
}
