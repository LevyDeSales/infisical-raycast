# Global Credential Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox markers for tracking.

**Goal:** Build a dedicated Raycast command that searches secret keys across all accessible Infisical projects in one selected environment, without reading values until the user explicitly chooses to copy one.

**Architecture:** Extract workspace retrieval so the current project browser and the new command share the authenticated access-token path. Keep global-search policy in a focused module: environment selection, metadata-only matching/ranking, bounded fan-out, and explicit one-secret retrieval. A form is the Enter-only submission boundary; a pushed results list reuses the existing folder-aware Secrets screen.

**Tech Stack:** TypeScript, React, Raycast API and utilities, Infisical SDK 4.0.6, Vitest, ESLint, Raycast build tools.

**Spec:** docs/superpowers/specs/2026-08-18-infisical-raycast-global-credential-search-design.md

## Global Constraints

- Add an independent Search Credentials view command; do not alter Manage Projects.
- Default to an accessible environment named Production case-insensitively, accepting either prod or production as its slug; otherwise use the first available environment.
- Never issue a secret-list request while typing. A required nonblank query is submitted only by the form Enter action; loading accessible projects for the form is separate. Do not add debounce, polling, or a persistent cache.
- Search only case-insensitive secretKey text. Never inspect, render, log, cache, rank, or add test-fixture values for secretValue.
- Every scan must use recursive: true, viewSecretValue: false, expandSecretReferences: false, and includeImports: false.
- Scan only projects that contain the selected environment, run no more than twenty project scans at once, and preserve successes if another project fails.
- Results retain project, environment, folder path, and key. Enter navigates there; Copy Secret Path is value-free; Copy Secret fetches exactly that one secret only after explicit user action.
- Preserve direct Access Token authentication, sanitized error handling, folder navigation, and existing tests.

---

## File structure

| File | Responsibility |
| --- | --- |
| src/workspaces.ts | Shared authenticated retrieval of accessible workspaces. |
| src/workspaces.test.ts | Workspace loader contract test. |
| src/credential-search.ts | Environment/match helpers, bounded value-safe scan, deferred one-secret fetch. |
| src/credential-search.test.ts | Core contracts: payloads, concurrency, matching, failures, and deferred fetch. |
| src/search-credentials.tsx | Form-first command and metadata-only results/actions. |
| src/search-credentials.test.tsx | Raycast component contracts for submit-only navigation and actions. |
| src/manage-projects.tsx | Reuse workspace loader with no behavior change. |
| package.json | Register the dedicated command. |
| README.md | Explain the feature and manual validation. |

### Task 1: Extract the workspace loader

**Files:**
- Create: src/workspaces.ts
- Create: src/workspaces.test.ts
- Modify: src/manage-projects.tsx:1-25

**Interfaces:**
- Consumes: authenticate(), callInfisical<T>() from src/infisical.ts; Workspace from src/types.ts.
- Produces: listAccessibleWorkspaces(organizationId: string): Promise<Workspace[]>.

- [ ] **Step 1: Write the failing contract test**

~~~ts
vi.mock("./infisical", () => ({ authenticate, callInfisical }));

it("authenticates and returns workspaces from the selected organization", async () => {
  const workspaces = [
    { id: "project-1", name: "Platform", slug: "platform", organization: "org-1", environments: [] },
  ];
  callInfisical.mockResolvedValue({ workspaces });

  await expect(listAccessibleWorkspaces("org-1")).resolves.toEqual(workspaces);

  expect(authenticate).toHaveBeenCalledOnce();
  expect(callInfisical).toHaveBeenCalledWith("v2/organizations/org-1/workspaces");
});
~~~

- [ ] **Step 2: Run it to verify it fails**

Run: npm test -- src/workspaces.test.ts

Expected: FAIL because src/workspaces.ts does not exist.

- [ ] **Step 3: Implement the minimal loader**

~~~ts
import { authenticate, callInfisical } from "./infisical";
import type { Workspace } from "./types";

export async function listAccessibleWorkspaces(organizationId: string): Promise<Workspace[]> {
  await authenticate();
  const result = await callInfisical<{ workspaces: Workspace[] }>(
    ["v2", "organizations", organizationId, "workspaces"].join("/"),
  );
  return result.workspaces;
}
~~~

