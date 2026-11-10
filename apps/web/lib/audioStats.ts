export type Word = { word: string; start: number; end: number };

const FILLERS = new Set(["uh", "um", "mhmm", "mm-mm", "uh-uh", "uh-huh", "nuh-uh", "like", "hmm"]);

export function audioStats(words: Word[]) {
  if (!words.length) return { wpm: 0, fillers: 0, longPauses: 0, words: 0 };
  let fillers = 0;
  let longPauses = 0;
  let speaking = 0;
  words.forEach((w, i) => {
    if (FILLERS.has(w.word.toLowerCase())) fillers++;
    const gap = i ? w.start - words[i - 1].end : 0;
    // Gaps over 2 s are mostly the character's turn. Do not count them as speaking time.
    if (gap > 2) speaking += w.end - w.start;
    else speaking += w.end - (i ? words[i - 1].end : w.start);
    if (gap > 1.2 && gap <= 2) longPauses++;
  });
  return {
    wpm: Math.round(words.length / (speaking / 60)),
    fillers,
    longPauses,
    words: words.length,
  };
}
