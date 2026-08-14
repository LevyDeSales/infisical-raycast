import { describe, expect, it, vi } from "vitest";

const { listFolders, listSecrets, callInfisicalSdk } = vi.hoisted(() => ({
  listFolders: vi.fn(),
  listSecrets: vi.fn(),
  callInfisicalSdk: vi.fn(),
}));

vi.mock("./infisical", () => ({
  infisical: {
    folders: () => ({ listFolders }),
    secrets: () => ({ listSecrets }),
  },
}));

vi.mock("./authentication", () => ({ callInfisicalSdk }));

import { infisical } from "./infisical";
import { loadSecretDirectory } from "./secret-directory";

describe("loadSecretDirectory", () => {
  it("loads folders and secrets at the normalized selected path", async () => {
    const folders = [
      {
        id: "folder-1",
        name: "credentials",
        envId: "environment-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const secrets = [
      {
        id: "secret-1",
        workspaceId: "project-1",
        environment: "prod",
        secretKey: "AWS_ACCESS_KEY_ID",
        secretValue: "",
        secretValueHidden: false,
        isRotatedSecret: false,
        type: "shared",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
        tags: [],
      },
    ];
    listFolders.mockResolvedValue(folders);
    listSecrets.mockResolvedValue({ secrets });
    callInfisicalSdk.mockImplementation((operation) => operation());

    const result = await loadSecretDirectory("project-1", "prod", "//aws//");

    expect(infisical.folders().listFolders).toHaveBeenCalledWith({
      projectId: "project-1",
      environment: "prod",
      path: "/aws",
    });
    expect(infisical.secrets().listSecrets).toHaveBeenCalledWith({
      projectId: "project-1",
      environment: "prod",
      secretPath: "/aws",
    });
    expect(result).toEqual({ folders, secrets });
  });
});
