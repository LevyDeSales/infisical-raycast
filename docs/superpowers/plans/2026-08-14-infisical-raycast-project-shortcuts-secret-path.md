# Infisical Raycast Project Shortcuts and Secret Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Enter open project secrets, Command+Enter open project details, and add a secure action that copies each secret's complete logical Infisical path.

**Architecture:** The first project Action.Push remains Raycast's default Enter action and the second becomes Command+Enter. A pure path builder normalizes a secret path without secret values; the secrets list uses it for one clipboard action.

**Tech Stack:** TypeScript, React, Raycast API, Vitest, `@infisical/sdk`, ESLint, Prettier.

## Global Constraints

- Enter opens Secrets; Command + Enter opens Details.
- Copy Secret Path emits `/<project-slug>/<environment-slug>/<secret-path>/<secret-key>`.
- Root secrets omit empty path segments; nested paths have exactly one slash between every segment.
- Never copy a secret value, access token, or API response body.
- Do not add API calls, alter authentication, or change successful secret-management operations.
- Human validation means local Raycast development mode and manual verification of both shortcuts and clipboard output.

---

### Task 1: Create and test the complete logical secret-path builder

**Files:**
- Create: `src/secret-path.ts`
- Create: `src/secret-path.test.ts`

**Interfaces:**
- Produces: `buildSecretPath(projectSlug: string, environment: string, secretPath: string | undefined, secretKey: string): string`.

- [ ] Write failing Vitest cases that expect `buildSecretPath("alltius-secret-intake", "production", undefined, "API_KEY")` to equal `/alltius-secret-intake/production/API_KEY`, and expect `buildSecretPath("alltius-secret-intake", "production", "/aws//credentials/", "AWS_ACCESS_KEY_ID")` to equal `/alltius-secret-intake/production/aws/credentials/AWS_ACCESS_KEY_ID`.
- [ ] Run `npm test -- src/secret-path.test.ts`; expect failure because `src/secret-path.ts` does not exist.
- [ ] Implement `buildSecretPath` by splitting `secretPath ?? ""` on `/`, removing empty segments, and joining `projectSlug`, `environment`, normalized nested segments, and `secretKey` with one leading slash.
- [ ] Run `npm test -- src/secret-path.test.ts`; expect both test cases to pass.
- [ ] Commit `src/secret-path.ts` and `src/secret-path.test.ts` as `feat: build complete Infisical secret paths`.

### Task 2: Apply project shortcuts and add Copy Secret Path

**Files:**
- Modify: `src/manage-projects.tsx`
- Modify: `src/secrets.tsx`

**Interfaces:**
- Consumes: `buildSecretPath`, `Workspace.slug`, selected environment slug, `Secret.secretPath`, and `Secret.secretKey`.
- Produces: default project navigation to `Secrets`, secondary navigation to `ProjectDetails`, and a clipboard action with a full logical secret path.

- [ ] Make `Action.Push` for `Secrets` the first primary action in each project ActionPanel and `Action.Push` for `Details` the second; Raycast assigns Enter and Command+Enter based on that order.
- [ ] Import `buildSecretPath` into `src/secrets.tsx`.
- [ ] Add `Action.CopyToClipboard` titled `Copy Secret Path` before `Copy Secret`, with content from `buildSecretPath(project.slug, environment, secret.secretPath, secret.secretKey)`.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expect all to pass.
- [ ] Commit the two changed files as `feat: improve project navigation and copy secret paths`.

### Task 3: Prepare the local Raycast human-validation build

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: manual validation steps for project shortcuts and Copy Secret Path.

- [ ] Add a checklist after `npm run dev`: selecting a project plus Enter opens Secrets; selecting it plus Command+Enter opens Details; Copy Secret Path yields `/<project>/<environment>/<path>/<key>` in the clipboard.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`; expect all to pass.
- [ ] Commit README as `docs: validate project shortcuts and secret paths`.
- [ ] Run `npm run dev`; expect Raycast to import the local extension and leave development mode active for human validation.
