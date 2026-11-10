// Server only. Claude writes text (debrief notes, custom scene). TypeSafe stays the judge.
export async function ask<T>(system: string, user: string): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 1000,
      system: `${system}\nReply with one JSON object only. No other text.`,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const text: string = (await res.json()).content[0].text;
  return JSON.parse(text.match(/\{[\s\S]*\}/)![0]);
}
