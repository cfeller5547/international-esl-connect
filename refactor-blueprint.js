import * as fs from "fs";
import * as path from "path";

const targetPath = "src/server/curriculum-blueprint.ts";
let code = fs.readFileSync(targetPath, "utf-8");

// 1. "family-friends-and-classroom-language" (was sort_rush, make reaction_pick)
code = code.replace(
  /makeSortRushStage\([\s\S]*?theme:\s*"mint"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"mint",\s*layoutVariant:\s*"arcade_sort_rush"/,
  `makeReactionPickStage(
            stageId(level, unitIndex, "reaction"),
            "Quick Response",
            "Pick the best reply or detail under pressure.",
            [
              {
                id: "round-1",
                prompt: "Your teacher says: 'Can everyone open their books?'",
                dialoguePrompt: "What is the best quick response?",
                options: [
                  { id: "opt-1", label: "Yes, I have it.", detail: "Ready" },
                  { id: "opt-2", label: "I like books.", detail: "Unrelated", isNearMiss: true },
                  { id: "opt-3", label: "Where is the door?", detail: "Random" },
                ],
                correctOptionId: "opt-1"
              },
              {
                id: "round-2",
                prompt: "Describe your best friend in one sentence.",
                options: [
                  { id: "opt-1", label: "He is tall and very funny.", detail: "Clear" },
                  { id: "opt-2", label: "He goes to school.", detail: "Too general", isNearMiss: true },
                  { id: "opt-3", label: "I am friendly.", detail: "Wrong person" },
                ],
                correctOptionId: "opt-1"
              },
              {
                id: "round-3",
                prompt: "Your brother is late for dinner.",
                dialoguePrompt: "What should you tell your mom?",
                options: [
                  { id: "opt-1", label: "He said he will be 10 minutes late.", detail: "Helpful" },
                  { id: "opt-2", label: "He is a brother.", detail: "Fact", isNearMiss: true },
                  { id: "opt-3", label: "I am hungry.", detail: "Selfish" },
                ],
                correctOptionId: "opt-1"
              }
            ],
            "Great reflexes. You picked the most natural responses.",
            "Choose the response that actually fits the situation.",
            {
              timerMs: 20000,
              soundSet: "classroom",
              theme: "mint",
              presentation: gamePresentation("arcade_reaction_pick", {
                boardTitle: "Quick Reactions",
                helperText: "Read the situation and lock your reaction fast.",
                resolvedTitle: "Responses locked",
                resolvedNote: "You reacted naturally to classroom and family situations.",
              }),
            }
          ),
        ],
        {
          theme: "mint",
          layoutVariant: "arcade_reaction_pick"`
);

// 2. "school-work-and-responsibilities" (was sort_rush -> lane_runner)
code = code.replace(
  /makeSortRushStage\([\s\S]*?theme:\s*"coral"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"coral",\s*layoutVariant:\s*"arcade_sort_rush"/,
  `makeLaneRunnerStage(
            stageId(level, unitIndex, "deadline-runner"),
            "Deadline Dash",
            "Collect the steps for your project in the exact order you need to do them.",
            [
              { id: "lane-1", label: "Planning" },
              { id: "lane-2", label: "Drafting" },
              { id: "lane-3", label: "Reviewing" },
            ],
            [
              { id: "step-1", label: "Outline main points", lane: 0, role: "target", column: 1 },
              { id: "step-2", label: "Write the draft", lane: 1, role: "target", column: 3 },
              { id: "step-3", label: "Check for errors", lane: 2, role: "target", column: 5 },
              { id: "decoy-1", label: "Watch a movie", lane: 1, role: "hazard", column: 2 },
              { id: "decoy-2", label: "Play video games", lane: 0, role: "hazard", column: 4 },
              { id: "decoy-3", label: "Sleep early", lane: 2, role: "hazard", column: 6 },
            ],
            ["step-1", "step-2", "step-3"],
            "Perfect. You built a logical timeline for your responsibilities.",
            "Collect the project steps in order. Dodge the distractions.",
            {
              timerMs: 24000,
              theme: "coral",
              soundSet: "planner",
              presentation: gamePresentation("arcade_lane_runner", {
                boardTitle: "Project Timeline",
                helperLabel: "Deadline runner",
                helperText: "Grab the work steps in order. Avoid the distractions.",
                callToAction: "Lock board",
                resolvedTitle: "Schedule cleared",
                resolvedNote: "You survived the schedule rush and kept your priorities straight.",
              }),
            }
          ),
        ],
        {
          theme: "coral",
          layoutVariant: "arcade_lane_runner"`
);

// 3. "tell-stories-clearly" (was sequence -> route_race)
code = code.replace(
  /makeSequenceStage\([\s\S]*?layoutVariant:\s*"comic"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"indigo",\s*layoutVariant:\s*"comic"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Story Chain",
              "Trace the events of the story in the correct narrative order.",
              [
                { id: "start", label: "We arrived at the museum.", x: 20, y: 20 },
                { id: "tension", label: "I got lost from my group.", x: 50, y: 50 },
                { id: "resolution", label: "A guide helped me find them.", x: 80, y: 80 },
                { id: "decoy-1", label: "I bought a sandwich.", x: 80, y: 20 },
                { id: "decoy-2", label: "The bus was yellow.", x: 20, y: 80 },
              ],
              ["start", "tension", "resolution"],
              "Good. The story flows logically from beginning to end.",
              "Trace the main events of the story. Ignore the minor details.",
              {
                timerMs: 20000,
                theme: "indigo",
                soundSet: "story",
                pathRules: { startNodeId: "start", finishNodeId: "resolution" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Story Chain",
                  helperLabel: "Narrative path",
                  helperText: "Connect the opening, tension, and resolution.",
                  connections: [
                    { fromId: "start", toId: "tension" },
                    { fromId: "tension", toId: "resolution" },
                    { fromId: "start", toId: "decoy-1" },
                    { fromId: "start", toId: "decoy-2" },
                    { fromId: "tension", toId: "decoy-1" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "indigo",
            layoutVariant: "arcade_route_race"`
);

// 4. "explain-opinions-and-give-reasons" (was assemble -> route_race)
code = code.replace(
  /makeAssembleStage\([\s\S]*?layoutVariant:\s*"stack"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"sky",\s*layoutVariant:\s*"stack"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Opinion Chain",
              "Trace the strongest argument from opinion to reason to example.",
              [
                { id: "opinion", label: "Remote work is better.", x: 20, y: 50 },
                { id: "reason", label: "It saves commute time.", x: 50, y: 20 },
                { id: "example", label: "I save 2 hours a day.", x: 80, y: 50 },
                { id: "weak-reason", label: "I can wear pajamas.", x: 50, y: 80 },
                { id: "weak-example", label: "My cat is cute.", x: 80, y: 20 },
              ],
              ["opinion", "reason", "example"],
              "Strong argument. The opinion is fully supported.",
              "Trace from the opinion to the strongest reason, then to the best example.",
              {
                timerMs: 20000,
                theme: "sky",
                soundSet: "planner",
                pathRules: { startNodeId: "opinion", finishNodeId: "example" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Argument Path",
                  helperLabel: "Opinion chain",
                  helperText: "Connect your opinion to the most professional reason and example.",
                  connections: [
                    { fromId: "opinion", toId: "reason" },
                    { fromId: "reason", toId: "example" },
                    { fromId: "opinion", toId: "weak-reason" },
                    { fromId: "weak-reason", toId: "example" },
                    { fromId: "reason", toId: "weak-example" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "sky",
            layoutVariant: "arcade_route_race"`
);

// 5. "solve-problems-and-make-decisions" (was priority_board -> reaction_pick)
code = code.replace(
  /makePriorityBoardStage\([\s\S]*?theme:\s*"emerald"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"emerald",\s*layoutVariant:\s*"triage"/,
  `makeReactionPickStage(
              stageId(level, unitIndex, "reaction"),
              "Crisis Triage",
              "Make fast tradeoff choices to solve the problem.",
              [
                {
                  id: "round-1",
                  prompt: "The project is over budget.",
                  dialoguePrompt: "What is the best immediate step?",
                  options: [
                    { id: "opt-1", label: "Review all recent expenses.", detail: "Analytical" },
                    { id: "opt-2", label: "Ask for more money.", detail: "Too fast", isNearMiss: true },
                    { id: "opt-3", label: "Cancel the project.", detail: "Extreme" },
                  ],
                  correctOptionId: "opt-1"
                },
                {
                  id: "round-2",
                  prompt: "Two team members are arguing over a design.",
                  dialoguePrompt: "How do you resolve it?",
                  options: [
                    { id: "opt-1", label: "Schedule a meeting to hear both sides.", detail: "Fair" },
                    { id: "opt-2", label: "Tell them to stop.", detail: "Unhelpful", isNearMiss: true },
                    { id: "opt-3", label: "Flip a coin.", detail: "Unprofessional" },
                  ],
                  correctOptionId: "opt-1"
                }
              ],
              "Excellent decisions under pressure.",
              "Pick the most professional and analytical solution.",
              {
                timerMs: 20000,
                soundSet: "comparison",
                theme: "emerald",
                presentation: gamePresentation("arcade_reaction_pick", {
                  boardTitle: "Decision Triage",
                  helperText: "Lock your solution fast.",
                  resolvedTitle: "Crisis Managed",
                  resolvedNote: "You made the right tradeoff choices under pressure.",
                }),
              }
            ),
          ],
          {
            theme: "emerald",
            layoutVariant: "arcade_reaction_pick"`
);

// 6. "future-plans-goals-and-possibilities" (was priority_board -> route_race)
code = code.replace(
  /makePriorityBoardStage\([\s\S]*?layoutVariant:\s*"triage"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"purple",\s*layoutVariant:\s*"triage"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Goal Path",
              "Trace the branching path from your current state to your future goal.",
              [
                { id: "current", label: "Entry-level job", x: 20, y: 50 },
                { id: "skill", label: "Learn new software", x: 50, y: 20 },
                { id: "promotion", label: "Get promoted", x: 80, y: 50 },
                { id: "wait", label: "Wait 5 years", x: 50, y: 80 },
                { id: "quit", label: "Quit", x: 80, y: 80 },
              ],
              ["current", "skill", "promotion"],
              "A solid, proactive career plan.",
              "Trace the path that shows active skill building, not passive waiting.",
              {
                timerMs: 20000,
                theme: "purple",
                soundSet: "planner",
                pathRules: { startNodeId: "current", finishNodeId: "promotion" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Career Path",
                  helperLabel: "Goal chain",
                  helperText: "Connect your current state to the most proactive future goal.",
                  connections: [
                    { fromId: "current", toId: "skill" },
                    { fromId: "skill", toId: "promotion" },
                    { fromId: "current", toId: "wait" },
                    { fromId: "wait", toId: "promotion" },
                    { fromId: "current", toId: "quit" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "purple",
            layoutVariant: "arcade_route_race"`
);

// 7. "real-world-interaction-travel-interviews-presentations" (was assemble -> route_race)
code = code.replace(
  /makeAssembleStage\([\s\S]*?layoutVariant:\s*"stack"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"emerald",\s*layoutVariant:\s*"stack"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Interview Path",
              "Trace the best flow for an interview response.",
              [
                { id: "thanks", label: "Thank you for having me.", x: 20, y: 50 },
                { id: "exp", label: "I have 5 years of experience.", x: 50, y: 20 },
                { id: "value", label: "I can bring value to this team.", x: 80, y: 50 },
                { id: "pay", label: "How much is the pay?", x: 50, y: 80 },
                { id: "late", label: "Sorry I am late.", x: 20, y: 20 },
              ],
              ["thanks", "exp", "value"],
              "A very professional and confident response flow.",
              "Trace the polite, experienced, and value-driven path.",
              {
                timerMs: 20000,
                theme: "emerald",
                soundSet: "story",
                pathRules: { startNodeId: "thanks", finishNodeId: "value" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Interview Flow",
                  helperLabel: "Professional path",
                  helperText: "Connect the strongest professional statements.",
                  connections: [
                    { fromId: "thanks", toId: "exp" },
                    { fromId: "exp", toId: "value" },
                    { fromId: "thanks", toId: "pay" },
                    { fromId: "late", toId: "exp" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "emerald",
            layoutVariant: "arcade_route_race"`
);

// 8. "speak-and-write-in-formal-registers" (was assemble -> route_race)
code = code.replace(
  /makeAssembleStage\([\s\S]*?layoutVariant:\s*"stack"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"indigo",\s*layoutVariant:\s*"stack"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Formal Chain",
              "Trace the most polite and formal request path.",
              [
                { id: "dear", label: "Dear Mr. Smith,", x: 20, y: 50 },
                { id: "request", label: "I am writing to request a meeting.", x: 50, y: 20 },
                { id: "regards", label: "Best regards,", x: 80, y: 50 },
                { id: "hey", label: "Hey Smith,", x: 20, y: 80 },
                { id: "want", label: "I want a meeting now.", x: 50, y: 80 },
              ],
              ["dear", "request", "regards"],
              "Perfectly formal and polite.",
              "Trace the path with the most formal register.",
              {
                timerMs: 20000,
                theme: "indigo",
                soundSet: "planner",
                pathRules: { startNodeId: "dear", finishNodeId: "regards" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Register Path",
                  helperLabel: "Formal chain",
                  helperText: "Connect the formal greeting, request, and sign-off.",
                  connections: [
                    { fromId: "dear", toId: "request" },
                    { fromId: "request", toId: "regards" },
                    { fromId: "hey", toId: "want" },
                    { fromId: "dear", toId: "want" },
                    { fromId: "hey", toId: "request" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "indigo",
            layoutVariant: "arcade_route_race"`
);

// 9. "debate-persuade-and-respond" (was priority_board -> reaction_pick)
code = code.replace(
  /makePriorityBoardStage\([\s\S]*?layoutVariant:\s*"triage"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"rose",\s*layoutVariant:\s*"triage"/,
  `makeReactionPickStage(
              stageId(level, unitIndex, "reaction"),
              "Debate Triage",
              "Pick the strongest counter-arguments under pressure.",
              [
                {
                  id: "round-1",
                  prompt: "Opponent: 'Social media is entirely a waste of time.'",
                  dialoguePrompt: "What is the best counter-argument?",
                  options: [
                    { id: "opt-1", label: "It actually helps small businesses grow.", detail: "Evidence-based" },
                    { id: "opt-2", label: "You are wrong.", detail: "Aggressive", isNearMiss: true },
                    { id: "opt-3", label: "I like watching videos.", detail: "Weak" },
                  ],
                  correctOptionId: "opt-1"
                },
                {
                  id: "round-2",
                  prompt: "Opponent: 'Electric cars are too expensive.'",
                  dialoguePrompt: "How do you respond logically?",
                  options: [
                    { id: "opt-1", label: "They save money on gas in the long run.", detail: "Logical" },
                    { id: "opt-2", label: "They are good for the earth.", detail: "Different topic", isNearMiss: true },
                    { id: "opt-3", label: "Nobody cares about the price.", detail: "False" },
                  ],
                  correctOptionId: "opt-1"
                }
              ],
              "Excellent. You countered with strong, logical evidence.",
              "Pick the logical, evidence-based counter-argument.",
              {
                timerMs: 20000,
                soundSet: "comparison",
                theme: "rose",
                presentation: gamePresentation("arcade_reaction_pick", {
                  boardTitle: "Debate Triage",
                  helperText: "Lock your counter-argument fast.",
                  resolvedTitle: "Debate Won",
                  resolvedNote: "You used timed triage to dismantle the opponent's points.",
                }),
              }
            ),
          ],
          {
            theme: "rose",
            layoutVariant: "arcade_reaction_pick"`
);

// 10. "academic-and-professional-communication" (was priority_board -> route_race)
code = code.replace(
  /makePriorityBoardStage\([\s\S]*?layoutVariant:\s*"triage"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"sky",\s*layoutVariant:\s*"triage"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Academic Path",
              "Trace the structure of a strong academic paragraph.",
              [
                { id: "topic", label: "Topic sentence", x: 20, y: 50 },
                { id: "evidence", label: "Supporting evidence", x: 50, y: 20 },
                { id: "analysis", label: "Analysis", x: 80, y: 50 },
                { id: "opinion", label: "Personal opinion", x: 50, y: 80 },
                { id: "quote", label: "Random quote", x: 80, y: 20 },
              ],
              ["topic", "evidence", "analysis"],
              "Perfect academic structure.",
              "Trace the path from topic, to evidence, to analysis.",
              {
                timerMs: 20000,
                theme: "sky",
                soundSet: "planner",
                pathRules: { startNodeId: "topic", finishNodeId: "analysis" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Academic Flow",
                  helperLabel: "Paragraph chain",
                  helperText: "Connect the core elements of academic writing.",
                  connections: [
                    { fromId: "topic", toId: "evidence" },
                    { fromId: "evidence", toId: "analysis" },
                    { fromId: "topic", toId: "opinion" },
                    { fromId: "opinion", toId: "analysis" },
                    { fromId: "evidence", toId: "quote" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "sky",
            layoutVariant: "arcade_route_race"`
);

// 11. "capstone-synthesize-argue-recommend" (was priority_board -> route_race)
code = code.replace(
  /makePriorityBoardStage\([\s\S]*?layoutVariant:\s*"triage"[\s\S]*?\}\s*\)\s*\),\s*\]\s*,\s*\{\s*theme:\s*"amber",\s*layoutVariant:\s*"triage"/,
  `makeRouteRaceStage(
              stageId(level, unitIndex, "route"),
              "Capstone Path",
              "Trace your final argument from synthesis to recommendation.",
              [
                { id: "synth", label: "Synthesize data", x: 20, y: 50 },
                { id: "argue", label: "Formulate argument", x: 50, y: 20 },
                { id: "recommend", label: "Final recommendation", x: 80, y: 50 },
                { id: "ignore", label: "Ignore data", x: 20, y: 80 },
                { id: "guess", label: "Guess conclusion", x: 50, y: 80 },
              ],
              ["synth", "argue", "recommend"],
              "An airtight capstone argument.",
              "Trace the logical path from data to recommendation.",
              {
                timerMs: 20000,
                theme: "amber",
                soundSet: "story",
                pathRules: { startNodeId: "synth", finishNodeId: "recommend" },
                presentation: gamePresentation("arcade_route_race", {
                  boardTitle: "Capstone Flow",
                  helperLabel: "Synthesis chain",
                  helperText: "Connect your synthesis to a strong argument and recommendation.",
                  connections: [
                    { fromId: "synth", toId: "argue" },
                    { fromId: "argue", toId: "recommend" },
                    { fromId: "synth", toId: "ignore" },
                    { fromId: "ignore", toId: "guess" },
                    { fromId: "synth", toId: "guess" },
                  ]
                }),
              }
            ),
          ],
          {
            theme: "amber",
            layoutVariant: "arcade_route_race"`
);

fs.writeFileSync(targetPath, code, "utf-8");
console.log("Refactor complete!");
