import { BLOCKED, jev } from "@/lib/judge";

// Called after each user turn. The judge checks the win rule, each lose rule, the mood and the content.
export async function POST(req: Request) {
  const { win, lose, transcript, lastUserTurn, face } = await req.json();
  const rules: string[] = Array.isArray(lose) ? lose.slice(0, 5).map(String) : [];
  const questions: Parameters<typeof jev>[1] = {
    win: { type: "noul", instructions: String(win) },
    mood: {
      type: "score",
      instructions: "How the character feels toward the user right now, from the user's words and the user's face",
      criteria: ["Cold, wants to leave", "Guarded", "Neutral", "Friendly, engaged", "Charmed, fully won over"],
    },
  };
  rules.forEach((r, i) => (questions[`lose${i}`] = { type: "noul", instructions: r }));

  const [a, mod] = await Promise.all([
    jev({ transcript, userFace: face }, questions),
    jev(String(lastUserTurn), { blocked: BLOCKED }),
  ]);
  const won = a.win.noul > 0.7;
  return Response.json({
    goalReached: won,
    // The first lose rule that is clearly true, or -1.
    lost: won ? -1 : rules.findIndex((_, i) => a[`lose${i}`].noul > 0.75),
    mood: Math.round((a.mood.score / 4) * 100),
    flagged: mod.blocked.noul > 0.8,
  });
}