In src/manage-projects.tsx replace only its inline useCachedPromise loader with () => listAccessibleWorkspaces(organizationId). Keep loading, errors, actions, and shortcuts unchanged.

- [ ] **Step 4: Verify the refactor**

Run: npm test -- src/workspaces.test.ts src/secrets.test.tsx && npm run lint

Expected: PASS; project browsing still compiles against the extracted loader.

- [ ] **Step 5: Commit**

~~~bash
git add src/workspaces.ts src/workspaces.test.ts src/manage-projects.tsx
git commit -m "refactor(workspaces): share authenticated project loader"
~~~

### Task 2: Implement the metadata-only search core with TDD

**Files:**
- Create: src/credential-search.ts
- Create: src/credential-search.test.ts

**Interfaces:**
- Consumes: Workspace, infisical.secrets().listSecrets(), infisical.secrets().getSecret(), callInfisicalSdk().
- Produces:

~~~ts
export type SearchEnvironment = { name: string; slug: string };
export type CredentialSearchMatch = {
  project: Workspace;
  environment: string;
  secret: { id: string; secretKey: string; secretPath?: string };
};
export type CredentialSearchOutcome = { matches: CredentialSearchMatch[]; failedProjectCount: number };

export const MAX_CONCURRENT_PROJECT_SCANS = 20;
export function getSearchEnvironments(workspaces: Workspace[]): SearchEnvironment[];
export function getDefaultSearchEnvironment(environments: SearchEnvironment[]): string | undefined;
export function rankCredentialMatches(matches: CredentialSearchMatch[], query: string): CredentialSearchMatch[];
export function searchCredentials(
  workspaces: Workspace[],
  environment: string,
  query: string,
): Promise<CredentialSearchOutcome>;
export function copyMatchedSecret(match: CredentialSearchMatch): Promise<string>;
~~~

- [ ] **Step 1: Write failing environment and key-only ranking tests**

~~~ts
it("prefers the Production display name even when its slug is prod", () => {
  const environments = getSearchEnvironments([
    workspace("one", [{ name: "Development", slug: "dev" }, { name: "Production", slug: "prod" }]),
  ]);

  expect(getDefaultSearchEnvironment(environments)).toBe("prod");
});

it("matches and ranks only secret keys without retaining a value", () => {
  const results = rankCredentialMatches(
    [match("PLUNK_API_KEY"), match("MY_PLUNK_TOKEN"), match("OTHER_KEY")],
    "plunk",
  );

  expect(results.map((result) => result.secret.secretKey)).toEqual(["PLUNK_API_KEY", "MY_PLUNK_TOKEN"]);
  expect(Object.hasOwn(results[0].secret, "secretValue")).toBe(false);
});
~~~

The match helper must create only id, secretKey, and secretPath. Do not introduce a secretValue property into any scan fixture.

- [ ] **Step 2: Run the new unit test to verify red**

Run: npm test -- src/credential-search.test.ts

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement deterministic environment and ranking helpers**

Implement a trim/lowercase normalizer. getSearchEnvironments deduplicates by slug, preserves the first display name, and sorts display names case-insensitively. getDefaultSearchEnvironment returns the slug whose normalized name is production, otherwise the first sorted slug.

rankCredentialMatches filters only normalized match.secret.secretKey. Sort prefix matches first, then deterministic project.name, secret.secretPath (or /), and secret.secretKey ordering. It receives and returns CredentialSearchMatch records, whose secret shape cannot hold a value.

- [ ] **Step 4: Write failing scan, limit, isolation, and deferred-copy tests**

~~~ts
it("scans eligible projects with recursive value-safe options", async () => {
  listSecrets.mockResolvedValue({ secrets: [sdkSecret({ secretKey: "PLUNK_API_KEY", secretPath: "/integrations" })] });

  await searchCredentials([productionWorkspace], "prod", "plunk");

  expect(listSecrets).toHaveBeenCalledWith({
    projectId: productionWorkspace.id,
    environment: "prod",
    recursive: true,
    viewSecretValue: false,
    expandSecretReferences: false,
    includeImports: false,
  });
});

