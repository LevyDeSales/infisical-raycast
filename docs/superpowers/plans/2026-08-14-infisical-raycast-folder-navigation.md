# Infisical folder navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Let a Raycast user browse Infisical folders and operate secrets stored at the selected folder path.

**Architecture:** Keep folder-path normalization pure in a small utility and fetch a folder-scoped directory through a focused loader. Secrets receives the current absolute path, renders folders before secrets, and pushes itself for child folders. Existing secret mutations receive that path so they target the displayed folder.

**Tech Stack:** TypeScript, React, Raycast API, @raycast/utils, Infisical TypeScript SDK, Vitest.

## Global Constraints

- The root folder is exactly /; nested paths are absolute and use one slash between non-empty segments.
- Load only the current folder's immediate child folders and direct secrets; do not use recursive listing.
- Keep all Infisical SDK calls inside callInfisicalSdk.
- Do not expose or copy a secret value in any new folder-navigation code.
- Preserve the environment selector and secret-path copy format.
- Reuse Raycast native Back navigation by pushing a child Secrets screen.

---

### Task 1: Normalize and join folder paths

**Files:**

- Create: src/secret-folder-path.ts
- Create: src/secret-folder-path.test.ts

**Interfaces:**

- Produces: normalizeSecretFolderPath(path?: string): string
- Produces: joinSecretFolderPath(parentPath: string, folderName: string): string
- Consumed by: the directory loader and Secrets child-folder actions.

- [ ] **Step 1: Write the failing tests**

~~~ts
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
~~~

- [ ] **Step 2: Run the tests to verify they fail**

Run: npm test -- src/secret-folder-path.test.ts

Expected: FAIL because ./secret-folder-path does not exist.

- [ ] **Step 3: Implement the smallest pure helper**

~~~ts
export function normalizeSecretFolderPath(path?: string): string {
  const segments = (path ?? "").split("/").filter(Boolean);
  return segments.length ? "/" + segments.join("/") : "/";
}

export function joinSecretFolderPath(parentPath: string, folderName: string): string {
  return normalizeSecretFolderPath(parentPath + "/" + folderName);
}
~~~

- [ ] **Step 4: Run the focused test and lint**

Run: npm test -- src/secret-folder-path.test.ts && npm run lint

Expected: both commands exit 0.

- [ ] **Step 5: Commit the path utility**

Run: git add src/secret-folder-path.ts src/secret-folder-path.test.ts && git commit -m "feat: normalize secret folder paths"

### Task 2: Load a folder-scoped directory

**Files:**

- Create: src/secret-directory.ts
- Create: src/secret-directory.test.ts

**Interfaces:**

- Consumes: normalizeSecretFolderPath(path?: string): string from src/secret-folder-path.ts.
- Produces: loadSecretDirectory(projectId: string, environment: string, path: string): Promise<{ folders: Folder[]; secrets: Secret[] }>.
- Consumed by: Secrets through usePromise.

- [ ] **Step 1: Write a failing SDK-boundary test**

Mock ./infisical and ./authentication, then assert the loader requests only the selected path:

~~~ts
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
~~~

Set callInfisicalSdk to execute its callback and make the two mocked SDK methods resolve distinct folder and secret arrays.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm test -- src/secret-directory.test.ts

Expected: FAIL because ./secret-directory does not exist.

- [ ] **Step 3: Implement concurrent, sanitized loading**

~~~ts
export async function loadSecretDirectory(projectId: string, environment: string, path: string) {
  const normalizedPath = normalizeSecretFolderPath(path);
  const [folders, response] = await Promise.all([
    callInfisicalSdk(() => infisical.folders().listFolders({ projectId, environment, path: normalizedPath })),
    callInfisicalSdk(() =>
      infisical.secrets().listSecrets({ projectId, environment, secretPath: normalizedPath }),
    ),
  ]);

  return { folders, secrets: response.secrets };
}
~~~

- [ ] **Step 4: Run focused and complete tests**

Run: npm test -- src/secret-directory.test.ts && npm test

Expected: both commands exit 0 and all existing tests remain green.

- [ ] **Step 5: Commit the loader and its contract test**

