"use client";

import { DrawingUtils, FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
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
  moodLine: number[]; // character mood after each user turn, 0-100
  smileLine: number[]; // one smile value per second, 0-1
  snapshot: string | null; // camera frame at the widest smile
};

type Sample = Omit<FaceStats, "samples">;

function average(samples: Sample[]): FaceStats | null {
  if (!samples.length) return null;
  const avg = (k: keyof Sample) => +(samples.reduce((a, s) => a + s[k], 0) / samples.length).toFixed(2);
  return { smile: avg("smile"), tension: avg("tension"), eyeContact: avg("eyeContact"), samples: samples.length };
}

export default function Call({ scene, onEnd }: { scene: Scene; onEnd: (r: CallResult) => void }) {
  const camRef = useRef<HTMLVideoElement>(null);
  const meshRef = useRef<HTMLCanvasElement>(null);
  const [mood, setMood] = useState(50);
  const [status, setStatus] = useState("Connecting...");
  const [caption, setCaption] = useState("");
  const [smile, setSmile] = useState(0);
  const [stamp, setStamp] = useState<"won" | "lost" | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    const lines: string[] = [];
    const samples: Sample[] = [];
    const chunks: Blob[] = [];
    const moodLine: number[] = [50];
    let snapshot: string | null = null;
    let bestSmile = -1;
    let blocked = false;
    let goalReached = false;
    let ending = false;
    let done = false;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let landmarker: FaceLandmarker | undefined;
    let raf = 0;

    let vapi: Vapi | undefined;

    // Keep the screen awake: a voice scene has no touch input, so a phone would lock.
    // The browser drops the lock when the page is hidden, so take it again when the page comes back.
    let wake: WakeLockSentinel | undefined;
    const stayAwake = () => {
      if (document.visibilityState === "visible")
        navigator.wakeLock?.request("screen").then(
          (w) => {
            if (done) w.release();
            else wake = w;
          },
          () => {},
        );
    };
    stayAwake();
    document.addEventListener("visibilitychange", stayAwake);

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", stayAwake);
      wake?.release();
      const result = () =>
        onEnd({
          transcript: lines.join("\n"),
          face: average(samples),
          audio: chunks.length ? new Blob(chunks, { type: recorder!.mimeType }) : null,
          blocked,
          goalReached,
          moodLine,
          smileLine: samples.map((s) => s.smile),
          snapshot,
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
      moodLine.push(t.mood);
      if (t.flagged) {
        blocked = true;
        stopRef.current();
      } else if (t.goalReached && !goalReached) {
        goalReached = true;
        setStamp("won");
        vapi?.send({
          type: "add-message",
          message: { role: "system", content: "The user reached the goal. Say one short, warm closing line in character and say goodbye." },
        });
        setTimeout(() => stopRef.current(), 9000);
      } else if (t.lost && !goalReached && !ending) {
        // The character has had enough: one last line, then the scene ends as failed.
        ending = true;
        setStamp("lost");
        vapi?.send({
          type: "add-message",
          message: { role: "system", content: "You have had enough of this conversation. Say one short, final line in character and leave." },
        });
        setTimeout(() => stopRef.current(), 8000);
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
        const pen = new DrawingUtils(meshRef.current!.getContext("2d")!);
        let lastFrame = -1;
        let lastSample = 0;
        // Every camera frame: draw the face mesh. Once per second: keep one sample for the stats.
        const tick = () => {
          if (done) return;
          raf = requestAnimationFrame(tick);
          const cam = camRef.current;
          const canvas = meshRef.current;
          if (!cam || !canvas || cam.readyState < 2 || cam.currentTime === lastFrame) return;
          lastFrame = cam.currentTime;
          const now = performance.now();
          const face = landmarker!.detectForVideo(cam, now);
          // Same pixel size as the camera frame, so object-cover crops the canvas like the video. Also clears it.
          canvas.width = cam.videoWidth;
          canvas.height = cam.videoHeight;
          const points = face.faceLandmarks[0];
          if (points) {
            pen.drawConnectors(points, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#f3eee666", lineWidth: 1.5 });
            pen.drawConnectors(points, FaceLandmarker.FACE_LANDMARKS_CONTOURS, { color: "#ec9f45", lineWidth: 4 });
          }
          const shapes = face.faceBlendshapes[0]?.categories;
          if (!shapes || now - lastSample < 1000) return;
          lastSample = now;
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
          if (s.smile > bestSmile) {
            bestSmile = s.smile;
            const shot = document.createElement("canvas");
            shot.width = 480;
            shot.height = (480 * cam.videoHeight) / cam.videoWidth;
            const ctx = shot.getContext("2d")!;
            ctx.scale(-1, 1); // mirror, like the preview
            ctx.drawImage(cam, -shot.width, 0, shot.width, shot.height);
            snapshot = shot.toDataURL("image/jpeg", 0.8);
          }
          setSmile(s.smile);
        };
        tick();
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
        if (m.role !== "user") setCaption(m.transcript);
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
        voice: { provider: "deepgram", model: "aura-2", voiceId: scene.voiceId as "asteria" },
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
        <div className="[text-shadow:0_1px_12px_rgba(16,15,13,0.9)]">
          <div className="kicker !text-paper">
            <span className={status === "Live" ? "animate-pulse text-ember" : ""}>● </span>
            {status}
          </div>
          <p className="kicker mt-4 !text-ember">Your goal</p>
          <p className="mt-1 max-w-[16rem] font-display text-xl font-light leading-snug md:max-w-xs md:text-2xl">{scene.goal}</p>
        </div>
        <div className="kicker w-32 !text-paper md:w-48 [text-shadow:0_1px_12px_rgba(16,15,13,0.9)]" aria-label={`Character mood ${mood} of 100`}>
          <div className="mb-2 flex justify-between">
            <span>cold</span>
            <span>warm</span>
          </div>
          <div className="relative h-px bg-hairline">
            <div className="absolute inset-y-0 left-0 bg-ember transition-[width] duration-700 ease-cinema" style={{ width: `${mood}%` }} />
            <div className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember transition-[left] duration-700 ease-cinema" style={{ left: `${mood}%` }} />
          </div>
        </div>
      </div>

      {stamp && (
        <div className="pointer-events-none absolute inset-0 flex animate-rise items-center justify-center" role="status">
          <p className={`-rotate-3 border-2 px-6 py-2 font-display text-5xl font-light uppercase tracking-tight md:text-8xl ${stamp === "won" ? "border-ember text-ember" : "border-paper text-paper"}`}>
            {stamp === "won" ? "Goal reached" : "Scene lost"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 items-end gap-4 md:grid-cols-[auto_1fr_auto]">
        <div className="relative order-2 justify-self-start md:order-1">
          <video ref={camRef} autoPlay muted playsInline className="h-24 w-32 -scale-x-100 md:h-32 md:w-44 border border-hairline bg-night-deep object-cover" />
          <canvas ref={meshRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          <span className="absolute bottom-1 left-2 text-xs drop-shadow">{smile > 0.4 ? "😊" : "😐"}</span>
        </div>
        <p key={caption.slice(0, 12)} className="order-1 col-span-2 min-h-16 animate-rise text-center md:order-2 md:col-span-1 font-display text-2xl leading-snug [text-shadow:0_1px_14px_rgba(16,15,13,0.95)] md:text-3xl" aria-live="polite">
          {caption}
        </p>
        <button
          onClick={() => stopRef.current()}
          className="btn btn-ghost order-3 justify-self-end !text-paper"
        >
          End scene
        </button>
      </div>
    </div>
  );
}
