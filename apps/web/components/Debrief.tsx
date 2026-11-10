"use client";

import { useEffect, useState } from "react";
import type { Scene } from "@/lib/scenes";
import type { CallResult } from "./Call";

type Report = {
  passed: boolean;
  summary: string;
  notes: string[];
  scores: { label: string; pct: number }[];
  voice: { label: string; value: number; tip: string }[];
  face: { label: string; pct: number; tip: string }[];
};

// A line chart of values in [0, max]. Stretches to its box.
function Line({ values, max, label }: { values: number[]; max: number; label: string }) {
  const pts = (values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]).map(
    (v, i, all) => `${(i / (all.length - 1)) * 100},${38 - (Math.min(v, max) / max) * 36}`,
  );
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label} className="h-28 w-full overflow-visible">
      <line x1="0" x2="100" y1="20" y2="20" stroke="var(--color-hairline)" strokeDasharray="1 2" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,40 ${pts.join(" ")} 100,40`} fill="var(--color-ember)" opacity="0.12" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--color-ember)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Meter({ label, pct, tip }: { label: string; pct: number; tip?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => setW(pct), [pct]); // grow from zero on mount
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="kicker !text-paper">{label}</span>
        <span className="font-mono text-sm text-ember">{pct}</span>
      </div>
      <div className="relative mt-2 h-px bg-hairline">
        <div className="absolute inset-y-0 left-0 bg-ember transition-[width] duration-1000 ease-cinema" style={{ width: `${w}%` }} />
        <div className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember transition-[left] duration-1000 ease-cinema" style={{ left: `${w}%` }} />
      </div>
      {tip && <p className="mt-2 text-sm text-paper-dim">{tip}</p>}
    </div>
  );
}

function Block({ title, n, children, className = "" }: { title: string; n: number; children: React.ReactNode; className?: string }) {
  return (
    <section style={{ animationDelay: `${150 + n * 110}ms` }} className={`animate-rise border-t border-hairline pt-5 ${className}`}>
      <h2 className="kicker mb-5">{title}</h2>
      {children}
    </section>
  );
}

export default function Debrief({ scene, result, onAgain, onHome }: { scene: Scene; result: CallResult; onAgain: () => void; onHome: () => void }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (result.blocked || !result.transcript.includes("User:")) return;
    (async () => {
      let audio = null;
      if (result.audio) {
        const res = await fetch("/api/audio", { method: "POST", headers: { "Content-Type": result.audio.type }, body: result.audio });
        if (res.ok) audio = await res.json();
      }
      const res = await fetch("/api/debrief", {
        method: "POST",
        body: JSON.stringify({ goal: scene.judgeGoal ?? scene.goal, transcript: result.transcript, face: result.face, audio }),
      });
      if (!res.ok) return setError("The debrief failed. Check the TypeSafe API key.");
      setReport(await res.json());
    })();
  }, [scene, result]);

  const buttons = (
    <div className="mt-14 flex gap-8">
      <button onClick={onAgain} className="btn">Try again</button>
      <button onClick={onHome} className="btn btn-ghost">Other scenes</button>
    </div>
  );

  if (result.blocked)
    return <Shell title="Scene stopped" sub="The conversation broke the content rules.">{buttons}</Shell>;
  if (!result.transcript.includes("User:"))
    return <Shell title="Nothing said" sub="The scene ended before the conversation started.">{buttons}</Shell>;
  if (error) return <Shell title="Error" sub={error}>{buttons}</Shell>;
  if (!report) return <Shell title="Reviewing" sub="Script, voice and face." pulse />;

  return (
    <Shell title={report.passed ? "Passed" : "Not yet"} sub={report.summary} accent={report.passed} goal={scene.goal}>
      <div className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-12">
        {result.snapshot && (
          <Block title="Your best moment" n={0} className="md:col-span-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.snapshot} alt="Camera frame at your widest smile" className="aspect-[4/3] w-full object-cover" />
          </Block>
        )}
        <Block title="How they warmed to you" n={1} className={result.snapshot ? "md:col-span-8" : "md:col-span-12"}>
          <div className={result.snapshot ? "md:[&>svg]:h-52" : ""}>
            <Line values={result.moodLine} max={100} label="Character mood after each of your turns" />
          </div>
          <div className="kicker mt-2 flex justify-between">
            <span>Start</span>
            <span>End · {result.moodLine.at(-1)}/100</span>
          </div>
        </Block>

        <Block title="Script" n={2} className="md:col-span-4">
          <div className="space-y-6">
            {report.scores.map((s) => <Meter key={s.label} {...s} />)}
          </div>
        </Block>

        <Block title="Voice" n={3} className="md:col-span-4">
          {report.voice.length ? (
            <div className="space-y-5">
              {report.voice.map((v) => (
                <div key={v.label} className="flex items-baseline gap-4">
                  <span className="w-20 font-display text-5xl font-light text-ember">{v.value}</span>
                  <span>
                    <span className="kicker block !text-paper">{v.label}</span>
                    <span className="text-sm text-paper-dim">{v.tip}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-paper-dim">No audio recorded.</p>
          )}
        </Block>

        <Block title="Face" n={4} className="md:col-span-4">
          {report.face.length ? (
            <div className="space-y-6">
              {report.face.map((f) => <Meter key={f.label} {...f} />)}
              {result.smileLine.length > 2 && (
                <div>
                  <span className="kicker">Smile over time</span>
                  <div className="[&>svg]:h-12">
                    <Line values={result.smileLine} max={1} label="Your smile over the scene" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-paper-dim">No face detected.</p>
          )}
        </Block>

        {report.notes.length > 0 && (
          <Block title="Say this next time" n={5} className="md:col-span-12">
            <ol className="grid gap-8 md:grid-cols-3">
              {report.notes.map((t, i) => (
                <li key={t}>
                  <span className="font-mono text-sm text-ember">0{i + 1}</span>
                  <p className="mt-2 font-display text-xl leading-snug">{t}</p>
                </li>
              ))}
            </ol>
          </Block>
        )}
      </div>
      {buttons}
    </Shell>
  );
}

function Shell({ title, sub, children, accent, goal, pulse }: { title: string; sub: string; children?: React.ReactNode; accent?: boolean; goal?: string; pulse?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-6xl animate-rise px-5 py-14 md:px-10 md:py-20">
      <p className="kicker">The verdict{goal ? ` · ${goal}` : ""}</p>
      <h1 className={`mt-3 font-display text-7xl font-light uppercase leading-[0.9] md:text-9xl ${accent ? "text-ember" : ""} ${pulse ? "animate-pulse" : ""}`}>{title}</h1>
      <p className="mt-5 max-w-2xl font-display text-2xl italic leading-snug text-paper/85">{sub}</p>
      {children}
    </main>
  );
}
