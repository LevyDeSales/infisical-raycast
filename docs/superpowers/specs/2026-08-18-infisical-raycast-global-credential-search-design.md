# Global credential search for Infisical secrets

## Goal

Add a dedicated Raycast command that finds secret **keys** across every Infisical project the authenticated access token can access. A user can type a query such as `plunk`, press Enter, and receive the matching secrets in the selected environment without exposing, reading, caching, or searching secret values.

The initial selected environment is `Production`. The user can change it before searching; the chosen environment applies globally to the search rather than per project.

## Chosen interaction

The extension adds a view command named `Search Credentials`.

1. The command opens a form with a required search field and an environment selector.
2. The selector defaults to the available environment named `Production` (case-insensitive), regardless of whether its Infisical slug is `prod` or `production`. If none is available, it defaults to the first available environment instead.
3. The selector contains the union of environments available to accessible projects. Changing it is the only way to search another environment.
4. Typing makes **no secret-list request**. Pressing Enter submits the form and starts a single search. There is no debounce and no automatic search while the query changes. Loading the accessible-project/environment selector when the command opens is separate from a secret scan.
5. The search results show only matches where the secret key contains the query, case-insensitively. Empty or whitespace-only queries cannot be submitted.

The result list displays the secret key as its title and the project name, selected environment, and folder path as metadata. It does not render a detail pane containing a value, nor does it offer value-based filtering.

## Result actions

- `Enter` opens the existing `Secrets` browser at the exact project, environment, and folder that contains the match.
- `Copy Secret Path` copies the value-free canonical path already used by the extension: `/<project>/<environment>/<optional-folder-path>/<key>`.
- `Copy Secret` is explicit and intentionally separate from search. Only when the user invokes this action does the extension request that one exact secret value and copy it to the clipboard. It uses the result's project ID, environment, folder path, and key to avoid retrieving a same-named secret from another folder.

No result action automatically reveals or copies a value.

## Data flow and API limits

The Infisical SDK has no server-side text filter for secret keys, so a submitted search scans the accessible projects client-side:

1. Authenticate through the current direct Access Token flow and list accessible workspaces.
2. Retain only projects that offer the selected environment. Projects without that environment are skipped rather than treated as failures.
3. List each eligible project's secrets recursively with this value-safe request contract:

   ```ts
   infisical.secrets().listSecrets({
     projectId,
     environment,
     recursive: true,
     viewSecretValue: false,
     expandSecretReferences: false,
     includeImports: false,
   });
   ```

4. Run at most twenty list requests at once. This rolling bounded fan-out starts the next eligible project only when a prior scan completes, avoiding an unbounded request burst while reducing total search latency.
5. Filter only `secretKey` in memory and produce metadata-only result records that retain the originating project, selected environment, folder path, and key.

There is deliberately no cross-search cache in the MVP. Each explicit submission observes the current state of the selected environment and keeps the first release simple; a later release can add a time-bounded metadata cache if measurements show that it is needed.

An individual project failure does not discard matches from other projects. The result screen retains successful matches and reports a count of projects that could not be scanned. Request errors continue through the extension's existing sanitized SDK error wrapper; no secret data is placed in error messages or logs.

## Security boundary

- Every search list request explicitly passes `viewSecretValue: false`, `expandSecretReferences: false`, and `includeImports: false`.
- Search matching uses only a key; neither `secretValue` nor an expanded reference can participate in result generation, ranking, UI rendering, error handling, test fixtures, or caching.
- The typed query remains local to the command session and is not persisted.
- The one-secret value fetch exists solely behind the user-invoked `Copy Secret` action and is not reused by subsequent search results.

## Result ordering and states

- Keys beginning with the query appear before keys that merely contain it; ties are ordered deterministically by project name, folder path, then key.
- While scanning, the command presents a clear loading state rather than partial key results that might look complete.
- If the search completes with no match, it reports that no accessible secret keys match the query in the selected environment.
- If no accessible project exposes any environment, the form reports that search is unavailable until the token can access a project.

## Non-goals

- Do not search secret values, comments, tags, project names, folder names, or imported/expanded secret content.
- Do not make this the default `Manage Projects` command; it remains an independent command with its own explicit search flow.
- Do not change authentication, token storage, folder navigation, environment behavior in the existing `Secrets` command, or existing project management actions.
- Do not add background polling, typing debounce, retries, unbounded parallel requests, or persistent indexing in this MVP.

## Tests and human acceptance

Automated coverage must establish:

- environment union/default selection and exclusion of projects that do not contain the selected environment;
- recursive scan payloads explicitly disable secret values and reference expansion;
- case-insensitive matching and ranking operate only on `secretKey`;
- the concurrency helper never exceeds twenty in-flight project requests and preserves successes when another project fails;
- result routing retains the exact project, environment, and folder path;
- `Copy Secret Path` remains value-free, while `Copy Secret` fetches exactly one secret only after its action is invoked.

Manual Raycast validation:

1. Open `Search Credentials`; `Production` is selected by default when available.
2. Type `plunk`, press Enter, and verify no secret-list request is sent before the submission.
3. Verify matches come from more than one accessible project when applicable and show project/path metadata, never values.
4. Change the environment, submit again, and verify only projects that expose it are scanned.
5. Press Enter on a result and verify it opens the matching project folder in `Secrets`.
6. Verify `Copy Secret Path` produces the full logical Infisical path and `Copy Secret` copies only after explicit invocation.
