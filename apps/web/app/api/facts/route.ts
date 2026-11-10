import { BLOCKED, jev } from "@/lib/judge";

// One Exa call at scene start: public facts about the investor or company the user named.
export async function POST(req: Request) {
  const { name } = await req.json();
  if (typeof name !== "string" || !name.trim() || name.length > 80) return Response.json({ facts: "" });
  if ((await jev(name, { blocked: BLOCKED })).blocked.noul > 0.5) return Response.json({ facts: "" });

  const res = await fetch("https://api.exa.ai/answer", {
    method: "POST",
    headers: { "x-api-key": process.env.EXA_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `Key public facts about ${name}: what they do, recent news, what they care about. Five short bullet points.`,
    }),
  });
  if (!res.ok) return Response.json({ facts: "" });
  const { answer } = await res.json();
  return Response.json({ facts: String(answer).replace(/\[\d+\]/g, "").slice(0, 1500) });
}
