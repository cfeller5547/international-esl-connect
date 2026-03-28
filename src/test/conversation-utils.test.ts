import { describe, expect, it } from "vitest";

import { classifyLiveStudentTurn, isClarificationRequest } from "@/lib/conversation-utils";

describe("conversation-utils live turn classification", () => {
  it("treats explicit repeat requests as clarification requests", () => {
    expect(isClarificationRequest("say that again")).toBe(true);
    expect(classifyLiveStudentTurn("sorry?")).toMatchObject({
      disposition: "clarification_request",
      countsTowardProgress: false,
    });
  });

  it("treats non-English confusion text as a clarification request", () => {
    expect(classifyLiveStudentTurn("什么?")).toMatchObject({
      disposition: "clarification_request",
      reasonCode: "clarification_non_english",
      countsTowardProgress: false,
    });
  });

  it("does not count acknowledgements or fragments as accepted answers", () => {
    expect(classifyLiveStudentTurn("Thank you.")).toMatchObject({
      disposition: "acknowledgement_only",
      countsTowardProgress: false,
    });

    expect(classifyLiveStudentTurn("to some of the workers.")).toMatchObject({
      disposition: "off_task_short",
      countsTowardProgress: false,
    });
  });

  it("accepts a real learner answer", () => {
    expect(
      classifyLiveStudentTurn(
        "I think it is important because people remember your name after that."
      )
    ).toMatchObject({
      disposition: "accepted_answer",
      countsTowardProgress: true,
    });
  });
});
