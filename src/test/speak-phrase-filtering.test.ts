/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { filterSpeakVocabulary } from "@/lib/speak";

describe("filterSpeakVocabulary", () => {
  it("keeps reusable multi-word phrases and removes generic single-word items", () => {
    const filtered = filterSpeakVocabulary(
      [
        {
          term: "beautiful",
          definition: "Pleasant to look at.",
          translation: "beautiful",
        },
        {
          term: "yeah my name is",
          definition: "Useful academic phrase from your session.",
          translation: "yeah my name is",
        },
        {
          term: "Because there is",
          definition: "Useful academic phrase from your session.",
          translation: "Because there is",
        },
        {
          term: "introductions",
          definition: "Topic word.",
          translation: "introductions",
        },
      ],
      4
    );

    expect(filtered).toEqual([
      {
        term: "my name is",
        definition: "A clear way to introduce yourself.",
        translation: "yeah my name is",
      },
      {
        term: "Because there is",
        definition: "A useful connector for giving a reason.",
        translation: "Because there is",
      },
    ]);
  });
});
