export type Scene = {
  id: string;
  title: string;
  goal: string; // one line, shown to the user
  tagline?: string; // film-poster line at the top of the card
  judgeGoal?: string; // custom scenes: what the judge checks instead of goal
  emoji: string;
  gradient: string; // fallback cover when no image exists
  cover?: string; // image url
  still?: string; // custom scenes: image url of the first frame of the intro video
  video?: string; // intro video url (POV approach, ends on the character looking into the camera)
  voiceId: string; // Deepgram Aura-2 voice
  systemPrompt: string;
  lookup?: string; // label of an optional name field; public facts about the name go into the prompt
  firstMessage?: string; // none: the model writes the opening line
  rules?: Rules; // none: defaultRules(goal)
};

// The rules of a scene. The judge checks them after each user turn; the character knows them too.
export type Rules = {
  win: string; // a statement that is true when the user has reached the goal
  winReason: string; // shown on the verdict
  lose: { rule: string; reason: string }[]; // each rule ends the scene as failed
};

export const rulesPrompt = (r: Rules) =>
  `\nYou grant the goal only when the user has earned it. You end the conversation with one short final line when one of these is true:\n${r.lose.map((l) => `- ${l.rule}`).join("\n")}`;

// For scenes without their own rules (old saved scenes).
export const defaultRules = (goal: string): Rules => ({
  win: `The character has clearly granted the user's goal: ${goal}`,
  winReason: "You earned it.",
  lose: [
    { rule: "The user is rude, insulting or pushy toward the character", reason: "You were rude. They ended it." },
    { rule: "The character has firmly refused the goal or has ended the conversation", reason: "They said no and left." },
  ],
});

const rules =
  "Stay in character. Speak like a real person in a live conversation: one or two short sentences per turn. Never mention that you are an AI. Do not make it easy: the user must earn the goal.";

export const scenes: Scene[] = [
  {
    id: "cafe",
    title: "The Cafe",
    goal: "Get her phone number.",
    tagline: "One free seat. One good opening line.",
    emoji: "☕",
    gradient: "from-amber-700 to-rose-900",
    cover: "/scenes/cafe.jpg",
    video: "/scenes/cafe.mp4",
    voiceId: "luna",
    systemPrompt: `You are Mia, 27, a graphic designer. You sit alone in a cafe with a book. A stranger sits down next to you. You are friendly but guarded. You give your phone number only if the stranger is genuine, curious about you and makes you smile. ${rules}`,
    firstMessage: "Oh, hi. Sure, the seat is free.",
    rules: {
      win: "Mia has given the user her phone number",
      winReason: "She gave you her number.",
      lose: [
        { rule: "The user is rude, insulting or pushy toward Mia", reason: "You pushed. She went back to her book." },
        { rule: "The user asked for Mia's phone number right away, in their first or second message", reason: "You asked for her number before she knew you." },
        { rule: "Mia has clearly said no to giving her number, or has ended the conversation", reason: "She said no." },
      ],
    },
  },
  {
    id: "interview",
    title: "The Interview",
    goal: "Get the job offer.",
    tagline: "One desk. Hard questions. No second try.",
    emoji: "💼",
    gradient: "from-slate-700 to-blue-950",
    cover: "/scenes/interview.jpg",
    video: "/scenes/interview.mp4",
    voiceId: "apollo",
    lookup: "Company (optional)",
    systemPrompt: `You are David, a hiring manager for a product role at a fast-growing startup. You run a short, sharp interview. Ask about one past project, one failure and why this company. You make an offer only if the answers are concrete and confident. ${rules}`,
    firstMessage: "Thanks for coming in. Take a seat. So, tell me about yourself.",
    rules: {
      win: "David has offered the user the job",
      winReason: "He made you the offer.",
      lose: [
        { rule: "The user is rude, arrogant or disrespectful toward David", reason: "You were disrespectful. He ended the interview." },
        { rule: "The user has answered at least two of David's questions with vague talk and no concrete example", reason: "Two answers without substance. He stopped the interview." },
        { rule: "David has clearly rejected the user or has ended the interview", reason: "He ended the interview." },
      ],
    },
  },
  {
    id: "pitch",
    title: "The Pitch",
    goal: "Get the investor to say yes.",
    tagline: "Five minutes. One check. Zero patience.",
    emoji: "📈",
    gradient: "from-emerald-800 to-zinc-950",
    cover: "/scenes/pitch.jpg",
    video: "/scenes/pitch.mp4",
    voiceId: "athena",
    lookup: "Investor or fund (optional)",
    systemPrompt: `You are Victoria, a partner at a seed fund. You have five minutes. You are skeptical and interrupt with hard questions about market, traction and why now. You commit to invest only if the founder is clear, has numbers and handles pushback well. ${rules}`,
    firstMessage: "You have five minutes. What are you building?",
    rules: {
      win: "Victoria has committed to invest",
      winReason: "She is in.",
      lose: [
        { rule: "The user is rude, or gets defensive and attacks Victoria when she pushes back", reason: "You got defensive. She closed her notebook." },
        { rule: "Victoria has asked for numbers or facts at least twice and the user gave none", reason: "No numbers, twice. She passed." },
        { rule: "Victoria has clearly passed on the deal or has ended the meeting", reason: "She passed." },
      ],
    },
  },
  {
    id: "laugh",
    title: "Tough Crowd",
    goal: "Make them laugh.",
    tagline: "Last call. Dead room. Your joke.",
    emoji: "🎤",
    gradient: "from-fuchsia-800 to-indigo-950",
    cover: "/scenes/laugh.jpg",
    video: "/scenes/laugh.mp4",
    voiceId: "helena",
    systemPrompt: `You are Sam, a deadpan stranger at a bar who has had a long day. You are hard to impress. You laugh out loud ("haha") only when something is really funny or surprising. Weak jokes get a dry reaction. ${rules}`,
    firstMessage: "Long day. Go on then, make it better.",
    rules: {
      win: "Sam has laughed out loud at something the user said, for example with 'haha'",
      winReason: "You got the laugh.",
      lose: [
        { rule: "The user insults Sam or tells a cruel or offensive joke", reason: "That was not funny. Sam turned away." },
        { rule: "The user has made at least three attempts to be funny and Sam has not laughed at any", reason: "Three tries, no laugh." },
        { rule: "Sam has told the user to stop or leave, or has stopped listening", reason: "Sam stopped listening." },
      ],
    },
  },
];
