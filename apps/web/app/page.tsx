"use client";

import { useState } from "react";
import Call, { type CallResult } from "@/components/Call";
import Debrief from "@/components/Debrief";
import { scenes, type Scene } from "@/lib/scenes";

type Stage = "pick" | "title" | "intro" | "call" | "debrief";

function Cover({ scene, className = "" }: { scene: Scene; className?: string }) {
  // The image sits on top of the gradient. A missing file shows the gradient.
  return (
    <div className={`bg-gradient-to-br ${scene.gradient} ${className}`}>
      {scene.cover && <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${scene.cover})` }} />}
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("pick");
  const [scene, setScene] = useState<Scene>(scenes[0]);
  const [result, setResult] = useState<CallResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  const start = async () => {
    if (scene.lookup && name.trim()) {
      setBusy(true);
      const { facts } = await fetch("/api/facts", { method: "POST", body: JSON.stringify({ name }) })
        .then((r) => r.json())
        .catch(() => ({ facts: "" }));
      setBusy(false);
      if (facts)
        setScene((s) => ({
          ...s,
          systemPrompt: `${s.systemPrompt}\nYou are from ${name}. Public facts about ${name}; use them to ask specific questions:\n${facts}`,
        }));
    }
    setStage(scene.video ? "intro" : "call");
  };

  const open = (s: Scene) => {
    setName("");
    setScene(s);
    setStage("title");
  };

  const createCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/scene", { method: "POST", body: JSON.stringify({ text }) });
    const s = await res.json().catch(() => ({}));
    setBusy(false);
    if (!s.allowed) return setError(s.reason ?? "The scene could not be created.");
    open(s);
    // Video pipeline (see /video/README.md). The title page shows at once; cover and video arrive later.
    fetch("/api/intro", { method: "POST", body: JSON.stringify({ imagePrompt: s.imagePrompt }) })
      .then((r) => (r.ok ? r.json() : {}))
      .then((media) => setScene((cur) => (cur.id === "custom" ? { ...cur, ...media } : cur)))
      .catch(() => {});
  };

  if (stage === "pick")
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-14">
        <header className="animate-rise">
          <p className="kicker">Prova · voice scene trainer</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] md:text-7xl">
            Rehearse the conversation <em className="text-ember">before</em> it counts.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-paper-dim">
            Step into a scene. Talk out loud to a character who talks back. Leave with a verdict and notes on your words, your voice and your face.
          </p>
        </header>

        <p className="kicker mt-14 animate-rise [animation-delay:120ms]">Now showing</p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => open(s)}
              style={{ animationDelay: `${180 + i * 90}ms` }}
              className="group relative aspect-[3/4] animate-rise overflow-hidden rounded-sm border border-hairline text-left transition-[border-color,translate] duration-500 ease-cinema hover:-translate-y-1 hover:border-ember"
            >
              <Cover scene={s} className="absolute inset-0 transition-transform duration-700 ease-cinema group-hover:scale-105" />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-night-deep via-night-deep/30 to-transparent p-4">
                <span className="kicker">Scene {String(i + 1).padStart(2, "0")}</span>
                <span className="mt-1 font-display text-2xl">{s.title}</span>
                <span className="mt-1 text-sm text-paper-dim">{s.goal}</span>
              </div>
            </button>
          ))}
        </div>

        <form onSubmit={createCustom} className="mt-14 animate-rise border-t border-hairline pt-8 [animation-delay:600ms]">
          <label htmlFor="custom" className="kicker">Or write your own scene</label>
          <textarea
            id="custom"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="I need to ask my landlord for a lower rent. He is stubborn."
            className="mt-3 w-full resize-none border-b border-hairline bg-transparent pb-3 font-display text-2xl outline-none transition-colors placeholder:text-paper-dim/50 focus:border-ember"
          />
          {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
          <button disabled={busy || !text.trim()} className="btn mt-5">
            {busy ? "Setting the scene..." : "Create scene"}
          </button>
        </form>
      </main>
    );

  if (stage === "debrief" && result)
    return <Debrief scene={scene} result={result} onAgain={() => setStage("title")} onHome={() => setStage("pick")} />;

  // title, intro and call share one full-screen stage so the video and the call feel like one shot.
  return (
    <main className="relative h-dvh overflow-hidden bg-night-deep">
      <Cover scene={scene} className="absolute inset-0" />
      {stage !== "title" && scene.video && (
        <video
          src={scene.video}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onEnded={() => setStage("call")}
          onError={(e) => {
            e.currentTarget.hidden = true;
            setStage("call");
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-night-deep/85 via-transparent to-night-deep/40" />

      {stage === "title" && (
        <div key={scene.id} className="absolute inset-0 flex flex-col items-start justify-end p-8 pb-16 md:p-16">
          <p className="kicker animate-rise">A scene in one take</p>
          <h1 className="mt-3 animate-rise font-display text-6xl [animation-delay:90ms] md:text-8xl">{scene.title}</h1>
          <p className="mt-4 animate-rise text-xl text-paper-dim [animation-delay:180ms]">
            Your goal: <span className="text-paper">{scene.goal}</span>
          </p>
          {scene.lookup && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-label={scene.lookup}
              placeholder={scene.lookup}
              className="mt-6 w-full max-w-md animate-rise border-b border-hairline bg-transparent pb-2 font-display text-xl outline-none placeholder:text-paper-dim focus:border-ember [animation-delay:230ms]"
            />
          )}
          <div className="mt-8 flex animate-rise items-center gap-3 [animation-delay:270ms]">
            <button onClick={start} disabled={busy} className="btn px-10 text-lg">
              {busy ? "Researching..." : "Start scene"}
            </button>
            <button onClick={() => setStage("pick")} className="btn btn-ghost">Back</button>
          </div>
          <p className="kicker mt-6 animate-rise [animation-delay:360ms]">Uses your microphone and camera · video stays on your device</p>
        </div>
      )}
      {stage === "intro" && (
        <button
          onClick={() => {
            // Jump to the last frame: it is the still background of the call.
            const v = document.querySelector("video")!;
            v.currentTime = v.duration || 0;
            setStage("call");
          }}
          className="btn btn-ghost absolute bottom-8 right-8 bg-night-deep/60 backdrop-blur"
        >
          Skip intro
        </button>
      )}
      {stage === "call" && (
        <Call
          scene={scene}
          onEnd={(r) => {
            setResult(r);
            setStage("debrief");
          }}
        />
      )}
    </main>
  );
}
