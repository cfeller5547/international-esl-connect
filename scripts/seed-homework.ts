import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5434/esl_connect";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const ASSIGNMENT_RAW_TEXT = `
Name: ___________________  Date: ___________
ESL English — Reading Comprehension & Writing Practice
Unit 3: Daily Life and Routines

Directions: Read the short passage below. Then answer questions 1–5 in complete sentences.

---

Passage:

Maria wakes up at 6:30 every morning. First, she brushes her teeth and takes a shower. Then she eats breakfast with her younger brother. They usually have toast, eggs, and orange juice. After breakfast, Maria walks to the bus stop. The bus comes at 7:45. She arrives at school before 8:15.

After school, Maria goes to the library to study for one hour. She likes to read books about animals. On Tuesdays and Thursdays, she also has soccer practice. She gets home around 5:30 and helps her mother cook dinner. Before bed, she reads for 20 minutes and writes in her journal.

---

1. What time does Maria wake up every morning?

2. What does Maria usually eat for breakfast? Name at least two things.

3. How does Maria get to school? Describe the steps she takes after breakfast.

4. What does Maria do after school on Tuesdays and Thursdays that is different from other days?

5. Write 3–4 sentences about YOUR daily routine. Use time words like "first," "then," "after," and "before."
`.trim();

const PARSED_PAYLOAD = {
  rawText: ASSIGNMENT_RAW_TEXT,
  originalFileName: "unit3-daily-life-worksheet.pdf",
  extractionNotes: ["Loaded the pasted assignment text directly."],
  extractionConfidence: 0.95,
  extractionMethod: "direct_text",
  assignmentTitle: "Daily Life and Routines — Reading & Writing",
  assignmentSummary:
    "Read a short passage about Maria's daily routine, answer 5 comprehension questions, then write about your own routine.",
  subject: "ESL English",
  difficultyLevel: "light",
  reviewNotes: [],
  questions: [
    {
      index: 1,
      promptText: "What time does Maria wake up every morning?",
      questionType: "short_answer",
      focusSkill: "reading",
      studentGoal:
        "Find the specific detail in the passage and answer with a complete sentence.",
      answerFormat: "Write one complete sentence with the time.",
      successCriteria: [
        "State the correct time from the passage.",
        "Use a complete sentence, not just a number.",
      ],
      planSteps: [
        "Scan the first sentence of the passage for the time.",
        "Write the answer as a full sentence.",
      ],
      commonPitfalls: [
        "Writing only '6:30' without a sentence.",
        "Confusing the wake-up time with the bus time.",
      ],
    },
    {
      index: 2,
      promptText:
        "What does Maria usually eat for breakfast? Name at least two things.",
      questionType: "short_answer",
      focusSkill: "reading",
      studentGoal:
        "Identify breakfast items from the passage and list at least two.",
      answerFormat: "Write one or two sentences naming the foods.",
      successCriteria: [
        "Name at least two breakfast items from the passage.",
        "Use a complete sentence.",
      ],
      planSteps: [
        "Find the sentence about breakfast in the passage.",
        "List the foods mentioned.",
        "Write the answer using a complete sentence.",
      ],
      commonPitfalls: [
        "Naming only one item when the question asks for two.",
        "Adding foods not mentioned in the passage.",
      ],
    },
    {
      index: 3,
      promptText:
        "How does Maria get to school? Describe the steps she takes after breakfast.",
      questionType: "extended_response",
      focusSkill: "reading_and_writing",
      studentGoal:
        "Describe the sequence of events from breakfast to arriving at school.",
      answerFormat: "Write 2–3 sentences describing the steps in order.",
      successCriteria: [
        "Mention walking to the bus stop.",
        "Include the bus time or arrival time.",
        "Use sequence words like 'first,' 'then,' or 'after.'",
      ],
      planSteps: [
        "Find the part of the passage between breakfast and school.",
        "Note each step Maria takes.",
        "Write the steps in order using time or sequence words.",
      ],
      commonPitfalls: [
        "Skipping the walk to the bus stop.",
        "Writing only 'she takes the bus' without the full sequence.",
      ],
    },
    {
      index: 4,
      promptText:
        "What does Maria do after school on Tuesdays and Thursdays that is different from other days?",
      questionType: "short_answer",
      focusSkill: "reading",
      studentGoal:
        "Identify the activity that only happens on specific days.",
      answerFormat: "Write one complete sentence explaining the difference.",
      successCriteria: [
        "Mention soccer practice.",
        "Explain that it only happens on Tuesdays and Thursdays.",
      ],
      planSteps: [
        "Find the sentence about Tuesdays and Thursdays.",
        "Write one sentence explaining what is different.",
      ],
      commonPitfalls: [
        "Saying she goes to the library — that happens every day.",
        "Forgetting to mention the specific days.",
      ],
    },
    {
      index: 5,
      promptText:
        'Write 3–4 sentences about YOUR daily routine. Use time words like "first," "then," "after," and "before."',
      questionType: "extended_response",
      focusSkill: "writing",
      studentGoal:
        "Write a short personal paragraph about your daily routine using sequence words.",
      answerFormat:
        "Write 3–4 sentences in first person about your own routine.",
      successCriteria: [
        "Write at least 3 sentences.",
        "Use at least two time/sequence words.",
        "Describe real daily activities.",
      ],
      planSteps: [
        "Think about what you do in the morning, afternoon, and evening.",
        "Pick 3–4 activities to write about.",
        "Use words like 'first,' 'then,' 'after,' and 'before' to connect them.",
      ],
      commonPitfalls: [
        "Writing only one or two sentences.",
        "Forgetting to use sequence words.",
        "Copying Maria's routine instead of writing your own.",
      ],
    },
  ],
};

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "chrisfeller2000@gmail.com" },
  });

  if (!user) {
    console.error("User chrisfeller2000@gmail.com not found in the database.");
    process.exit(1);
  }

  console.log(`Found user: ${user.id} (${user.email})`);

  const upload = await prisma.homeworkUpload.create({
    data: {
      userId: user.id,
      fileUrl: "inline://seed-daily-life-worksheet.txt",
      inputType: "text",
      status: "parsed",
      parseConfidence: 0.92,
      parserVersion: "homework_parser_v2",
      parsedPayload: PARSED_PAYLOAD,
    },
  });

  console.log(`Created homework upload: ${upload.id}`);

  await prisma.homeworkParseJob.createMany({
    data: [
      {
        homeworkUploadId: upload.id,
        stage: "extracting_text",
        status: "completed",
        completedAt: new Date(),
        detailsPayload: {
          extractionMethod: "direct_text",
          extractionConfidence: 0.95,
        },
      },
      {
        homeworkUploadId: upload.id,
        stage: "segmenting_questions",
        status: "completed",
        completedAt: new Date(),
        detailsPayload: {
          parseConfidence: 0.92,
          detectedQuestionCount: 5,
        },
      },
    ],
  });

  console.log("Created parse jobs (completed).");

  const session = await prisma.homeworkHelpSession.create({
    data: {
      userId: user.id,
      homeworkUploadId: upload.id,
      status: "active",
    },
  });

  console.log(`Created active homework session: ${session.id}`);
  console.log("");
  console.log("Done! Go to /app/tools/homework — you should see the session in 'Recent sessions'.");
  console.log(`Direct link: /app/tools/homework/session/${session.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
