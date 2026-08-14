import { describe, expect, it } from "vitest";
import { buildSecretPath } from "./secret-path";

describe("buildSecretPath", () => {
  it("builds a root secret path when no nested path is supplied", () => {
    expect(buildSecretPath("alltius-secret-intake", "production", undefined, "API_KEY")).toBe(
      "/alltius-secret-intake/production/API_KEY",
    );
  });

  it("normalizes redundant slashes in a nested secret path", () => {
    expect(buildSecretPath("alltius-secret-intake", "production", "/aws//credentials/", "AWS_ACCESS_KEY_ID")).toBe(
      "/alltius-secret-intake/production/aws/credentials/AWS_ACCESS_KEY_ID",
    );
  });
});
