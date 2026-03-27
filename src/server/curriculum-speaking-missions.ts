import type { SpeakingMissionPayload } from "@/server/learn-speaking-types";

export type AuthoredSpeakingMission = Omit<
  SpeakingMissionPayload,
  | "requiredTurns"
  | "minimumFollowUpResponses"
  | "isBenchmark"
  | "evidenceTargets"
  | "followUpObjectives"
  | "benchmarkFocus"
> & {
  requiredTurns?: number;
  minimumFollowUpResponses?: number;
  evidenceTargets?: SpeakingMissionPayload["evidenceTargets"];
  followUpObjectives?: string[];
  benchmarkFocus?: string[];
};

export const AUTHORED_SPEAKING_MISSIONS: Record<string, AuthoredSpeakingMission> = {
  "introductions-and-personal-information": {
    scenarioTitle: "Meet a New Classmate",
    scenarioSetup:
      "You are waiting for class to begin. Introduce yourself, say where you are from, and ask one simple question back.",
    counterpartRole: "classmate",
    openingQuestion: "Hi, I don't think we've met yet. What's your name?",
    warmupPrompts: [
      "Say your name and country in one short sentence.",
      "Practice one question you can ask a new classmate.",
    ],
    targetPhrases: [
      "My name is ...",
      "I'm from ...",
      "What about you?",
      "What grade are you in?",
    ],
    followUpPrompts: [
      "Where are you from?",
      "What classes do you like?",
      "Can you ask me one question too?",
    ],
    successCriteria: [
      "Introduce yourself clearly.",
      "Share one personal detail.",
      "Ask at least one simple question back.",
    ],
    modelExample:
      "Hi, I'm Ana. I'm from Brazil. What about you? What grade are you in?",
    evidenceTargets: [
      {
        key: "intro-name",
        label: "Say your name clearly",
        kind: "task",
        cues: ["my name is", "i'm", "i am"],
      },
      {
        key: "intro-detail",
        label: "Add one personal detail",
        kind: "detail",
        cues: ["i'm from", "i am from", "country", "student", "age"],
      },
      {
        key: "intro-question-back",
        label: "Ask one simple question back",
        kind: "follow_up",
        cues: ["what about you", "where are you from", "what grade are you in"],
      },
    ],
    followUpObjectives: [
      "Ask where the learner is from if they only give a name.",
      "Ask for one more personal detail if the answer is too short.",
      "Prompt the learner to ask one simple question back.",
    ],
    benchmarkFocus: [],
  },
  "family-friends-and-classroom-language": {
    scenarioTitle: "Talk About Family and Ask for Help",
    scenarioSetup:
      "You are chatting with a classmate before class. Describe one family member, then ask to borrow a classroom item.",
    counterpartRole: "classmate",
    openingQuestion: "Can you tell me about someone in your family?",
    warmupPrompts: [
      "Say one sentence about a family member.",
      "Practice one polite classroom request.",
    ],
    targetPhrases: [
      "My sister is ...",
      "He likes ...",
      "Can I borrow your ...?",
      "Thank you.",
    ],
    followUpPrompts: [
      "What is that person like?",
      "What do they like to do?",
      "What do you need for class right now?",
    ],
    successCriteria: [
      "Describe one family member with one detail.",
      "Use a polite classroom request.",
      "Keep the conversation simple and clear.",
    ],
    modelExample:
      "My brother is friendly and funny. He likes soccer. Can I borrow your pencil for class?",
    evidenceTargets: [
      {
        key: "family-person",
        label: "Name one family member or friend",
        kind: "task",
        cues: ["my brother", "my sister", "my mother", "my friend"],
      },
      {
        key: "family-detail",
        label: "Add one simple detail about that person",
        kind: "detail",
        cues: ["friendly", "funny", "kind", "likes", "he is", "she is"],
      },
      {
        key: "classroom-request",
        label: "Make a polite classroom request",
        kind: "language",
        cues: ["can i borrow", "can i use", "pencil", "book"],
      },
    ],
    followUpObjectives: [
      "Ask what the person is like if the learner only gives a name.",
      "Ask what the person likes to do if there is no extra detail yet.",
      "Prompt the learner to make one polite classroom request.",
    ],
    benchmarkFocus: [],
  },
  "daily-routines-time-and-schedules": {
    scenarioTitle: "Explain Your School-Day Routine",
    scenarioSetup:
      "A classmate asks about your normal weekday. Explain what you do from morning to evening.",
    counterpartRole: "classmate",
    openingQuestion: "What does a normal school day look like for you?",
    warmupPrompts: [
      "Say what time you wake up.",
      "Practice one sentence with before or after.",
    ],
    targetPhrases: [
      "I usually ...",
      "Then I ...",
      "After that, ...",
      "In the evening, ...",
    ],
    followUpPrompts: [
      "What do you do before class starts?",
      "What do you do after school?",
      "What time do you usually do homework?",
    ],
    successCriteria: [
      "Describe at least three parts of your day.",
      "Use time-order words.",
      "Say when something happens.",
    ],
    modelExample:
      "I usually wake up at 6:30. Then I go to school and have class in the morning. In the evening, I do my homework after dinner.",
    evidenceTargets: [
      {
        key: "routine-flow",
        label: "Describe the day in a clear order",
        kind: "task",
        cues: ["in the morning", "then", "after school", "in the evening"],
      },
      {
        key: "routine-language",
        label: "Use a simple time or routine phrase",
        kind: "language",
        cues: ["usually", "morning", "afternoon", "before class", "after school"],
      },
      {
        key: "routine-detail",
        label: "Add one real routine detail",
        kind: "detail",
        cues: ["homework", "study", "class", "bus", "wake up"],
      },
      {
        key: "routine-follow-up",
        label: "Answer one follow-up clearly",
        kind: "follow_up",
        cues: [],
      },
    ],
    followUpObjectives: [
      "Ask what the learner does before class starts.",
      "Ask what the learner does after school.",
      "Ask for one more routine detail such as homework or study time.",
    ],
    benchmarkFocus: [
      "Move through the day in order.",
      "Use simple time phrases.",
      "Answer one follow-up with a new detail.",
    ],
    requiredTurns: 4,
    minimumFollowUpResponses: 1,
  },
  "food-shopping-and-likes-dislikes": {
    scenarioTitle: "Buy a Snack After Class",
    scenarioSetup:
      "You are at the snack counter after school. Order one item, ask the price, and say what food you like.",
    counterpartRole: "cashier",
    openingQuestion: "Hi. What would you like today?",
    warmupPrompts: [
      "Say one snack or drink you want.",
      "Practice one sentence with I like or I don't like.",
    ],
    targetPhrases: [
      "I'd like ...",
      "How much is it?",
      "I like ...",
      "I don't like ...",
    ],
    followUpPrompts: [
      "Do you want anything to drink?",
      "How much money do you have?",
      "What snack do you usually like?",
    ],
    successCriteria: [
      "Order one item clearly.",
      "Ask about the price.",
      "Say one food preference.",
    ],
    modelExample:
      "I'd like bread and water, please. How much is it? I like simple snacks after school.",
    evidenceTargets: [
      {
        key: "snack-order",
        label: "Order one item clearly",
        kind: "task",
        cues: ["i'd like", "i want", "bread", "water", "apple"],
      },
      {
        key: "price-question",
        label: "Ask about the price",
        kind: "language",
        cues: ["how much is it", "price"],
      },
      {
        key: "food-preference",
        label: "Say one food preference",
        kind: "detail",
        cues: ["i like", "i don't like", "i do not like"],
      },
    ],
    followUpObjectives: [
      "Ask whether the learner wants food or a drink if the order is unclear.",
      "Ask the learner to check the price if they have not done it yet.",
      "Prompt for one simple food like or dislike.",
    ],
    benchmarkFocus: [],
  },
  "home-school-and-neighborhood": {
    scenarioTitle: "Show a New Student Around",
    scenarioSetup:
      "A new student wants to find an important place near school. Describe where it is and how to get there.",
    counterpartRole: "classmate",
    openingQuestion: "Can you help me find the library near school?",
    warmupPrompts: [
      "Say one place near your school.",
      "Practice one direction phrase like next to or across from.",
    ],
    targetPhrases: [
      "It's next to ...",
      "Go straight ...",
      "Turn left at ...",
      "It's near ...",
    ],
    followUpPrompts: [
      "What can the student see on the way?",
      "Is it far from the school entrance?",
      "Can you give one more direction?",
    ],
    successCriteria: [
      "Name one place clearly.",
      "Use at least one location phrase.",
      "Give simple directions in order.",
    ],
    modelExample:
      "The library is next to the science building. Go straight from the front gate, then turn left. It's near the cafeteria.",
    evidenceTargets: [
      {
        key: "place-name",
        label: "Name one place clearly",
        kind: "task",
        cues: ["library", "school", "home", "street"],
      },
      {
        key: "location-language",
        label: "Use a location phrase",
        kind: "language",
        cues: ["near", "next to", "across from"],
      },
      {
        key: "simple-direction",
        label: "Give one simple direction",
        kind: "detail",
        cues: ["go straight", "turn left", "turn right"],
      },
    ],
    followUpObjectives: [
      "Ask which place the learner is describing if it is still vague.",
      "Ask for one location phrase such as near or next to.",
      "Prompt for one more simple direction if needed.",
    ],
    benchmarkFocus: [],
  },
  "simple-plans-weather-and-practical-review": {
    scenarioTitle: "Make a Weekend Plan",
    scenarioSetup:
      "You and a friend are deciding what to do this weekend. Talk about your plan and the weather.",
    counterpartRole: "classmate",
    openingQuestion: "What are you going to do this weekend?",
    warmupPrompts: [
      "Say one plan for tomorrow or the weekend.",
      "Practice one weather sentence.",
    ],
    targetPhrases: [
      "I'm going to ...",
      "If it rains, ...",
      "It will be ...",
      "Maybe we can ...",
    ],
    followUpPrompts: [
      "What will you do if the weather changes?",
      "Who are you going with?",
      "What time are you going to go?",
    ],
    successCriteria: [
      "State one plan clearly.",
      "Mention the weather.",
      "Add one backup idea or detail.",
    ],
    modelExample:
      "I'm going to visit the park on Saturday. If it rains, maybe we can watch a movie instead. I think it will be sunny in the afternoon.",
    evidenceTargets: [
      {
        key: "weekend-plan",
        label: "State one weekend plan clearly",
        kind: "task",
        cues: ["i'm going to", "i am going to", "weekend", "tomorrow", "visit"],
      },
      {
        key: "weather-language",
        label: "Mention the weather",
        kind: "language",
        cues: ["rain", "sunny", "if it rains", "it will be"],
      },
      {
        key: "backup-idea",
        label: "Add one backup idea or extra detail",
        kind: "detail",
        cues: ["maybe we can", "instead", "if it rains", "with my friend"],
      },
      {
        key: "plan-follow-up",
        label: "Answer one follow-up clearly",
        kind: "follow_up",
        cues: [],
      },
    ],
    followUpObjectives: [
      "Ask what the learner will do if the weather changes.",
      "Ask who they are going with or when they are going.",
      "Prompt for one more simple detail if the plan is still too short.",
    ],
    benchmarkFocus: [
      "Say the main plan clearly.",
      "Connect the plan to the weather.",
      "Answer one follow-up with a useful detail.",
    ],
    requiredTurns: 4,
    minimumFollowUpResponses: 1,
  },
  "habits-and-routines-in-more-detail": {
    scenarioTitle: "Explain Your Full Weekday",
    scenarioSetup:
      "A teacher or advisor asks you to explain your weekday routine so they can understand how busy your schedule is.",
    counterpartRole: "teacher",
    openingQuestion: "Can you walk me through a normal weekday for you?",
    warmupPrompts: [
      "Say one sentence with usually or often.",
      "Practice one sequence phrase like before class or after dinner.",
    ],
    targetPhrases: [
      "I usually ...",
      "I often ...",
      "Before class, ...",
      "After school, ...",
    ],
    followUpPrompts: [
      "Which part of your day is usually the busiest?",
      "What do you usually do in the evening after your main work is finished?",
      "What do you do every day, and what do you only do sometimes?",
    ],
    successCriteria: [
      "Use time and frequency words.",
      "Include several connected details.",
      "Keep the order easy to follow.",
    ],
    modelExample:
      "I usually wake up at 6:30 and eat breakfast before school. After class, I often stay late for practice. In the evening, I usually finish homework before I relax.",
    evidenceTargets: [
      {
        key: "routine-order",
        label: "Describe the weekday in a clear order",
        kind: "task",
        cues: ["before class", "after school", "in the evening", "then", "after that"],
      },
      {
        key: "frequency-language",
        label: "Use a frequency phrase",
        kind: "language",
        cues: ["usually", "often", "sometimes", "every day"],
      },
      {
        key: "specific-routine-detail",
        label: "Add one specific routine detail",
        kind: "detail",
        cues: ["homework", "practice", "exercise", "bus", "breakfast"],
      },
    ],
    followUpObjectives: [
      "Ask about the busiest part of the day.",
      "Ask for an evening detail after the main routine is clear.",
      "Prompt the learner to compare an everyday habit with something they only do sometimes.",
    ],
    benchmarkFocus: [],
  },
  "past-events-and-weekend-stories": {
    scenarioTitle: "Tell a Weekend Story",
    scenarioSetup:
      "A classmate asks what you did last weekend. Tell the story in order with a few details.",
    counterpartRole: "classmate",
    openingQuestion: "What did you do last weekend?",
    warmupPrompts: [
      "Say one past-tense sentence about yesterday.",
      "Practice one sequence word like later or finally.",
    ],
    targetPhrases: [
      "First, ...",
      "Later, ...",
      "After that, ...",
      "Finally, ...",
    ],
    followUpPrompts: [
      "Who were you with?",
      "What happened next?",
      "How did you feel about it?",
    ],
    successCriteria: [
      "Tell the story in order.",
      "Use past-time markers.",
      "Add at least one detail or reaction.",
    ],
    modelExample:
      "Last Saturday, I visited my cousin. Later, we cooked dinner and watched a movie. Finally, I went home tired but happy.",
    evidenceTargets: [
      {
        key: "story-order",
        label: "Tell the weekend story in order",
        kind: "task",
        cues: ["first", "later", "after that", "finally", "last saturday"],
      },
      {
        key: "past-markers",
        label: "Use past-time language",
        kind: "language",
        cues: ["yesterday", "last weekend", "last saturday", "visited", "watched"],
      },
      {
        key: "reaction-detail",
        label: "Add one detail or reaction",
        kind: "detail",
        cues: ["with my", "it was", "i felt", "happy", "tired"],
      },
    ],
    followUpObjectives: [
      "Ask who the learner was with.",
      "Ask for the next part of the story in order.",
      "Prompt for a feeling or reaction at the end.",
    ],
    benchmarkFocus: [],
  },
  "what-is-happening-now": {
    scenarioTitle: "Describe a Busy Study Space",
    scenarioSetup:
      "A teacher asks you to describe what is happening in a busy study space right now so someone who is not there can picture it.",
    counterpartRole: "teacher",
    openingQuestion: "What is happening in the study space right now?",
    warmupPrompts: [
      "Say one sentence with is or are plus an -ing verb.",
      "Practice one location detail like near the window or at the front table.",
    ],
    targetPhrases: [
      "Right now, ...",
      "One student is ...",
      "Another person is ...",
      "Near the window, ...",
    ],
    followUpPrompts: [
      "What is one person doing near the front?",
      "What else do you notice in another part of the room?",
      "How would you describe the overall scene in one clear sentence?",
    ],
    successCriteria: [
      "Describe actions in progress using present continuous sentences.",
      "Mention more than one person or action.",
      "Add location details and handle follow-up questions clearly.",
    ],
    modelExample:
      "Right now, one student is working at the front table and another person is reading near the window. In the back, two students are talking quietly while someone else is writing notes.",
    evidenceTargets: [
      {
        key: "scene-actions",
        label: "Describe more than one action in the scene",
        kind: "task",
        cues: ["right now", "one student is", "another person is", "two students are"],
      },
      {
        key: "present-continuous",
        label: "Use present continuous language",
        kind: "language",
        cues: ["is reading", "is working", "are talking", "are studying", "is writing"],
      },
      {
        key: "location-detail",
        label: "Add a location or visual detail",
        kind: "detail",
        cues: ["near the window", "at the front", "in the back", "by the door", "at the table"],
      },
      {
        key: "follow-up-detail",
        label: "Answer follow-up questions with new details",
        kind: "follow_up",
        cues: [],
      },
    ],
    followUpObjectives: [
      "Ask for a second action happening in a different part of the room.",
      "Ask for a location or visual detail that helps the listener picture the scene.",
      "Ask the learner to summarize the scene clearly after the details are in place.",
    ],
    benchmarkFocus: [
      "Hold the scene description across several turns.",
      "Keep the grammar in the present continuous.",
      "Answer follow-up questions with fresh details.",
    ],
    requiredTurns: 5,
    minimumFollowUpResponses: 2,
  },
  "school-work-and-responsibilities": {
    scenarioTitle: "Explain an Assignment Plan",
    scenarioSetup:
      "You are talking with a teacher or advisor about an assignment or work task you need to finish and how you will do it.",
    counterpartRole: "teacher",
    openingQuestion: "What do you need to finish first?",
    warmupPrompts: [
      "Say one sentence with need to or have to.",
      "Practice one short explanation of a school task.",
    ],
    targetPhrases: [
      "I need to ...",
      "I have to ...",
      "First, I'll ...",
      "Then I can ...",
    ],
    followUpPrompts: [
      "When is it due?",
      "What is the hardest part?",
      "How are you going to finish it on time?",
    ],
    successCriteria: [
      "Name the task clearly.",
      "Explain your plan step by step.",
      "Use obligation language naturally.",
    ],
    modelExample:
      "I need to finish my history project first. Tonight I'll research two sources, and then I can start the slides. I have to finish it before Friday.",
    evidenceTargets: [
      {
        key: "name-task",
        label: "Name the task clearly",
        kind: "task",
        cues: ["project", "assignment", "report", "deadline", "finish"],
      },
      {
        key: "obligation-language",
        label: "Use obligation language",
        kind: "language",
        cues: ["need to", "have to", "must", "first i'll"],
      },
      {
        key: "step-by-step-plan",
        label: "Explain the plan step by step",
        kind: "detail",
        cues: ["first", "then", "after that", "before friday", "tonight"],
      },
    ],
    followUpObjectives: [
      "Ask when the task is due.",
      "Ask which part feels hardest.",
      "Prompt for one more step that makes the plan realistic.",
    ],
    benchmarkFocus: [],
  },
  "health-travel-and-everyday-services": {
    scenarioTitle: "Ask for Help at the Bus Station",
    scenarioSetup:
      "You are at a bus station and need help getting the right ticket and departure time.",
    counterpartRole: "staff_member",
    openingQuestion: "Where do you need to go today?",
    warmupPrompts: [
      "Say one polite sentence asking for help.",
      "Practice one question about time, price, or location.",
    ],
    targetPhrases: [
      "Can you help me ...?",
      "Which bus goes to ...?",
      "What time does it leave?",
      "How much is the ticket?",
    ],
    followUpPrompts: [
      "Do you need a one-way ticket or a round trip?",
      "What time do you want to leave?",
      "Is there anything else you need?",
    ],
    successCriteria: [
      "Ask for help politely.",
      "Give enough detail about your problem.",
      "Ask at least one follow-up question.",
    ],
    modelExample:
      "Hi, can you help me? I need to go downtown. Which bus goes there, and what time does it leave?",
    evidenceTargets: [
      {
        key: "service-problem",
        label: "Explain the travel problem clearly",
        kind: "task",
        cues: ["i need to go", "downtown", "station", "ticket", "bus"],
      },
      {
        key: "help-question",
        label: "Ask a clear service question",
        kind: "language",
        cues: ["can you help me", "which bus", "what time does it leave", "how much is"],
      },
      {
        key: "destination-detail",
        label: "Give one useful destination or timing detail",
        kind: "detail",
        cues: ["one-way", "round trip", "today", "leave", "downtown"],
      },
    ],
    followUpObjectives: [
      "Ask whether the learner needs a one-way ticket or a round trip.",
      "Ask what time the learner wants to leave.",
      "Prompt for one more service detail if the request is still vague.",
    ],
    benchmarkFocus: [],
  },
  "comparing-choosing-and-short-narratives": {
    scenarioTitle: "Compare Two After-Class Options",
    scenarioSetup:
      "A friend asks which option fits your week better: a study workshop or a part-time work shift. Compare them and explain your choice.",
    counterpartRole: "classmate",
    openingQuestion:
      "Which option fits your week better: the study workshop or the part-time shift?",
    warmupPrompts: [
      "Say one sentence with I prefer.",
      "Practice one comparison with better or more.",
    ],
    targetPhrases: [
      "I'd choose ...",
      "... is better because ...",
      "On the other hand, ...",
      "For me, ... works better.",
    ],
    followUpPrompts: [
      "What is the biggest advantage of your choice?",
      "What is one drawback or challenge with the other option?",
      "Why is your choice the better fit for you right now?",
    ],
    successCriteria: [
      "Make a clear choice early in the conversation.",
      "Compare the two options with at least one contrast.",
      "Support your choice and handle follow-up questions clearly.",
    ],
    modelExample:
      "I'd choose the study workshop because it fits my goals this week and helps me prepare for my classes. On the other hand, the work shift gives me money, but it would leave me with less time to study. For me, the workshop is the better choice right now.",
    evidenceTargets: [
      {
        key: "clear-choice",
        label: "Make a clear choice",
        kind: "task",
        cues: ["i'd choose", "i would choose", "i prefer", "my choice is", "for me"],
      },
      {
        key: "comparison-language",
        label: "Compare the two options",
        kind: "language",
        cues: ["better because", "on the other hand", "more", "less", "than"],
      },
      {
        key: "supported-reason",
        label: "Support the choice with a reason",
        kind: "detail",
        cues: ["because", "one reason", "it helps", "fits my", "works better"],
      },
      {
        key: "follow-up-contrast",
        label: "Handle follow-up questions with a clear contrast",
        kind: "follow_up",
        cues: [],
      },
    ],
    followUpObjectives: [
      "Ask for the biggest advantage of the learner's choice.",
      "Ask for one drawback or challenge with the other option.",
      "Ask why the final choice is the better fit right now.",
    ],
    benchmarkFocus: [
      "Make a clear choice quickly.",
      "Support it with a reason and a comparison.",
      "Handle follow-up questions without losing the main point.",
    ],
    requiredTurns: 5,
    minimumFollowUpResponses: 2,
  },
  "tell-stories-clearly": {
    scenarioTitle: "Share a Memorable Experience",
    scenarioSetup:
      "A classmate asks you to share a meaningful experience from your life and explain why you still remember it.",
    counterpartRole: "classmate",
    openingQuestion: "Can you tell me about a memorable experience you had?",
    warmupPrompts: [
      "Say one sentence that sets the time and place.",
      "Practice one sequence word like suddenly or eventually.",
    ],
    targetPhrases: [
      "One time, ...",
      "At first, ...",
      "Then suddenly, ...",
      "In the end, ...",
    ],
    followUpPrompts: [
      "Where were you when it happened?",
      "What happened next?",
      "Why do you still remember it?",
    ],
    successCriteria: [
      "Set up the story clearly.",
      "Use sequence and detail.",
      "End with a reflection or reaction.",
    ],
    modelExample:
      "One time, I got lost during a school trip in a museum. At first, I felt nervous, but eventually I found my group near the entrance. I still remember it because it taught me to stay calm.",
    evidenceTargets: [
      {
        key: "story-context",
        label: "Set the time or place of the story",
        kind: "task",
        cues: ["one time", "during", "when i was", "on a school trip", "at the museum"],
      },
      {
        key: "story-sequence",
        label: "Move the story with clear sequence language",
        kind: "language",
        cues: ["at first", "then", "suddenly", "eventually", "in the end"],
      },
      {
        key: "story-detail",
        label: "Add one concrete detail or reaction",
        kind: "detail",
        cues: ["nervous", "phone", "group", "entrance", "reaction", "detail"],
      },
      {
        key: "story-reflection",
        label: "Explain why the experience still matters",
        kind: "follow_up",
        cues: ["i still remember", "it taught me", "i learned", "because it showed"],
      },
    ],
    followUpObjectives: [
      "Ask where the learner was or when the experience happened if the story opens too vaguely.",
      "Ask what happened next if the sequence is too short or jumps forward too quickly.",
      "Prompt for one reaction or reflection so the story ends with meaning instead of just events.",
    ],
    benchmarkFocus: [],
    requiredTurns: 4,
    minimumFollowUpResponses: 1,
  },
  "explain-opinions-and-give-reasons": {
    scenarioTitle: "Respond to a Class Discussion",
    scenarioSetup:
      "Your teacher asks whether students should have part-time jobs during the school year. Give your opinion and support it.",
    counterpartRole: "teacher",
    openingQuestion: "Do you think students should have part-time jobs during the school year?",
    warmupPrompts: [
      "Say I think plus one reason.",
      "Practice one example sentence with for example.",
    ],
    targetPhrases: [
      "I think ... because ...",
      "One reason is ...",
      "For example, ...",
      "On the other hand, ...",
    ],
    followUpPrompts: [
      "Can you give one example?",
      "What is one drawback?",
      "Why might someone disagree with you?",
    ],
    successCriteria: [
      "State a clear opinion.",
      "Support it with reasons or examples.",
      "Respond to one challenge or alternative view.",
    ],
    modelExample:
      "I think part-time jobs can be good for students if the schedule stays reasonable. For example, a small job can teach responsibility and time management. On the other hand, too many work hours could hurt school performance, so balance matters.",
    evidenceTargets: [
      {
        key: "opinion-claim",
        label: "State a clear opinion early",
        kind: "task",
        cues: ["i think", "i believe", "in my view", "students should"],
      },
      {
        key: "opinion-reason",
        label: "Support the opinion with a reason",
        kind: "language",
        cues: ["because", "one reason is", "this matters because"],
      },
      {
        key: "opinion-example",
        label: "Add an example or concrete support",
        kind: "detail",
        cues: ["for example", "for instance", "a small job", "time management"],
      },
      {
        key: "opinion-challenge",
        label: "Respond to an alternative view",
        kind: "follow_up",
        cues: ["on the other hand", "however", "someone might disagree"],
      },
    ],
    followUpObjectives: [
      "Ask for one example if the learner gives only a general reason.",
      "Ask what drawback or challenge should be considered.",
      "Prompt the learner to respond to one possible disagreement without losing the main opinion.",
    ],
    benchmarkFocus: [],
    requiredTurns: 4,
    minimumFollowUpResponses: 1,
  },
  "solve-problems-and-make-decisions": {
    scenarioTitle: "Choose a Solution With Your Group",
    scenarioSetup:
      "Your group needs to raise money for a class trip. Discuss options and recommend the best plan.",
    counterpartRole: "classmate",
    openingQuestion: "We need to raise money for the class trip. What do you think we should do?",
    warmupPrompts: [
      "Say one sentence with should or could.",
      "Practice one suggestion and one reason.",
    ],
    targetPhrases: [
      "We should ...",
      "We could ...",
      "A better option is ...",
      "Let's decide on ...",
    ],
    followUpPrompts: [
      "Why do you think that is the best option?",
      "What is one problem with the other idea?",
      "How can the group make a final decision?",
    ],
    successCriteria: [
      "Suggest at least one solution.",
      "Compare options.",
      "Help move the group toward a decision.",
    ],
    modelExample:
      "We could hold a bake sale, but I think a weekend car wash is better because more people can join. It may raise money faster, so I would choose that option.",
    evidenceTargets: [
      {
        key: "decision-problem",
        label: "Define the group problem and one real option",
        kind: "task",
        cues: ["raise money", "class trip", "we could", "we should"],
      },
      {
        key: "decision-comparison",
        label: "Compare at least two options clearly",
        kind: "language",
        cues: ["better", "could", "should", "another option", "compared with"],
      },
      {
        key: "decision-justification",
        label: "Justify the recommendation with a reason or tradeoff",
        kind: "detail",
        cues: ["because", "faster", "more people can join", "problem", "tradeoff"],
      },
      {
        key: "decision-follow-up",
        label: "Handle follow-up pressure without losing the decision",
        kind: "follow_up",
        cues: ["best option", "other idea", "final decision"],
      },
    ],
    followUpObjectives: [
      "Ask why the learner's preferred option is stronger than the other idea.",
      "Ask for one weakness or tradeoff in the rejected option or the chosen plan.",
      "Prompt the learner to move the group toward a final decision instead of staying in brainstorming mode.",
    ],
    benchmarkFocus: [
      "Define the problem and compare more than one option.",
      "Justify the recommendation with a concrete tradeoff or reason.",
      "Handle follow-up questions without losing the final decision.",
    ],
    requiredTurns: 6,
    minimumFollowUpResponses: 2,
  },
  "study-summarize-and-respond": {
    scenarioTitle: "Summarize a Short Reading",
    scenarioSetup:
      "After reading a short article about whether students learn better in online, hybrid, or in-person classes, your teacher asks you to summarize the main idea and give your response.",
    counterpartRole: "teacher",
    openingQuestion: "What was the main idea of the article?",
    warmupPrompts: [
      "Say one sentence that starts with The text says ...",
      "Practice one response sentence with I agree or I disagree.",
    ],
    targetPhrases: [
      "The main idea is ...",
      "The article explains ...",
      "I agree because ...",
      "One important detail is ...",
    ],
    followUpPrompts: [
      "Which detail supports that idea?",
      "Do you agree with the article?",
      "What would you add in your own words?",
    ],
    successCriteria: [
      "Summarize the main idea clearly.",
      "Include one supporting detail.",
      "Give a short personal response.",
    ],
    modelExample:
      "The main idea is that different class formats support different kinds of learners. One important detail is that online classes offer flexibility, but in-person classes can make discussion and focus easier. I agree that a mixed approach can work well because students do not all learn in the same way.",
    evidenceTargets: [
      {
        key: "summary-main-idea",
        label: "Summarize the main idea clearly",
        kind: "task",
        cues: ["the main idea is", "the article explains", "the text says"],
      },
      {
        key: "summary-detail",
        label: "Use one supporting detail from the source",
        kind: "language",
        cues: ["one important detail", "for example", "flexibility", "discussion"],
      },
      {
        key: "summary-response",
        label: "Add a personal response in your own words",
        kind: "detail",
        cues: ["i agree", "i disagree", "in my view", "i would add"],
      },
      {
        key: "summary-follow-up",
        label: "Clarify the summary when asked for more support",
        kind: "follow_up",
        cues: ["supports that idea", "in your own words", "another detail"],
      },
    ],
    followUpObjectives: [
      "Ask which detail from the article best supports the main idea.",
      "Ask whether the learner agrees and why, so the response is not only summary.",
      "Prompt the learner to restate one point in their own words if the answer sounds too close to the source.",
    ],
    benchmarkFocus: [],
    requiredTurns: 4,
    minimumFollowUpResponses: 1,
  },
  "future-plans-goals-and-possibilities": {
    scenarioTitle: "Explain a Future Goal",
    scenarioSetup:
      "A teacher asks about your goal for next year and what steps you will take to reach it.",
    counterpartRole: "teacher",
    openingQuestion: "What goal are you working toward for next year?",
    warmupPrompts: [
      "Say one sentence with going to or will.",
      "Practice one step you plan to take.",
    ],
    targetPhrases: [
      "My goal is to ...",
      "I'm going to ...",
      "First, I will ...",
      "If possible, I'd like to ...",
    ],
    followUpPrompts: [
      "Why is that goal important to you?",
      "What is your first step?",
      "What challenge might you face?",
    ],
    successCriteria: [
      "Name a clear future goal.",
      "Explain concrete next steps.",
      "Mention one possibility or challenge.",
    ],
    modelExample:
      "My goal is to improve my English enough to join the debate team next year. First, I'm going to practice speaking every week and read more in English. If possible, I'd also like to take an extra writing class.",
    evidenceTargets: [
      {
        key: "future-goal",
        label: "Name a clear goal for the future",
        kind: "task",
        cues: ["my goal is", "next year", "i want to", "i'm working toward"],
      },
      {
        key: "future-steps",
        label: "Explain concrete next steps",
        kind: "language",
        cues: ["first", "i'm going to", "i will", "next step"],
      },
      {
        key: "future-challenge",
        label: "Mention one challenge or possibility",
        kind: "detail",
        cues: ["if possible", "challenge", "might", "could be difficult"],
      },
      {
        key: "future-follow-up",
        label: "Answer follow-up questions with a realistic detail",
        kind: "follow_up",
        cues: ["important", "first step", "challenge"],
      },
    ],
    followUpObjectives: [
      "Ask why the goal matters if the learner only names the target.",
      "Ask for the first concrete step if the answer stays abstract.",
      "Prompt for one likely challenge or possible change in the plan.",
    ],
    benchmarkFocus: [],
    requiredTurns: 4,
    minimumFollowUpResponses: 1,
  },
  "real-world-interaction-travel-interviews-presentations": {
    scenarioTitle: "Handle a Short Interview",
    scenarioSetup:
      "You are at a short interview for a campus or community role. Introduce yourself and answer one follow-up question.",
    counterpartRole: "interviewer",
    openingQuestion:
      "Can you tell me a little about yourself and why you are interested in this role?",
    warmupPrompts: [
      "Say one strength you can explain clearly.",
      "Practice one short example from school or work.",
    ],
    targetPhrases: [
      "I'm interested in ...",
      "One strength I have is ...",
      "For example, ...",
      "I have experience with ...",
    ],
    followUpPrompts: [
      "What is one experience that prepared you for this?",
      "How do you handle new situations?",
      "Why should we choose you?",
    ],
    successCriteria: [
      "Introduce yourself clearly.",
      "Explain one strength or experience.",
      "Answer follow-up questions with connected detail.",
    ],
    modelExample:
      "I'm interested in this role because I enjoy helping people and working with a team. One strength I have is that I stay calm under pressure. For example, I helped organize a student event last semester and made sure everyone knew what to do.",
    evidenceTargets: [
      {
        key: "interview-interest",
        label: "Introduce yourself and explain interest in the role",
        kind: "task",
        cues: ["i'm interested in", "i am interested in", "this role", "i'd like to"],
      },
      {
        key: "interview-strength",
        label: "Name one strength or relevant experience",
        kind: "language",
        cues: ["one strength i have is", "i have experience with", "for example"],
      },
      {
        key: "interview-example",
        label: "Support the answer with a concrete example",
        kind: "detail",
        cues: ["last semester", "for example", "i helped", "i organized"],
      },
      {
        key: "interview-follow-up",
        label: "Handle follow-up questions with connected detail",
        kind: "follow_up",
        cues: ["new situations", "prepared me", "choose me"],
      },
    ],
    followUpObjectives: [
      "Ask what experience best prepared the learner for the role.",
      "Ask how the learner handles a new or difficult situation.",
      "Prompt the learner to explain why they are a strong fit without repeating the same line.",
    ],
    benchmarkFocus: [
      "Open with interest and fit clearly.",
      "Support the answer with a real example.",
      "Handle follow-up questions with calm, connected detail.",
    ],
    requiredTurns: 6,
    minimumFollowUpResponses: 2,
  },
  "analyze-arguments-and-evidence": {
    scenarioTitle: "Evaluate an Argument",
    scenarioSetup:
      "You and your teacher are discussing an article that argues public transportation should be free for students.",
    counterpartRole: "teacher",
    openingQuestion: "What is the main claim, and how strong is the evidence?",
    warmupPrompts: [
      "State one claim in one sentence.",
      "Practice one sentence that evaluates evidence.",
    ],
    targetPhrases: [
      "The main claim is ...",
      "The evidence is convincing because ...",
      "However, ...",
      "One weakness is ...",
    ],
    followUpPrompts: [
      "Which piece of evidence is strongest?",
      "What assumption does the argument make?",
      "What counterpoint should be considered?",
    ],
    successCriteria: [
      "Identify the claim clearly.",
      "Evaluate evidence, not just opinion.",
      "Mention at least one limitation or counterpoint.",
    ],
    modelExample:
      "The main claim is that students should be able to use public transportation for free. The evidence is partly convincing because the article explains how transportation costs can limit access to school and activities, but it does not fully address who would pay for the program. One weakness is that it assumes every city could support the same solution.",
    evidenceTargets: [
      {
        key: "advanced-claim",
        label: "State the main claim clearly",
        kind: "task",
        cues: ["main claim", "the article argues", "the claim is"],
      },
      {
        key: "advanced-evidence",
        label: "Evaluate the strength of the evidence",
        kind: "language",
        cues: ["convincing", "partly convincing", "strongest evidence", "supports"],
      },
      {
        key: "advanced-weakness",
        label: "Name one limitation, assumption, or weakness",
        kind: "detail",
        cues: ["weakness", "assumption", "does not explain", "counterpoint"],
      },
      {
        key: "advanced-follow-up",
        label: "Handle follow-up questions with a specific critique",
        kind: "follow_up",
        cues: ["strongest", "assumption", "counterpoint"],
      },
    ],
    followUpObjectives: [
      "Ask which piece of evidence actually does the most work for the argument.",
      "Ask what assumption or limitation weakens the argument.",
      "Prompt for one counterpoint that should be considered before accepting the claim fully.",
    ],
    benchmarkFocus: [],
    requiredTurns: 5,
    minimumFollowUpResponses: 2,
  },
  "speak-and-write-in-formal-registers": {
    scenarioTitle: "Shift Into a Formal Register",
    scenarioSetup:
      "Your teacher asks you to turn an informal idea into a more formal academic response.",
    counterpartRole: "teacher",
    openingQuestion: "How would you express that idea in a more formal way?",
    warmupPrompts: [
      "Say one informal sentence, then make it more formal.",
      "Practice one academic transition.",
    ],
    targetPhrases: [
      "In my view, ...",
      "It is important to note that ...",
      "Furthermore, ...",
      "Therefore, ...",
    ],
    followUpPrompts: [
      "What makes that version more formal?",
      "Can you make the tone more precise?",
      "How would you say that to a teacher or employer?",
    ],
    successCriteria: [
      "Shift tone intentionally.",
      "Use precise, formal phrasing.",
      "Keep the meaning clear while changing register.",
    ],
    modelExample:
      "Instead of saying, 'Kids need more time to sleep,' I would say, 'Students require adequate rest in order to perform effectively in school.' Furthermore, later start times may better support adolescent learning.",
    evidenceTargets: [
      {
        key: "register-shift",
        label: "Shift the idea into a clearly more formal register",
        kind: "task",
        cues: ["in my view", "it is important to note", "students require"],
      },
      {
        key: "register-precision",
        label: "Use more precise and audience-appropriate phrasing",
        kind: "language",
        cues: ["therefore", "furthermore", "adequate", "effectively"],
      },
      {
        key: "register-rationale",
        label: "Explain why the revision sounds more formal",
        kind: "detail",
        cues: ["more formal", "more precise", "audience", "tone"],
      },
      {
        key: "register-follow-up",
        label: "Handle follow-up questions without falling back into casual tone",
        kind: "follow_up",
        cues: ["teacher", "employer", "formal"],
      },
    ],
    followUpObjectives: [
      "Ask what makes the revised sentence more formal than the original version.",
      "Ask how the learner would make the tone more precise for a teacher or employer.",
      "Prompt for one more sentence that keeps the same idea in a formal register.",
    ],
    benchmarkFocus: [],
    requiredTurns: 5,
    minimumFollowUpResponses: 2,
  },
  "debate-persuade-and-respond": {
    scenarioTitle: "Defend a Position in Debate",
    scenarioSetup:
      "In a class debate about whether homework should be reduced, present your position and answer an objection.",
    counterpartRole: "teacher",
    openingQuestion: "What is your position on reducing homework?",
    warmupPrompts: [
      "State your position in one clear sentence.",
      "Practice one rebuttal sentence.",
    ],
    targetPhrases: [
      "I strongly believe ...",
      "My main reason is ...",
      "However, ...",
      "I would respond that ...",
    ],
    followUpPrompts: [
      "What is your strongest reason?",
      "How would you answer the other side?",
      "What would you say to someone who disagrees?",
    ],
    successCriteria: [
      "State a clear position.",
      "Support it persuasively.",
      "Respond to one objection or opposing view.",
    ],
    modelExample:
      "I believe homework should be reduced in lower grades because too much of it can hurt balance and sleep. My main reason is that students still need time to rest and participate in other activities. If someone disagrees, I would say that quality matters more than quantity.",
    evidenceTargets: [
      {
        key: "debate-position",
        label: "State a clear position immediately",
        kind: "task",
        cues: ["i believe", "my position", "should be reduced"],
      },
      {
        key: "debate-support",
        label: "Support the position with a persuasive reason",
        kind: "language",
        cues: ["my main reason is", "because", "the strongest reason"],
      },
      {
        key: "debate-rebuttal",
        label: "Respond to an objection with a real rebuttal",
        kind: "detail",
        cues: ["however", "i would respond that", "on the other hand"],
      },
      {
        key: "debate-pressure",
        label: "Sustain the position across benchmark follow-up pressure",
        kind: "follow_up",
        cues: ["disagrees", "objection", "other side"],
      },
    ],
    followUpObjectives: [
      "Ask for the strongest reason behind the learner's position.",
      "Ask how the learner would answer the other side or a likely objection.",
      "Prompt the learner to defend the position again without repeating the same sentence word for word.",
    ],
    benchmarkFocus: [
      "Open with a clear position and a strong reason.",
      "Answer objections without losing the stance.",
      "Keep the rebuttal coherent across multiple follow-up questions.",
    ],
    requiredTurns: 7,
    minimumFollowUpResponses: 3,
  },
  "interpret-complex-texts-and-implied-meaning": {
    scenarioTitle: "Explain an Inference",
    scenarioSetup:
      "After reading a short story, your teacher asks what the ending implies about the main character.",
    counterpartRole: "teacher",
    openingQuestion: "What do you think the ending implies about the main character?",
    warmupPrompts: [
      "Say one inference using I think the text suggests ...",
      "Practice one sentence about tone or purpose.",
    ],
    targetPhrases: [
      "The text suggests ...",
      "This implies that ...",
      "The tone seems ...",
      "The author may be showing ...",
    ],
    followUpPrompts: [
      "Which detail led you to that interpretation?",
      "Could there be another meaning?",
      "How does the tone support your idea?",
    ],
    successCriteria: [
      "Explain an inference clearly.",
      "Support it with a textual detail.",
      "Link tone or purpose to your interpretation.",
    ],
    modelExample:
      "I think the ending implies that the main character has changed, even though the author never says it directly. The quiet tone and final image suggest a new sense of acceptance. That detail supports the idea that the character is no longer resisting the situation.",
    evidenceTargets: [
      {
        key: "inference-claim",
        label: "State one clear inference about the text",
        kind: "task",
        cues: ["the text suggests", "this implies", "the ending implies"],
      },
      {
        key: "inference-detail",
        label: "Support the inference with a specific textual detail",
        kind: "language",
        cues: ["detail", "final image", "supports", "suggests"],
      },
      {
        key: "inference-tone",
        label: "Explain how tone or author purpose supports the interpretation",
        kind: "detail",
        cues: ["tone", "author may be showing", "purpose", "quiet"],
      },
      {
        key: "inference-follow-up",
        label: "Handle follow-up questions without reducing the answer to plot summary",
        kind: "follow_up",
        cues: ["another meaning", "tone support", "interpretation"],
      },
    ],
    followUpObjectives: [
      "Ask which specific detail led the learner to the interpretation.",
      "Ask how the tone or author purpose supports the inference.",
      "Prompt for one alternative reading without losing the main interpretation.",
    ],
    benchmarkFocus: [],
    requiredTurns: 5,
    minimumFollowUpResponses: 2,
  },
  "academic-and-professional-communication": {
    scenarioTitle: "Give a Professional Recommendation",
    scenarioSetup:
      "You are presenting a recommendation in a school or workplace meeting. Explain your proposal clearly and professionally.",
    counterpartRole: "teacher",
    openingQuestion: "Can you summarize your recommendation for the group?",
    warmupPrompts: [
      "State one recommendation in one sentence.",
      "Practice one sentence that explains the benefit of it.",
    ],
    targetPhrases: [
      "I recommend that ...",
      "The main objective is ...",
      "To clarify, ...",
      "This approach would ...",
    ],
    followUpPrompts: [
      "What problem does this solve?",
      "What is the main benefit of your recommendation?",
      "How would you explain this to someone new to the project?",
    ],
    successCriteria: [
      "Present a clear recommendation.",
      "Explain purpose and benefit.",
      "Use organized, professional language.",
    ],
    modelExample:
      "I recommend that we move the orientation session online before the first week of class. The main objective is to save time and give students access to the information earlier. This approach would also reduce confusion on the first day.",
    evidenceTargets: [
      {
        key: "recommendation-core",
        label: "Present a clear recommendation early",
        kind: "task",
        cues: ["i recommend", "the main objective", "this approach would"],
      },
      {
        key: "recommendation-purpose",
        label: "Explain the purpose or problem being solved",
        kind: "language",
        cues: ["objective", "problem", "to clarify", "solve"],
      },
      {
        key: "recommendation-benefit",
        label: "Explain the main benefit or outcome",
        kind: "detail",
        cues: ["benefit", "reduce confusion", "earlier", "prepared"],
      },
      {
        key: "recommendation-follow-up",
        label: "Handle follow-up questions with organized professional language",
        kind: "follow_up",
        cues: ["benefit", "new to the project", "clarify"],
      },
    ],
    followUpObjectives: [
      "Ask what problem the recommendation solves or what objective it serves.",
      "Ask for the main benefit or outcome of the recommendation.",
      "Prompt the learner to clarify the proposal for someone new to the project.",
    ],
    benchmarkFocus: [],
    requiredTurns: 5,
    minimumFollowUpResponses: 2,
  },
  "capstone-synthesize-argue-recommend": {
    scenarioTitle: "Present a Capstone Recommendation",
    scenarioSetup:
      "You are speaking to a school committee about whether the school day should start later. Synthesize key ideas and recommend a next step.",
    counterpartRole: "teacher",
    openingQuestion: "What do you recommend the school do next, and why?",
    warmupPrompts: [
      "State one recommendation clearly.",
      "Practice one sentence that combines evidence and reasoning.",
    ],
    targetPhrases: [
      "Based on the evidence, ...",
      "A balanced solution would be ...",
      "The strongest reason is ...",
      "I recommend ...",
    ],
    followUpPrompts: [
      "Which evidence matters most here?",
      "What tradeoff should the committee consider?",
      "Why is your recommendation the most practical?",
    ],
    successCriteria: [
      "Synthesize more than one idea.",
      "Acknowledge a tradeoff.",
      "Give a justified recommendation.",
    ],
    modelExample:
      "Based on the evidence, I recommend that the school start 30 minutes later next year as a pilot program. The strongest reason is that students may focus better with more sleep, although transportation schedules would need adjustment. A shorter pilot is the most practical first step.",
    evidenceTargets: [
      {
        key: "capstone-synthesis",
        label: "Synthesize more than one relevant idea or evidence point",
        kind: "task",
        cues: ["based on the evidence", "strongest reason", "more than one"],
      },
      {
        key: "capstone-tradeoff",
        label: "Acknowledge a real tradeoff or limitation",
        kind: "language",
        cues: ["although", "however", "tradeoff", "would need adjustment"],
      },
      {
        key: "capstone-recommendation",
        label: "Give a practical recommendation or next step",
        kind: "detail",
        cues: ["i recommend", "pilot program", "next step", "practical"],
      },
      {
        key: "capstone-pressure",
        label: "Sustain the synthesis under benchmark follow-up pressure",
        kind: "follow_up",
        cues: ["evidence matters most", "tradeoff", "practical"],
      },
    ],
    followUpObjectives: [
      "Ask which evidence matters most to the final recommendation.",
      "Ask what tradeoff the committee still needs to weigh.",
      "Prompt the learner to defend why the recommendation is the most practical next step.",
    ],
    benchmarkFocus: [
      "Synthesize evidence instead of listing disconnected points.",
      "Keep the tradeoff visible while still defending the recommendation.",
      "Sustain a justified final recommendation across multiple follow-up questions.",
    ],
    requiredTurns: 7,
    minimumFollowUpResponses: 3,
  },
};