Run: git add src/secret-directory.ts src/secret-directory.test.ts && git commit -m "feat: load Infisical folder directories"

### Task 3: Render and operate the selected folder

**Files:**

- Modify: src/secrets.tsx
- Modify: src/secret-path.ts only if types require accepting the normalized root path; do not change output semantics.

**Interfaces:**

- Consumes: loadSecretDirectory(projectId, environment, path) from src/secret-directory.ts.
- Consumes: joinSecretFolderPath(parentPath, folderName) and normalizeSecretFolderPath(path) from src/secret-folder-path.ts.
- Produces: Secrets({ project, secretPath? }), where omitted secretPath is /.

- [ ] **Step 1: Replace root-only loading with the directory loader**

Add an optional secretPath prop, normalize it once, and use it in the usePromise dependency list:

~~~tsx
export default function Secrets({ project, secretPath = "/" }: { project: Workspace; secretPath?: string }) {
  const currentPath = normalizeSecretFolderPath(secretPath);
  // usePromise(() => loadSecretDirectory(project.id, environment, currentPath), [environment, currentPath])
}
~~~

The hook returns directory = { folders: [], secrets: [] }. Keep a single error view for a failure of either request.

- [ ] **Step 2: Render immediate folders first**

Before mapping secrets, map directory.folders to List.Item rows with Icon.Folder and a default Action.Push:

~~~tsx
<Action.Push
  title="Open Folder"
  target={<Secrets project={project} secretPath={joinSecretFolderPath(currentPath, folder.name)} />}
/>
~~~

Folders precede secrets. Include the normalized current path in the navigation title, using Root as the root label. The empty view appears only when both arrays are empty and says which path is empty.

- [ ] **Step 3: Scope all secret operations to currentPath**

Thread currentPath through AddorEditSecret and confirmAndDelete. Add it to the existing SDK option objects:

~~~ts
deleteSecret(secret.secretKey, { projectId, environment, secretPath: currentPath });
createSecret(secretName, { projectId, environment, secretPath: currentPath, secretValue });
updateSecret(initialSecret.secretKey, {
  projectId,
  environment,
  secretPath: currentPath,
  newSecretName: secretName,
  secretValue,
});
~~~

Pass currentPath from every Add/Edit/Delete action, including empty-state Add Secret. Keep Copy Secret Path based on secret.secretPath, not currentPath, because the returned secret is authoritative.

- [ ] **Step 4: Run build-oriented verification**

Run: npm test && npm run lint && npm run build

Expected: exit 0; Raycast recognizes the child Secrets component and all SDK options type-check.

- [ ] **Step 5: Commit the Raycast navigation change**

Run: git add src/secrets.tsx src/secret-path.ts && git commit -m "feat: browse secrets by folder"

### Task 4: Document manual validation

**Files:**

- Modify: README.md in the local-development section.

**Interfaces:**

- Consumes: the final Secrets navigation behavior from Task 3.
- Produces: a concise manual test checklist for Raycast.

- [ ] **Step 1: Add the validation checklist**

Append these checks after the existing local-dev instructions:

~~~markdown
- Open a project that has secrets only in folders: its root lists folders instead of an empty state.
- Press Enter on a folder and confirm that its direct child folders and secrets are shown.
- Use Back to return to the parent folder, switch environments, and confirm the selected path remains visible.
- In a nested folder, copy, edit, delete, and add a secret; each action remains scoped to that folder.
~~~

- [ ] **Step 2: Verify documentation and the complete extension**

Run: git diff --check && npm test && npm run lint && npm run build

Expected: all commands exit 0.

- [ ] **Step 3: Commit documentation**

Run: git add README.md && git commit -m "docs: validate folder navigation"

## Final review gate

- [ ] Review the complete diff from 030986c through the final documentation commit against docs/superpowers/specs/2026-08-14-infisical-raycast-folder-navigation-design.md.
- [ ] Confirm no new code accesses secretValue except the pre-existing render, copy, save, and .env actions.
- [ ] Run git diff --check, npm test, npm run lint, and npm run build from a clean worktree.
- [ ] Start npm run dev and stop only for the human Raycast validation described in Task 4.