it("fetches one exact secret only after Copy Secret is invoked", async () => {
  getSecret.mockResolvedValue({ secretValue: copiedValue });

  await expect(copyMatchedSecret(matchAt("project-1", "prod", "/aws", "API_KEY"))).resolves.toBe(copiedValue);

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
~~~

Use a deferred listSecrets mock across twenty-one eligible workspaces. Count active calls before resolving each deferred promise and assert maxActive is less than or equal to MAX_CONCURRENT_PROJECT_SCANS. Reject one request, resolve another with a matching key, and assert failedProjectCount is 1 while the successful match remains.

Keep copiedValue a neutral marker and assert the scan outcome never has a secretValue property.

- [ ] **Step 5: Run it to verify red**

Run: npm test -- src/credential-search.test.ts

Expected: FAIL because searchCredentials and copyMatchedSecret are not implemented.

- [ ] **Step 6: Implement bounded scanning and exact-value retrieval**

Filter workspaces by environment availability before scheduling them. Create a private worker pool that consumes an index into the filtered list and starts at most MAX_CONCURRENT_PROJECT_SCANS workers; do not call Promise.all over all projects.

Each worker must call callInfisicalSdk around:

~~~ts
infisical.secrets().listSecrets({
  projectId: project.id,
  environment,
  recursive: true,
  viewSecretValue: false,
  expandSecretReferences: false,
  includeImports: false,
});
~~~

Map each returned SDK secret immediately to:

~~~ts
{
  project,
  environment,
  secret: {
    id: secret.id,
    secretKey: secret.secretKey,
    secretPath: secret.secretPath,
  },
}
~~~

Record only the failure count for rejected projects. Pass the aggregated metadata matches through rankCredentialMatches.

copyMatchedSecret must wrap getSecret in callInfisicalSdk, use exactly match.project.id, match.environment, match.secret.secretKey, and match.secret.secretPath, and return response.secretValue. No other caller may receive a scan value.

- [ ] **Step 7: Verify the core**

Run: npm test -- src/credential-search.test.ts && npm run build

Expected: PASS; the build confirms the SDK option names and types.

- [ ] **Step 8: Commit**

~~~bash
git add src/credential-search.ts src/credential-search.test.ts
git commit -m "feat(search): add safe bounded credential scanner"
~~~

### Task 3: Build the explicit-submit command and safe result view

**Files:**
- Create: src/search-credentials.tsx
- Create: src/search-credentials.test.tsx

**Interfaces:**
- Consumes: listAccessibleWorkspaces(), all search-core exports, buildSecretPath(), and Secrets.
- Produces: default SearchCredentials command component.

- [ ] **Step 1: Write failing component tests**

Use the shallow React-element style already established in src/secrets.test.tsx and mock Raycast primitives. Assert:

1. Rendering the loaded form does not call searchCredentials.
2. The Action.SubmitForm callback trims query and pushes the results component only after submission.
3. A result item title is match.secret.secretKey and has project, path, and environment metadata.
4. The default Action.Push target is:

~~~ts
<Secrets project={matchedProject} environment="prod" secretPath="/integrations" />
~~~

5. No List.Item.Detail or Action.CopyToClipboard receives a secret value. Copy Secret Path receives buildSecretPath output only.

- [ ] **Step 2: Run the component test to verify red**

Run: npm test -- src/search-credentials.test.tsx

Expected: FAIL because the command does not exist.

- [ ] **Step 3: Implement form-first search**

At the command root obtain workspaces with useCachedPromise(() => listAccessibleWorkspaces(organizationId), []). Render a loading form or loading view until workspace data exists; then render a child form component so useForm receives a stable environment default.

Use getSearchEnvironments and getDefaultSearchEnvironment. If there are no environments, show a safe unavailable Detail. For loader errors, use the existing preferences-opening Detail pattern.

Use this form and a trim-only validation function:

~~~tsx
<Form
  actions={
    <ActionPanel>
      <Action.SubmitForm title="Search Credentials" onSubmit={handleSubmit} />
    </ActionPanel>
  }
>
  <Form.TextField title="Search Secret Keys" placeholder="plunk" {...itemProps.query} />
  <Form.Dropdown title="Environment" {...itemProps.environment}>
    {environments.map((environment) => (
      <Form.Dropdown.Item key={environment.slug} title={environment.name} value={environment.slug} />
    ))}
  </Form.Dropdown>
</Form>
~~~

Use useNavigation().push in onSubmit. No onChange, useEffect, or render path may call searchCredentials.

- [ ] **Step 4: Implement results and actions**

The pushed results component calls usePromise(() => searchCredentials(workspaces, environment, query), [workspaces, environment, query]). It shows a loading list until completion and an empty state that mentions the selected environment and non-sensitive failed-project count when relevant.

For every result, use a List.Item with key title, project and path subtitle/accessories, and no detail pane. Its first action is Action.Push to the exact existing Secrets path. Add Action.CopyToClipboard for buildSecretPath(match.project.slug, match.environment, match.secret.secretPath, match.secret.secretKey).

For explicit Copy Secret, create a non-shortcut Action that calls copyMatchedSecret(match), then Clipboard.copy(value), and displays a success or sanitized failure toast. Do not put the returned value in React state, props, list data, logs, or cache.

- [ ] **Step 5: Verify focused behavior**

Run: npm test -- src/search-credentials.test.tsx src/credential-search.test.ts src/secrets.test.tsx

Expected: PASS; Enter-only search, exact routing, and existing folder behavior are preserved.

- [ ] **Step 6: Commit**

~~~bash
git add src/search-credentials.tsx src/search-credentials.test.tsx
git commit -m "feat(search): add explicit global credential search command"
~~~

### Task 4: Register, document, and fully verify

**Files:**
- Create: src/command-manifest.test.ts
- Modify: package.json:37-45
- Modify: README.md:49-88

**Interfaces:**
- Consumes: the default export from src/search-credentials.tsx and the Raycast manifest schema.
- Produces: an invokable Search Credentials command and self-service validation guidance.

- [ ] **Step 1: Write the failing manifest test**

~~~ts
import manifest from "../package.json";

it("registers the global credential search view command", () => {
  expect(manifest.commands).toContainEqual(
    expect.objectContaining({
      name: "search-credentials",
      title: "Search Credentials",
      mode: "view",
    }),
  );
});
~~~

- [ ] **Step 2: Run it to verify red**

Run: npm test -- src/command-manifest.test.ts

Expected: FAIL because the command is not registered.

- [ ] **Step 3: Register and document the feature**

Append this separate command object without changing manage-projects:

~~~json
{
  "name": "search-credentials",
  "title": "Search Credentials",
  "subtitle": "Infisical",
  "description": "Find secret keys across accessible projects",
  "mode": "view"
}
~~~

Add a README section named Search credentials across projects. State that Production is preselected when available; pressing Enter starts the only scan; matching is key-only in one selected environment; result metadata identifies project and path; Copy Secret Path never retrieves a value; Copy Secret retrieves one exact value only after explicit action. Add these manual validation checks:

1. Search Credentials preselects Production and makes no secret-list request while typing.
2. Submitting plunk shows matching keys from eligible projects without values.
3. Changing environment excludes projects that lack it.
4. Enter opens the exact folder; path copy is canonical; value copy occurs only after explicit action.

- [ ] **Step 4: Run complete automated verification**

Run:

~~~bash
npm test
npm run lint
npm run build
git diff --check
git status --short
~~~

Expected: tests, lint, and build pass; diff check is silent; status contains only intended manifest, README, and manifest-test files before commit.

- [ ] **Step 5: Build the local Raycast extension for human validation**

Run: npm run dev

Expected: Raycast successfully imports the updated local extension. Do not claim feature completion until the user validates the command interactively.

- [ ] **Step 6: Commit**

~~~bash
git add package.json README.md src/command-manifest.test.ts
git commit -m "docs(search): document global credential search workflow"
~~~

## Plan self-review

**Spec coverage:** Task 1 retains the direct Access Token workspace boundary. Task 2 covers Production defaulting, value-safe recursive requests, twenty-way rolling concurrency, key-only matching/ranking, partial failures, metadata retention, and deferred one-value retrieval. Task 3 supplies the Enter-only form, global environment selector, exact navigation, safe path copy, and explicit value-copy UI. Task 4 registers the distinct command, documents user-visible safety behavior, and completes automated and Raycast validation.

**Placeholder scan:** The red-flag scan returned no implementation placeholders or vague test/error-handling instructions. Every code task supplies concrete interfaces, test expectations, and commands.

**Type consistency:** Workspace, SearchEnvironment, CredentialSearchMatch, CredentialSearchOutcome, searchCredentials, and copyMatchedSecret have one consistent shape throughout. The Infisical SDK public client uses projectId and secretName, which the plan preserves.
