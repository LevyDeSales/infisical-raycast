import { describe, expect, it } from "vitest";
import { joinSecretFolderPath, normalizeSecretFolderPath } from "./secret-folder-path";

describe("secret folder paths", () => {
  it("normalizes the root and redundant separators", () => {
    expect(normalizeSecretFolderPath(undefined)).toBe("/");
    expect(normalizeSecretFolderPath("//aws///credentials/")).toBe("/aws/credentials");
  });

  it("joins a child folder below root and a nested parent", () => {
    expect(joinSecretFolderPath("/", "aws")).toBe("/aws");
    expect(joinSecretFolderPath("/aws", "credentials")).toBe("/aws/credentials");
  });
});
