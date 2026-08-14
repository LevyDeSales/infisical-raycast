# Folder navigation for Infisical secrets

## Goal

Expose secrets stored in Infisical folders from the Raycast extension. A project whose root has no secrets must still expose its child folders, such as the empty project shown in the user validation screenshot.

## Chosen interaction

`Secrets` becomes a path-scoped browser. The root path is `/`.

- Each screen loads the immediate child folders for the selected project, environment, and path, followed by the secrets stored at that same path.
- Folders use a folder icon and the default `Enter` action pushes another `Secrets` screen for that folder. Raycast's native Back action returns to the parent path.
- The navigation title and empty state identify the current path. The existing environment dropdown remains available on every level.
- Changing the environment preserves the path. If that path has no content in the selected environment, the view reports that the folder is empty.
- The root uses `/`; child paths are normalized to a single slash-delimited absolute path, for example `/aws/credentials`.

## Data flow

For every `(project, environment, path)` tuple, fetch concurrently:

1. `infisical.folders().listFolders({ projectId, environment, path })` for immediate child folders.
2. `infisical.secrets().listSecrets({ projectId, environment, secretPath: path })` for secrets in exactly that folder.

Both calls go through the existing error-sanitizing SDK wrapper. The feature does not use recursive listing, add any authentication flow, or send a secret value outside the existing rendering and copy actions.

## Folder-aware secret operations

The current path is passed to create, edit, and delete calls as `secretPath`. This keeps actions scoped to the selected folder and ensures that an identically named root secret cannot be changed accidentally. `Copy Secret Path` continues to use the secret's returned `secretPath` and remains value-free.

## Error and empty states

- A failure in either folders or secrets request shows the existing error state and allows opening extension preferences.
- A folder with neither children nor secrets shows a folder-specific empty state and can add a secret in that folder.
- A root with folders but no root secrets renders the folders rather than the previous misleading empty view.

## Tests and acceptance checks

- Unit-test path normalization/joining for root and nested folders.
- Unit-test the request options that scope folders and secrets to the selected path.
- Preserve the existing secret-path tests and authentication tests.
- Manually validate: root displays folders, Enter opens a nested folder, Back returns, a nested secret can be copied/edited/deleted, and Add Secret targets the current folder.
