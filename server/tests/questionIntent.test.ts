import { describe, expect, it } from "vitest";
import {
  isAuthQuestion,
  isBehaviorQuestion,
  isDeadCodeQuestion,
  isOverviewQuestion,
  isServiceWalkthroughQuestion,
  isStructureQuestion
} from "../src/utils/questionIntent.js";

describe("question intent", () => {
  it("routes listing questions to the structure map, but not words that merely contain 'list'", () => {
    expect(isStructureQuestion("List the top-level folders")).toBe(true);
    expect(isStructureQuestion("Which are the main entry files?")).toBe(true);
    expect(isStructureQuestion("How does the event listener register handlers?")).toBe(false);
    expect(isStructureQuestion("Where is the playlist saved?")).toBe(false);
  });

  it("recognises behaviour questions by whole words", () => {
    expect(isBehaviorQuestion("How does checkout work?")).toBe(true);
    expect(isBehaviorQuestion("Explain the retry logic")).toBe(true);
    expect(isBehaviorQuestion("Which framework is used?")).toBe(false);
    expect(isBehaviorQuestion("Show the offline config")).toBe(false);
  });

  it("does not mistake 'author' for an auth question", () => {
    expect(isAuthQuestion("How does login create a session?")).toBe(true);
    expect(isAuthQuestion("Where are JWT tokens verified?")).toBe(true);
    expect(isAuthQuestion("Is the sign-up form validated?")).toBe(true);
    expect(isAuthQuestion("Who is the author of the parser?")).toBe(false);
  });

  it("recognises dead-code and deletion questions", () => {
    expect(isDeadCodeQuestion("Is there any unused code?")).toBe(true);
    expect(isDeadCodeQuestion("Is it safe to delete utils/legacy.ts?")).toBe(true);
    expect(isDeadCodeQuestion("Can I remove this code path?")).toBe(true);
    expect(isDeadCodeQuestion("How are deleted orders archived?")).toBe(false);
  });

  it("recognises overview and service walkthrough questions", () => {
    expect(isOverviewQuestion("What is this repository about?")).toBe(true);
    expect(isOverviewQuestion("Give me a high-level architecture view")).toBe(true);
    expect(isOverviewQuestion("Where is the payment webhook?")).toBe(false);
    expect(isServiceWalkthroughQuestion("Walk me through the billing service")).toBe(true);
    expect(isServiceWalkthroughQuestion("Where is the services folder?")).toBe(false);
  });
});
