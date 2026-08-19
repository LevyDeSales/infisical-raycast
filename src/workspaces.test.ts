import { describe, expect, it, vi } from "vitest";

const { authenticate, callInfisical } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  callInfisical: vi.fn(),
}));

vi.mock("./infisical", () => ({ authenticate, callInfisical }));

import { listAccessibleWorkspaces } from "./workspaces";

describe("listAccessibleWorkspaces", () => {
  it("authenticates and returns workspaces from the selected organization", async () => {
    const workspaces = [
      {
        id: "project-1",
        name: "Platform",
        slug: "platform",
        organization: "organization-1",
        environments: [],
      },
    ];
    callInfisical.mockResolvedValue({ workspaces });

    await expect(listAccessibleWorkspaces("organization-1")).resolves.toEqual(workspaces);

    expect(authenticate).toHaveBeenCalledOnce();
    expect(callInfisical).toHaveBeenCalledWith("v2/organizations/organization-1/workspaces");
  });
});
