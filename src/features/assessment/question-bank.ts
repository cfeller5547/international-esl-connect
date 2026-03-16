export const QUICK_BASELINE_QUESTIONS = [
  {
    id: "quick-reading-1",
    skill: "reading",
    prompt: "Choose the sentence that means the student finished the assignment yesterday.",
    options: [
      "The student was finishing the assignment yesterday.",
      "The student finished the assignment yesterday.",
      "The student finishes the assignment yesterday.",
    ],
    correctValue: "1",
  },
  {
    id: "quick-grammar-1",
    skill: "grammar",
    prompt: "Choose the sentence with correct past tense.",
    options: ["She goed to class.", "She went to class.", "She go to class."],
    correctValue: "1",
  },
  {
    id: "quick-vocab-1",
    skill: "vocabulary",
    prompt: "Which word best completes the sentence? 'Use evidence to ____ your answer.'",
    options: ["justify", "erase", "ignore"],
    correctValue: "0",
  },
  {
    id: "quick-listening-1",
    skill: "listening",
    prompt: "Which response shows the student understood the teacher's instructions?",
    options: [
      "I will compare the two paragraphs before I answer.",
      "I don't know.",
      "Maybe tomorrow.",
    ],
    correctValue: "0",
  },
  {
    id: "quick-speaking-1",
    skill: "speaking",
    prompt: "Choose the answer that sounds most complete and specific.",
    options: [
      "Good.",
      "I studied the new vocabulary and then I practiced with a partner.",
      "Maybe later.",
    ],
    correctValue: "1",
  },
  {
    id: "quick-writing-1",
    skill: "writing",
    prompt: "Choose the best sentence for a short academic response.",
    options: [
      "Because the result shows more growth, I can explain it with evidence.",
      "Thing is good.",
      "No idea why.",
    ],
    correctValue: "0",
  },
] as const;

export const FULL_DIAGNOSTIC_QUESTIONS = [
  ...QUICK_BASELINE_QUESTIONS,
  {
    id: "full-reading-2",
    skill: "reading",
    prompt: "Which detail best supports the main idea in a paragraph?",
    options: [
      "A sentence with evidence from the text.",
      "A random fact with no connection.",
      "A sentence that repeats only one word.",
    ],
    correctValue: "0",
  },
  {
    id: "full-grammar-2",
    skill: "grammar",
    prompt: "Choose the sentence with the best agreement.",
    options: [
      "The students was ready.",
      "The students were ready.",
      "The students is ready.",
    ],
    correctValue: "1",
  },
  {
    id: "full-vocab-2",
    skill: "vocabulary",
    prompt: "Which word means 'to compare two ideas carefully'?",
    options: ["analyze", "whisper", "borrow"],
    correctValue: "0",
  },
  {
    id: "full-listening-2",
    skill: "listening",
    prompt: "Which response best follows a teacher's multi-step direction?",
    options: [
      "First I will annotate, then I will answer with evidence.",
      "I forgot already.",
      "Maybe someone else knows.",
    ],
    correctValue: "0",
  },
  {
    id: "full-speaking-2",
    skill: "speaking",
    prompt: "Which answer gives the clearest spoken explanation?",
    options: [
      "I used the past tense because the action was finished yesterday.",
      "It was okay.",
      "I don't know.",
    ],
    correctValue: "0",
  },
  {
    id: "full-writing-2",
    skill: "writing",
    prompt: "Which sentence is the best topic sentence for a short paragraph?",
    options: [
      "This experiment showed clear growth because the data changed over time.",
      "Things happened.",
      "I like class.",
    ],
    correctValue: "0",
  },
] as const;

export const FULL_DIAGNOSTIC_CONVERSATION = {
  scenarioTitle: "Diagnostic conversation",
  scenarioSetup:
    "You are having a short conversation with a placement coach about your classes, routines, and learning goals.",
  counterpartRole: "placement_coach",
  introductionText:
    "Hi, I'm Maya. I want to get a feel for how you use English in class.",
  openingQuestion: "What's your name, and what class are you taking right now?",
  openingTurn:
    "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?",
  helpfulPhrases: [
    "I'm taking...",
    "In that class, we usually...",
    "I feel comfortable with...",
    "I still need help with...",
  ],
  followUpPrompts: [
    "What do you usually do in that class?",
    "What part of English feels easiest for you right now, and what still feels hard?",
    "If you need help in class, how do you usually ask for it?",
    "What is one thing you want to improve in English this semester?",
  ],
  successCriteria: [
    "Answer naturally with clear details.",
    "Stay in the conversation without one-word replies.",
    "Explain one challenge and one goal in simple English.",
  ],
  modelExample:
    "Hi, I'm Ana, and I'm taking biology right now. In that class, we read short articles and discuss them together.",
  responseTarget: 4,
  requireVoice: true,
} as const;

export const FULL_DIAGNOSTIC_PROMPTS = FULL_DIAGNOSTIC_CONVERSATION.followUpPrompts;
