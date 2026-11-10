import { jev } from "@/lib/judge";
import { ask } from "@/lib/llm";

const levels = (low: string, mid: string, high: string) => [low, mid, high];
// Each rubric: [label, instructions, criteria, tip shown when the score is not high]
const RUBRIC = {
  curiosity: ["Curiosity", "How much the user asks about the other person and builds on their answers",
    levels("Talks only about themselves", "Asks some questions", "Asks follow-up questions that build on the answers"),
    "Ask one follow-up question on what they just said before you make your next point."],
  clarity: ["Clarity", "How clear and concrete the user's statements are",
    levels("Vague or rambling", "Mostly clear", "Short, concrete, with specifics"),
    "Say it in one sentence, then give one concrete example or number."],
  confidence: ["Confidence", "How confident the user's wording is",
    levels("Apologetic, hedging", "Some hedging", "Direct and calm"),
    "Drop the hedges (\"maybe\", \"kind of\", \"sorry\"). State what you want."],
  ask: ["The ask", "Whether the user clearly asked for the goal",
    levels("Never asked", "Hinted at it", "Asked clearly at a good moment"),
    "Make the ask out loud. Hints do not count."],
} as const;

export async function POST(req: Request) {
  const { goal, transcript, face, audio } = await req.json();
  const keys = Object.keys(RUBRIC) as (keyof typeof RUBRIC)[];
  const notesP = ask<{ summary: string; script: string[] }>(
    `You are a direct, kind conversation coach. The user practiced a scene by voice. Goal: "${goal}".
Return {"summary": string, "script": string[]}.
summary: one short sentence on how it went. Do not state pass or fail.
script: 2 or 3 notes, max 25 words each. Each note quotes the user's own words and says what to say instead.`,
    String(transcript),
  ).catch(() => null);
  const a = await jev(
    { goal, transcript },
    {
      passed: { type: "noul", instructions: `The character has clearly granted the user's goal: ${goal}` },
      ...Object.fromEntries(keys.map((k) => [k, { type: "score", instructions: RUBRIC[k][1], criteria: RUBRIC[k][2] }])),
    } as Record<"passed" | keyof typeof RUBRIC, { type: "noul"; instructions: string }>,
  );
  const passed = a.passed.noul > 0.6;

  const script = keys.map((k) => {
    const pct = Math.round((a[k].score / 2) * 100);
    return `${RUBRIC[k][0]} ${pct}%${pct < 70 ? ` - ${RUBRIC[k][3]}` : " - Strong."}`;
  });

  const voice: string[] = [];
  if (audio?.words) {
    voice.push(`Pace ${audio.wpm} words per minute${audio.wpm > 175 ? " - Slow down. Fast speech sounds nervous." : audio.wpm < 110 ? " - Speak a little faster to keep energy." : " - Good pace."}`);
    voice.push(`${audio.fillers} filler words${audio.fillers > 3 ? " - Replace \"um\" with a short silence." : " - Clean."}`);
    voice.push(`${audio.longPauses} long pauses${audio.longPauses > 3 ? " - Prepare your next point while they talk." : " - Good flow."}`);
  }

  const faceTips: string[] = [];
  if (face) {
    faceTips.push(`Smile ${Math.round(face.smile * 100)}%${face.smile < 0.2 ? " - Smile more. It makes your voice warmer too." : " - Warm."}`);
    faceTips.push(`Eye contact ${Math.round(face.eyeContact * 100)}%${face.eyeContact < 0.6 ? " - Look at the camera when you make your key point." : " - Steady."}`);
    faceTips.push(`Brow tension ${Math.round(face.tension * 100)}%${face.tension > 0.3 ? " - Relax your forehead. You look worried." : " - Relaxed."}`);
  }

  const notes = await notesP;

  return Response.json({
    passed,
    summary: notes?.summary ?? (passed ? "You reached the goal." : "You did not reach the goal this time."),
    script: notes?.script ?? script,
    audio: voice,
    face: faceTips,
  });
}
