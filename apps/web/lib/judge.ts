// Server only. TypeSafe Jev: typed questions about a state, structured answers. https://docs.typesafe.ai
type Question =
  | { type: "noul"; instructions: string }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };
type Answer = { noul: number; score: number; choice: string };

export async function jev<K extends string>(state: unknown, questions: Record<K, Question>): Promise<Record<K, Answer>> {
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}` },
    body: JSON.stringify({ model: "jev-latest", state, questions }),
  });
  if (!res.ok) throw new Error(`typesafe ${res.status}: ${await res.text()}`);
  return (await res.json()).answers;
}

export const BLOCKED: Question = {
  type: "noul",
  instructions:
    "The text contains sexual content, minors in a romantic or sexual context, hate, harassment, self-harm, graphic violence or illegal acts",
};
