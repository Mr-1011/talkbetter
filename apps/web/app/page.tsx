"use client";

import { useEffect, useRef, useState } from "react";
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
  const introRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef(stage); // the current stage, for code that runs after an await
  stageRef.current = stage;
  const [hover, setHover] = useState(""); // id of the card under the pointer; its cover fills the page background

  // Preview of the debrief with a sample scene: open /?demo=debrief or /?demo=interview
  useEffect(() => {
    const demo = new URLSearchParams(location.search).get("demo");
    if (!demo) return;
    const interview = demo === "interview";
    if (interview) setScene(scenes[1]);
    setResult({
      transcript: interview
        ? "Character: Thanks for coming in. Take a seat. So, tell me about yourself.\nUser: Um, yeah, so I am a product manager, I kind of did a lot of things, like, at my last company.\nCharacter: Give me one project you are proud of.\nUser: We rebuilt the onboarding flow. Activation went from 31 to 47 percent in one quarter. I led a team of five.\nCharacter: Tell me about a failure.\nUser: I shipped a pricing change without talking to sales first. We lost two big accounts. Now I run every pricing change past sales a week before launch.\nCharacter: Why this company?\nUser: I guess because it is growing fast and, um, it seems cool.\nCharacter: I need a bit more than that. We will be in touch."
        : "Character: Oh, hi. Sure, the seat is free.\nUser: Thanks. Um, sorry, what are you reading?\nCharacter: A novel about Lisbon.\nUser: I love Lisbon. What is the best part so far?\nCharacter: The food scenes. They make me hungry.\nUser: Then let me take you for pasteis de nata. Can I get your number?\nCharacter: Ha, okay. It is 555 0134.",
      face: interview ? { smile: 0.14, tension: 0.36, eyeContact: 0.52, samples: 60 } : { smile: 0.34, tension: 0.12, eyeContact: 0.71, samples: 40 },
      audio: null,
      blocked: false,
      goalReached: !interview,
      moodLine: interview ? [50, 38, 61, 70, 44] : [50, 42, 55, 68, 86],
      smileLine: interview ? [0.1, 0.08, 0.05, 0.2, 0.3, 0.25, 0.1, 0.05, 0.12, 0.3, 0.2, 0.08, 0.05, 0.04] : [0.1, 0.12, 0.2, 0.15, 0.3, 0.5, 0.42, 0.3, 0.55, 0.7, 0.6, 0.4, 0.45, 0.8],
      snapshot: interview ? "/scenes/interview.jpg" : "/scenes/cafe.jpg",
    });
    setStage("debrief");
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
    introRef.current?.play();
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
    // The intro comes in steps: the cover first, the video some minutes later. Ask again until the video is there.
    for (let i = 0; i < 60; i++) {
      const media: { cover?: string; still?: string; video?: string } | null = await fetch("/api/intro", { method: "POST", body: JSON.stringify({ id: s.id }) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!media) return;
      // A video that arrives after the scene has started must not cover the call.
      const { video, ...rest } = media;
      setScene((cur) => (cur.id === s.id ? { ...cur, ...(stageRef.current === "title" ? media : rest) } : cur));
      if (video) return;
      if (media.cover) await new Promise((r) => setTimeout(r, 10000));
    }
  };

  const card = (s: Scene, i: number) => (
    <button
      key={s.id}
      onClick={() => open(s)}
      onMouseEnter={() => setHover(s.id)}
      onMouseLeave={() => setHover("")}
      onFocus={() => setHover(s.id)}
      onBlur={() => setHover("")}
      style={{ animationDelay: `${i * 60}ms` }}
      className="group animate-rise text-left"
    >
      {/* Film poster: tagline at the top, title set large over the cover. Sizes follow the card width. */}
      <div className="@container relative aspect-[2/3] overflow-hidden">
        <Cover scene={s} className="absolute inset-0 transition-transform duration-[450ms] ease-cinema group-hover:scale-[1.03]" />
        {s.tagline && (
          <span className="absolute inset-x-0 top-0 hidden bg-gradient-to-b from-night-deep/70 to-transparent px-[6cqw] pb-[12cqw] pt-[6cqw] text-center font-mono text-[3cqw] uppercase leading-snug tracking-[0.12em] text-paper/90 @3xs:block">
            {s.tagline}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-deep via-night-deep/60 to-transparent px-[5cqw] pb-[7cqw] pt-[30cqw]">
          <span className="block text-balance text-center font-poster text-[17cqw] uppercase leading-[0.86] text-paper">{s.title}</span>
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
        {/* Page background: the intro still of the hovered card, dimmed so the text stays readable. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {scenes.map(
            (s) =>
              s.video && (
                <div
                  key={s.id}
                  className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-cinema ${hover === s.id ? "opacity-45" : "opacity-0"}`}
                  // The first frame of the intro video, the same picture as the title page: public/scenes/<id>-still.jpg
                  style={{ backgroundImage: `url(${s.video.replace(".mp4", "-still.jpg")})` }}
                />
              ),
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/30" />
        </div>
        <div className="mb-6 mt-8 flex animate-rise items-center justify-between gap-6">
          <h1 className="font-display text-4xl font-light leading-none sm:text-5xl">Step into a scene</h1>
          <span className="kicker hidden text-right leading-[1.6] sm:block">
            Live voice scenes
            <br />
            with a debrief
          </span>
        </div>

        <div className="grid grid-cols-2 items-start gap-x-5 gap-y-9 lg:grid-cols-4">
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
        </div>
      </main>
    );

  if (stage === "debrief" && result)
    return <Debrief scene={scene} result={result} onAgain={() => setStage("title")} onHome={() => setStage("pick")} />;

  // title, intro and call share one full-screen stage so the video and the call feel like one shot.
  const prebuilt = scene.video?.startsWith("/");
  const still = prebuilt ? scene.video!.replace(".mp4", "-still.jpg") : scene.still;
  return (
    <main className="relative h-dvh overflow-hidden bg-night-deep">
      {/* The cover is the last frame of the intro, so a change from the cover to the video would jump.
          A pre-built scene shows the first frame at once (the start page has loaded it).
          A custom scene shows the cover until the first frame arrives; in the call the cover is the background again. */}
      {!prebuilt && <Cover scene={scene} className="absolute inset-0" />}
      {still && stage !== "call" && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${still})` }} />}
      {/* The title page shows the first frame of the intro. "Start scene" plays it from there. */}
      {scene.video && (
        <video
          ref={introRef}
          key={scene.video}
          src={`${scene.video}#t=0.001`}
          preload="auto"
          poster={still}
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          // shortcut: the pre-built files are levelled at -24 dB; a custom scene comes from the model at -14 to -25 dB. 0.6 puts it in the middle, level it on the server when ffmpeg is available there.
          onLoadedMetadata={(e) => (e.currentTarget.volume = scene.video!.startsWith("/") ? 1 : 0.6)}
          onEnded={() => setStage("call")}
          onError={() => {
            // No intro file: the cover stays, and the scene starts without the intro.
            setScene((s) => ({ ...s, video: undefined }));
            setStage((st) => (st === "intro" ? "call" : st));
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
