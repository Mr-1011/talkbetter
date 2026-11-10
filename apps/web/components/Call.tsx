"use client";

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/scenes";

export type FaceStats = { smile: number; tension: number; eyeContact: number; samples: number };
export type CallResult = {
  transcript: string;
  face: FaceStats | null;
  audio: Blob | null;
  blocked: boolean;
  goalReached: boolean;
};

type Sample = Omit<FaceStats, "samples">;

function average(samples: Sample[]): FaceStats | null {
  if (!samples.length) return null;
  const avg = (k: keyof Sample) => +(samples.reduce((a, s) => a + s[k], 0) / samples.length).toFixed(2);
  return { smile: avg("smile"), tension: avg("tension"), eyeContact: avg("eyeContact"), samples: samples.length };
}

export default function Call({ scene, onEnd }: { scene: Scene; onEnd: (r: CallResult) => void }) {
  const camRef = useRef<HTMLVideoElement>(null);
  const [mood, setMood] = useState(50);
  const [status, setStatus] = useState("Connecting...");
  const [caption, setCaption] = useState("");
  const [smile, setSmile] = useState(0);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    const lines: string[] = [];
    const samples: Sample[] = [];
    const chunks: Blob[] = [];
    let blocked = false;
    let goalReached = false;
    let done = false;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let landmarker: FaceLandmarker | undefined;
    let timer: ReturnType<typeof setInterval>;

    let vapi: Vapi | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      const result = () =>
        onEnd({
          transcript: lines.join("\n"),
          face: average(samples),
          audio: chunks.length ? new Blob(chunks, { type: recorder!.mimeType }) : null,
          blocked,
          goalReached,
        });
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = result;
        recorder.stop();
      } else result();
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
    stopRef.current = () => {
      vapi?.stop();
      finish();
    };

    const judgeTurn = async (lastUserTurn: string) => {
      const res = await fetch("/api/turn", {
        method: "POST",
        body: JSON.stringify({ goal: scene.judgeGoal ?? scene.goal, transcript: lines.join("\n"), lastUserTurn, face: average(samples.slice(-8)) }),
      });
      if (!res.ok || done) return;
      const t = await res.json();
      setMood(t.mood);
      if (t.flagged) {
        blocked = true;
        stopRef.current();
      } else if (t.goalReached && !goalReached) {
        goalReached = true;
        setStatus("Goal reached!");
        vapi?.send({
          type: "add-message",
          message: { role: "system", content: "The user reached the goal. Say one short, warm closing line in character and say goodbye." },
        });
        setTimeout(() => stopRef.current(), 9000);
      } else {
        vapi?.send({
          type: "add-message",
          message: { role: "system", content: `Your current mood toward the user is ${t.mood}/100 (0 cold, 100 warm). Let it show in your tone.` },
          triggerResponseEnabled: false,
        });
      }
    };

    (async () => {
      // Camera and recorder are optional. The call works without them.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (done) return stream.getTracks().forEach((t) => t.stop());
        camRef.current!.srcObject = stream;
        recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.start();

        const files = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm",
        );
        landmarker = await FaceLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
        });
        timer = setInterval(() => {
          const cam = camRef.current;
          if (!cam || cam.readyState < 2) return;
          const shapes = landmarker!.detectForVideo(cam, performance.now()).faceBlendshapes[0]?.categories;
          if (!shapes) return;
          const v = (n: string) => shapes.find((c) => c.categoryName === n)?.score ?? 0;
          const look = Math.max(
            ...["eyeLookOutLeft", "eyeLookInLeft", "eyeLookUpLeft", "eyeLookDownLeft"].map(v),
          );
          const s = {
            smile: (v("mouthSmileLeft") + v("mouthSmileRight")) / 2,
            tension: (v("browDownLeft") + v("browDownRight")) / 2,
            eyeContact: 1 - look,
          };
          samples.push(s);
          setSmile(s.smile);
        }, 1000);
      } catch (e) {
        console.warn("camera/face tracking off", e);
      }
    })();

    (async () => {
      const res = await fetch("/api/vapi-token", { method: "POST" });
      if (!res.ok || done) return setStatus("Call error. Check the Vapi key.");
      const v = (vapi = new Vapi((await res.json()).token));
      v.on("call-start", () => setStatus("Live"));
      v.on("call-end", finish);
      v.on("error", (e) => {
        console.error(e);
        setStatus("Call error. Check the Vapi key.");
      });
      v.on("message", (m) => {
        if (m.type !== "transcript") return;
        setCaption(`${m.role === "user" ? "You" : "Them"}: ${m.transcript}`);
        if (m.transcriptType !== "final") return;
        lines.push(`${m.role === "user" ? "User" : "Character"}: ${m.transcript}`);
        if (m.role === "user") judgeTurn(m.transcript);
      });

      v.start({
        name: scene.title,
        ...(scene.firstMessage
          ? { firstMessage: scene.firstMessage }
          : { firstMessageMode: "assistant-speaks-first-with-model-generated-message" as const }),
        maxDurationSeconds: 300,
        transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
        voice: { provider: "deepgram", voiceId: scene.voiceId as "asteria" },
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [{ role: "system", content: `${scene.systemPrompt}\nThe user's goal in this scene: ${scene.goal}` }],
        },
      });
    })();

    return () => {
      vapi?.stop();
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 flex animate-rise flex-col justify-between p-5">
      <div className="flex items-start justify-between">
        <div className="kicker rounded-full border border-hairline bg-night-deep/60 px-4 py-2 backdrop-blur">
          <span className={status === "Live" ? "animate-pulse text-ember" : ""}>● </span>
          {status} · {scene.goal}
        </div>
        <div className="kicker w-44 rounded-sm border border-hairline bg-night-deep/60 p-3 backdrop-blur" aria-label={`Character mood ${mood} of 100`}>
          <div className="mb-1 flex justify-between">
            <span>cold</span>
            <span>warm</span>
          </div>
          <div className="h-1 rounded bg-hairline">
            <div
              className="h-1 rounded bg-ember transition-all duration-700 ease-cinema"
              style={{ width: `${mood}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="relative">
          <video ref={camRef} autoPlay muted playsInline className="h-32 w-44 -scale-x-100 rounded-sm border border-hairline bg-night-deep object-cover" />
          <span className="absolute bottom-1 left-2 text-xs drop-shadow">{smile > 0.4 ? "😊" : "😐"}</span>
        </div>
        <p className="min-h-6 flex-1 text-center font-display text-2xl drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" aria-live="polite">
          {caption}
        </p>
        <button
          onClick={() => stopRef.current()}
          className="btn btn-ghost bg-night-deep/60 backdrop-blur"
        >
          End scene
        </button>
      </div>
    </div>
  );
}
