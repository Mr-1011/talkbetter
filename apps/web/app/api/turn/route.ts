import { BLOCKED, jev } from "@/lib/judge";

// Called after each user turn: goal check, character mood, moderation.
export async function POST(req: Request) {
  const { goal, transcript, lastUserTurn, face } = await req.json();
  const [a, mod] = await Promise.all([
    jev(
      { goal, transcript, userFace: face },
      {
        goal: { type: "noul", instructions: `The character has clearly granted the user's goal: ${goal}` },
        lost: {
          type: "noul",
          instructions:
            "The user has lost this scene for good: the character is offended, has firmly refused the goal, or wants to end the conversation and leave",
        },
        mood: {
          type: "score",
          instructions: "How the character feels toward the user right now, from the user's words and the user's face",
          criteria: ["Cold, wants to leave", "Guarded", "Neutral", "Friendly, engaged", "Charmed, fully won over"],
        },
      },
    ),
    jev(String(lastUserTurn), { blocked: BLOCKED }),
  ]);
  return Response.json({
    goalReached: a.goal.noul > 0.7,
    lost: a.lost.noul > 0.75,
    mood: Math.round((a.mood.score / 4) * 100),
    flagged: mod.blocked.noul > 0.8,
  });
}
