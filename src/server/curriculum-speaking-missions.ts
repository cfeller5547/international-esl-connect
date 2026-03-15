export type AuthoredSpeakingMission = {
  scenarioTitle: string;
  scenarioSetup: string;
  counterpartRole: string;
  openingQuestion: string;
  warmupPrompts: string[];
  targetPhrases: string[];
  followUpPrompts: string[];
  successCriteria: string[];
  modelExample: string;
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
  },
  "habits-and-routines-in-more-detail": {
    scenarioTitle: "Explain Your Full Weekday",
    scenarioSetup:
      "Your teacher asks you to explain your weekday routine with more detail and frequency.",
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
      "Which part of your day is the busiest?",
      "What do you do most evenings?",
      "What do you do every day, and what do you only do sometimes?",
    ],
    successCriteria: [
      "Use time and frequency words.",
      "Include several connected details.",
      "Keep the order easy to follow.",
    ],
    modelExample:
      "I usually wake up at 6:30 and eat breakfast before school. After class, I often stay late for practice. In the evening, I usually finish homework before I relax.",
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
  },
  "what-is-happening-now": {
    scenarioTitle: "Describe What You See Right Now",
    scenarioSetup:
      "Your teacher asks you to describe what is happening in the classroom at this moment.",
    counterpartRole: "teacher",
    openingQuestion: "What is happening in the classroom right now?",
    warmupPrompts: [
      "Say one sentence with is or are plus an -ing verb.",
      "Practice one detail about what someone is wearing or doing.",
    ],
    targetPhrases: [
      "Right now, ...",
      "She is ...",
      "They are ...",
      "In the back, ...",
    ],
    followUpPrompts: [
      "What is one student doing right now?",
      "What is the teacher doing?",
      "What else do you notice?",
    ],
    successCriteria: [
      "Describe actions in progress.",
      "Mention more than one person or detail.",
      "Use clear present continuous sentences.",
    ],
    modelExample:
      "Right now, the teacher is writing on the board. Two students are reading near the window. In the back, another student is talking quietly with a partner.",
  },
  "school-work-and-responsibilities": {
    scenarioTitle: "Explain an Assignment Plan",
    scenarioSetup:
      "You are talking with a teacher about an assignment you need to finish and how you will do it.",
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
  },
  "comparing-choosing-and-short-narratives": {
    scenarioTitle: "Choose Between Two Options",
    scenarioSetup:
      "You are choosing between a movie night and a hiking trip, and explaining your preference to a friend.",
    counterpartRole: "classmate",
    openingQuestion: "Which one sounds better to you: the movie night or the hiking trip?",
    warmupPrompts: [
      "Say one sentence with I prefer.",
      "Practice one comparison with better or more.",
    ],
    targetPhrases: [
      "I prefer ...",
      "... is better because ...",
      "... is more ... than ...",
      "I'd choose ...",
    ],
    followUpPrompts: [
      "What is one advantage of your choice?",
      "What is one disadvantage of the other option?",
      "Can you give one more reason?",
    ],
    successCriteria: [
      "Make a clear choice.",
      "Compare the two options.",
      "Support your choice with at least one reason.",
    ],
    modelExample:
      "I'd choose the hiking trip because it's more active and cheaper. I prefer it to the movie night because I can spend more time outside with friends.",
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
  },
  "explain-opinions-and-give-reasons": {
    scenarioTitle: "Respond to a Class Discussion",
    scenarioSetup:
      "Your teacher asks whether school uniforms should be required. Give your opinion and support it.",
    counterpartRole: "teacher",
    openingQuestion: "Do you think school uniforms should be required?",
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
      "I think school uniforms should be required because they reduce pressure about clothes. For example, students may feel more equal. On the other hand, some students want more freedom, so schools should keep the rules simple.",
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
  },
  "study-summarize-and-respond": {
    scenarioTitle: "Summarize a Short Reading",
    scenarioSetup:
      "After reading a short article about school start times, your teacher asks you to summarize the main idea and give your response.",
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
      "The main idea is that later school start times can help students focus better. One important detail is that teenagers often do not sleep enough. I agree because students learn more when they are rested.",
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
  },
  "real-world-interaction-travel-interviews-presentations": {
    scenarioTitle: "Handle a Short Interview",
    scenarioSetup:
      "You are at a short interview for a student volunteer role. Introduce yourself and answer one follow-up question.",
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
      "I'm interested in this role because I enjoy helping people and working with a team. One strength I have is that I stay calm under pressure. For example, I helped organize a school event last semester.",
  },
  "analyze-arguments-and-evidence": {
    scenarioTitle: "Evaluate an Argument",
    scenarioSetup:
      "You and your teacher are discussing an article that argues schools should ban phones in class.",
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
      "The main claim is that phones should be banned during class time. The evidence is partly convincing because the article gives examples of distraction, but it does not show whether strict bans improve long-term learning. One weakness is that it ignores cases where phones support class activities.",
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
  },
};
