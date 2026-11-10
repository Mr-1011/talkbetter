import { audioStats } from "@/lib/audioStats";

// Body: the user's recorded mic audio. Returns delivery stats from Deepgram pre-recorded STT.
export async function POST(req: Request) {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&filler_words=true&sentiment=true&utterances=true&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": req.headers.get("content-type") ?? "audio/webm",
      },
      body: await req.arrayBuffer(),
    },
  );
  if (!res.ok) return Response.json({ error: await res.text() }, { status: 502 });
  const { results } = await res.json();
  return Response.json({
    ...audioStats(results.channels[0].alternatives[0].words),
    sentiment: results.sentiments?.average,
  });
}
