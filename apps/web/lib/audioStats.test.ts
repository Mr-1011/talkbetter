import assert from "node:assert";
import test from "node:test";
import { audioStats } from "./audioStats.ts";

test("audioStats counts fillers, pauses and pace", () => {
  const s = audioStats([
    { word: "um", start: 0, end: 0.5 },
    { word: "hello", start: 0.5, end: 1 },
    { word: "there", start: 2.5, end: 3 }, // 1.5 s pause
    { word: "again", start: 10, end: 10.5 }, // character's turn, not a pause
  ]);
  assert.deepEqual(s, { wpm: 69, fillers: 1, longPauses: 1, words: 4 });
  assert.equal(audioStats([]).wpm, 0);
});
