import { type Folder, type Secret } from "@infisical/sdk";
import { callInfisicalSdk } from "./authentication";
import { infisical } from "./infisical";
import { normalizeSecretFolderPath } from "./secret-folder-path";

export async function loadSecretDirectory(
  projectId: string,
  environment: string,
  path: string,
): Promise<{ folders: Folder[]; secrets: Secret[] }> {
  const normalizedPath = normalizeSecretFolderPath(path);
  const [folders, response] = await Promise.all([
    callInfisicalSdk(() => infisical.folders().listFolders({ projectId, environment, path: normalizedPath })),
    callInfisicalSdk(() => infisical.secrets().listSecrets({ projectId, environment, secretPath: normalizedPath })),
  ]);

  return { folders, secrets: response.secrets };
}
