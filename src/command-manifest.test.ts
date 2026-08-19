import { describe, expect, it } from "vitest";
import manifest from "../package.json";

describe("extension commands", () => {
  it("registers the global credential search view command", () => {
    expect(manifest.commands).toContainEqual(
      expect.objectContaining({
        name: "search-credentials",
        title: "Search Credentials",
        mode: "view",
      }),
    );
  });
});
