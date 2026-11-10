"use client";

import { useEffect, useState } from "react";
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
  const [gallery, setGallery] = useState<Scene[]>([]); // custom scenes of all users

  useEffect(() => {
    fetch("/api/scene")
      .then((r) => r.json())
      .then(setGallery)
      .catch(() => {});
  }, []);

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
    setGallery((g) => [s, ...g]);
    // Video pipeline (see /video/README.md). The title page shows at once; cover and video arrive later.
    fetch("/api/intro", { method: "POST", body: JSON.stringify({ imagePrompt: s.imagePrompt }) })
      .then((r) => (r.ok ? r.json() : {}))
      .then((media) => setScene((cur) => (cur.id === s.id ? { ...cur, ...media } : cur)))
      .catch(() => {});
  };

  const card = (s: Scene, i: number) => (
    <button
      key={s.id}
      onClick={() => open(s)}
      style={{ animationDelay: `${i * 60}ms` }}
      className="group animate-rise text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <Cover scene={s} className="absolute inset-0 transition-transform duration-[450ms] ease-cinema group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-deep/90 to-transparent p-3 pt-16 md:p-4 md:pt-20">
          <span className="block font-display text-2xl font-light uppercase leading-none md:text-3xl">{s.title}</span>
        </div>
      </div>
      <span className="mt-3 block font-display text-lg italic leading-snug text-paper/85 transition-colors duration-300 group-hover:text-paper md:text-xl">
        {s.goal}
      </span>
    </button>
  );

  if (stage === "pick")
    return (
      <main className="mx-auto w-full max-w-7xl px-5 pb-12 md:px-10">
        <header className="flex h-16 animate-rise items-center gap-3">
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="font-display text-xl">Talk Better</span>
        </header>

        <div className="mb-6 mt-4 flex animate-rise items-center justify-between gap-6">
          <h1 className="font-display text-3xl font-light leading-none sm:text-4xl">Pick a scene. Say it out loud.</h1>
          <span className="kicker hidden text-right leading-[1.6] sm:block">
            Live voice scenes
            <br />
            with a debrief
          </span>
        </div>

        <div className="grid grid-cols-2 items-start gap-x-5 gap-y-9 lg:grid-cols-5">
          {scenes.map(card)}

          <form
            onSubmit={createCustom}
            style={{ animationDelay: `${scenes.length * 60}ms` }}
            className="col-span-2 animate-rise lg:col-span-1"
          >
            <div className="flex aspect-[4/3] flex-col border border-hairline p-3 transition-colors duration-300 focus-within:border-ember md:p-4 lg:aspect-[2/3]">
              <label htmlFor="custom" className="kicker !text-ember">+ Your own scene</label>
              <textarea
                id="custom"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                placeholder="Ask my landlord for a lower rent..."
                className="mt-3 w-full flex-1 resize-none bg-transparent font-display text-xl leading-snug outline-none placeholder:text-paper-dim/60"
              />
              {error && <p role="alert" className="mb-2 text-sm text-red-400">{error}</p>}
              <button disabled={busy || !text.trim()} className="btn self-start">
                {busy ? "Setting the scene" : "Create"}
              </button>
            </div>
          </form>
          {gallery.map((s, i) => card(s, scenes.length + 1 + i))}
        </div>
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
                    <h1 className="mt-3 animate-rise font-display text-6xl font-light uppercase leading-[0.95] tracking-tight [animation-delay:90ms] md:text-8xl">{scene.title}</h1>
          <div className="mt-7 animate-rise border-l border-ember pl-5 [animation-delay:180ms]">
            <p className="kicker !text-ember">Your goal</p>
            <p className="mt-1 font-display text-3xl font-light text-ember md:text-4xl">{scene.goal}</p>
          </div>
          {scene.lookup && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-label={scene.lookup}
              placeholder={scene.lookup}
              className="mt-6 w-full max-w-md animate-rise border-b border-hairline bg-transparent pb-2 font-display text-lg outline-none placeholder:text-paper-dim focus:border-ember md:text-xl [animation-delay:230ms]"
            />
          )}
          <div className="mt-9 flex animate-rise items-center gap-8 [animation-delay:270ms]">
            <button onClick={start} disabled={busy} className="btn !text-base">
              {busy ? "Researching..." : "Start scene"}
            </button>
            <button onClick={() => setStage("pick")} className="btn btn-ghost">Back</button>
          </div>
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
          className="btn btn-ghost absolute bottom-8 right-8"
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
