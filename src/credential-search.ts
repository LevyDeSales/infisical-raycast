import { callInfisicalSdk } from "./authentication";
import { infisical } from "./infisical";
import type { Workspace } from "./types";

export const MAX_CONCURRENT_PROJECT_SCANS = 5;

export type SearchEnvironment = { name: string; slug: string };

export type CredentialSearchMatch = {
  project: Workspace;
  environment: string;
  secret: {
    id: string;
    secretKey: string;
    secretPath?: string;
  };
};

export type CredentialSearchOutcome = {
  matches: CredentialSearchMatch[];
  failedProjectCount: number;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function getSearchEnvironments(workspaces: Workspace[]): SearchEnvironment[] {
  const environments = new Map<string, SearchEnvironment>();

  for (const workspace of workspaces) {
    for (const environment of workspace.environments) {
      if (!environments.has(environment.slug)) environments.set(environment.slug, environment);
    }
  }

  return [...environments.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function getDefaultSearchEnvironment(environments: SearchEnvironment[]): string | undefined {
  return (
    environments.find((environment) => normalize(environment.name) === "production")?.slug ?? environments[0]?.slug
  );
}

export function rankCredentialMatches(matches: CredentialSearchMatch[], query: string): CredentialSearchMatch[] {
  const normalizedQuery = normalize(query);

  return matches
    .filter((match) => normalize(match.secret.secretKey).includes(normalizedQuery))
    .sort((left, right) => {
      const leftStartsWithQuery = normalize(left.secret.secretKey).startsWith(normalizedQuery);
      const rightStartsWithQuery = normalize(right.secret.secretKey).startsWith(normalizedQuery);

      if (leftStartsWithQuery !== rightStartsWithQuery) return leftStartsWithQuery ? -1 : 1;

      return [left.project.name, left.secret.secretPath ?? "/", left.secret.secretKey]
        .join("\u0000")
        .localeCompare([right.project.name, right.secret.secretPath ?? "/", right.secret.secretKey].join("\u0000"));
    });
}

export async function searchCredentials(
  workspaces: Workspace[],
  environment: string,
  query: string,
): Promise<CredentialSearchOutcome> {
  const eligibleWorkspaces = workspaces.filter((workspace) =>
    workspace.environments.some((candidate) => candidate.slug === environment),
  );
  const matches: CredentialSearchMatch[] = [];
  let failedProjectCount = 0;
  let nextWorkspaceIndex = 0;

  async function scanNextWorkspace(): Promise<void> {
    const workspace = eligibleWorkspaces[nextWorkspaceIndex++];
    if (!workspace) return;

    try {
      const response = await callInfisicalSdk(() =>
        infisical.secrets().listSecrets({
          projectId: workspace.id,
          environment,
          recursive: true,
          viewSecretValue: false,
          expandSecretReferences: false,
          includeImports: false,
        }),
      );

      matches.push(
        ...response.secrets.map((secret) => ({
          project: workspace,
          environment,
          secret: {
            id: secret.id,
            secretKey: secret.secretKey,
            secretPath: secret.secretPath,
          },
        })),
      );
    } catch {
      failedProjectCount += 1;
    }

    await scanNextWorkspace();
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_PROJECT_SCANS, eligibleWorkspaces.length) }, () =>
      scanNextWorkspace(),
    ),
  );

  return { matches: rankCredentialMatches(matches, query), failedProjectCount };
}

export async function copyMatchedSecret(match: CredentialSearchMatch): Promise<string> {
  const secret = await callInfisicalSdk(() =>
    infisical.secrets().getSecret({
      projectId: match.project.id,
      environment: match.environment,
      secretName: match.secret.secretKey,
      secretPath: match.secret.secretPath,
      viewSecretValue: true,
      expandSecretReferences: false,
      includeImports: false,
    }),
  );

  return secret.secretValue;
}
