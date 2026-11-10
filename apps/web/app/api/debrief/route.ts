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

  const scores = keys.map((k) => ({ label: RUBRIC[k][0] as string, pct: Math.round((a[k].score / 2) * 100) }));
  const fixedTips = keys.filter((_, i) => scores[i].pct < 70).map((k) => RUBRIC[k][3] as string);

  const voice = audio?.words
    ? [
        { label: "Words per minute", value: audio.wpm, tip: audio.wpm > 175 ? "Slow down" : audio.wpm < 110 ? "More energy" : "Good pace" },
        { label: "Filler words", value: audio.fillers, tip: audio.fillers > 3 ? "Pause instead of \"um\"" : "Clean" },
        { label: "Long pauses", value: audio.longPauses, tip: audio.longPauses > 3 ? "Plan your next point" : "Good flow" },
      ]
    : [];

  const faceStats = face
    ? [
        { label: "Smile", pct: Math.round(face.smile * 100), tip: face.smile < 0.2 ? "Smile more" : "Warm" },
        { label: "Eye contact", pct: Math.round(face.eyeContact * 100), tip: face.eyeContact < 0.6 ? "Look at the camera" : "Steady" },
        { label: "Calm brow", pct: Math.round((1 - face.tension) * 100), tip: face.tension > 0.3 ? "Relax your forehead" : "Relaxed" },
      ]
    : [];

  const notes = await notesP;

  return Response.json({
    passed,
    summary: notes?.summary ?? (passed ? "You reached the goal." : "You did not reach the goal this time."),
    notes: notes?.script ?? fixedTips,
    scores,
    voice,
    face: faceStats,
  });
}
