"use client";

import { useEffect, useState } from "react";
import type { Scene } from "@/lib/scenes";
import type { CallResult } from "./Call";

type Report = { passed: boolean; summary: string; script: string[]; audio: string[]; face: string[] };

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
    <div className="mt-12 flex gap-8">
      <button onClick={onAgain} className="btn">Try again</button>
      <button onClick={onHome} className="btn btn-ghost">Other scenes</button>
    </div>
  );

  if (result.blocked)
    return <Shell title="Scene stopped" sub="The conversation broke the content rules.">{buttons}</Shell>;
  if (!result.transcript.includes("User:"))
    return <Shell title="Nothing said" sub="The scene ended before the conversation started.">{buttons}</Shell>;
  if (error) return <Shell title="Error" sub={error}>{buttons}</Shell>;
  if (!report) return <Shell title="Reviewing your scene..." sub="Script, voice and face." />;

  return (
    <Shell
      title={report.passed ? "Challenge passed." : "Challenge failed."}
      sub={report.summary}
    >
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {([["Script", report.script], ["Voice", report.audio], ["Face", report.face]] as const).map(([name, tips], n) => (
          <section key={name} style={{ animationDelay: `${200 + n * 110}ms` }} className="animate-rise border-t border-hairline pt-5">
            <h2 className="kicker mb-4">{name}</h2>
            {tips.length ? (
              <ul className="space-y-3 text-sm text-paper-dim">
                {tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-paper-dim">No data.</p>
            )}
          </section>
        ))}
      </div>
      {buttons}
    </Shell>
  );
}

function Shell({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl animate-rise px-6 py-20">
      <p className="kicker">The verdict</p>
      <h1 className="mt-3 font-display text-6xl font-light uppercase leading-[0.95] md:text-7xl">{title}</h1>
      <p className="mt-4 text-lg text-paper-dim">{sub}</p>
      {children}
    </main>
  );
}
