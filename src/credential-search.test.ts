import { describe, expect, it, vi } from "vitest";
import type { Workspace } from "./types";

const { listSecrets, getSecret, callInfisicalSdk } = vi.hoisted(() => ({
  listSecrets: vi.fn(),
  getSecret: vi.fn(),
  callInfisicalSdk: vi.fn(),
}));

vi.mock("./infisical", () => ({
  infisical: {
    secrets: () => ({ listSecrets, getSecret }),
  },
}));

vi.mock("./authentication", () => ({ callInfisicalSdk }));

import {
  MAX_CONCURRENT_PROJECT_SCANS,
  copyMatchedSecret,
  getDefaultSearchEnvironment,
  getSearchEnvironments,
  rankCredentialMatches,
  searchCredentials,
  type CredentialSearchMatch,
} from "./credential-search";

function workspace(id: string, environments: Array<{ name: string; slug: string }>): Workspace {
  return {
    id,
    name: id,
    slug: id,
    organization: "organization-1",
    environments,
  };
}

function match(secretKey: string, secretPath = "/"): CredentialSearchMatch {
  return {
    project: workspace("project-1", [{ name: "Production", slug: "prod" }]),
    environment: "prod",
    secret: { id: secretKey, secretKey, secretPath },
  };
}

function sdkSecret(secretKey: string, secretPath = "/") {
  return { id: secretKey, secretKey, secretPath };
}

describe("credential search", () => {
  it("prefers the Production display name even when its slug is prod", () => {
    const environments = getSearchEnvironments([
      workspace("one", [
        { name: "Development", slug: "dev" },
        { name: "Production", slug: "prod" },
      ]),
      workspace("two", [
        { name: "Production", slug: "prod" },
        { name: "Staging", slug: "staging" },
      ]),
    ]);

    expect(environments).toEqual([
      { name: "Development", slug: "dev" },
      { name: "Production", slug: "prod" },
      { name: "Staging", slug: "staging" },
    ]);
    expect(getDefaultSearchEnvironment(environments)).toBe("prod");
  });

  it("matches and ranks only secret keys without retaining a value", () => {
    const results = rankCredentialMatches(
      [match("MY_PLUNK_TOKEN", "/z"), match("PLUNK_API_KEY", "/a"), match("OTHER_KEY")],
      "plunk",
    );

    expect(results.map((result) => result.secret.secretKey)).toEqual(["PLUNK_API_KEY", "MY_PLUNK_TOKEN"]);
    expect(Object.hasOwn(results[0].secret, "secretValue")).toBe(false);
  });

  it("scans only eligible projects with recursive value-safe options", async () => {
    const productionWorkspace = workspace("production-project", [{ name: "Production", slug: "prod" }]);
    const developmentWorkspace = workspace("development-project", [{ name: "Development", slug: "dev" }]);
    listSecrets.mockResolvedValue({ secrets: [sdkSecret("PLUNK_API_KEY", "/integrations")] });
    callInfisicalSdk.mockImplementation((operation) => operation());

    const outcome = await searchCredentials([productionWorkspace, developmentWorkspace], "prod", "plunk");

    expect(listSecrets).toHaveBeenCalledWith({
      projectId: productionWorkspace.id,
      environment: "prod",
      recursive: true,
      viewSecretValue: false,
      expandSecretReferences: false,
      includeImports: false,
    });
    expect(listSecrets).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      matches: [
        {
          project: productionWorkspace,
          environment: "prod",
          secret: { id: "PLUNK_API_KEY", secretKey: "PLUNK_API_KEY", secretPath: "/integrations" },
        },
      ],
      failedProjectCount: 0,
    });
  });

  it("runs up to twenty concurrent scans and keeps successful matches when a project fails", async () => {
    expect(MAX_CONCURRENT_PROJECT_SCANS).toBe(20);

    const projects = Array.from({ length: 21 }, (_, index) =>
      workspace(`project-${index + 1}`, [{ name: "Production", slug: "prod" }]),
    );
    const requests: Array<{
      resolve: (value: { secrets: Array<{ id: string; secretKey: string; secretPath?: string }> }) => void;
      reject: (error: Error) => void;
    }> = [];
    let active = 0;
    let maxActive = 0;

    listSecrets.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          requests.push({
            resolve: (value) => {
              active -= 1;
              resolve(value);
            },
            reject: (error) => {
              active -= 1;
              reject(error);
            },
          });
        }),
    );
    callInfisicalSdk.mockImplementation((operation) => operation());

    const outcome = searchCredentials(projects, "prod", "plunk");

    await vi.waitFor(() => expect(requests).toHaveLength(20));
    const initialRequests = requests.splice(0);
    initialRequests[0].reject(new Error("request failed"));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(active).toBe(20);

    initialRequests
      .slice(1)
      .forEach((request, index) => request.resolve({ secrets: index === 0 ? [sdkSecret("PLUNK_API_KEY")] : [] }));
    requests[0].resolve({ secrets: [] });

    await expect(outcome).resolves.toMatchObject({
      failedProjectCount: 1,
      matches: [
        expect.objectContaining({ secret: { id: "PLUNK_API_KEY", secretKey: "PLUNK_API_KEY", secretPath: "/" } }),
      ],
    });
    expect(maxActive).toBeLessThanOrEqual(20);
  });

  it("fetches one exact secret only after Copy Secret is invoked", async () => {
    const copiedValue = "copied-only-on-action";
    getSecret.mockResolvedValue({ secretValue: copiedValue });
    callInfisicalSdk.mockImplementation((operation) => operation());

    await expect(
      copyMatchedSecret({
        project: workspace("project-1", [{ name: "Production", slug: "prod" }]),
        environment: "prod",
        secret: { id: "secret-1", secretKey: "API_KEY", secretPath: "/aws" },
      }),
    ).resolves.toBe(copiedValue);

    expect(getSecret).toHaveBeenCalledWith({
      projectId: "project-1",
      environment: "prod",
      secretName: "API_KEY",
      secretPath: "/aws",
      viewSecretValue: true,
      expandSecretReferences: false,
      includeImports: false,
    });
  });
});
