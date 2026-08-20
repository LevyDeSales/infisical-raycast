import { authenticate, callInfisical } from "./infisical";
import type { Workspace } from "./types";

export async function listAccessibleWorkspaces(organizationId: string): Promise<Workspace[]> {
  await authenticate();
  const result = await callInfisical<{ workspaces: Workspace[] }>(`v2/organizations/${organizationId}/workspaces`);

  return result.workspaces;
}
