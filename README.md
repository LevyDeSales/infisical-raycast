<p align="center">
    <img src="./assets/infisical.png" width="150" height="150" />
</p>

# Infisical

This is a Raycast extension for [Infisical](https://infisical.com/) - _Secrets management on autopilot._

## 🚀 Getting Started

1. **Install this local fork**: Clone or download this repository, open a terminal in the extension directory, and run:

    ```sh
    npm ci
    npm run dev
    ```

    `npm run dev` imports the local extension into Raycast. It remains installed after you stop the development process with `Ctrl-C`.

    **Manual validation checklist:**

    - [ ] Select a project and press `Enter` to open **Secrets**.
    - [ ] Select a project and press `Command-Enter` to open **Details**.
    - [ ] In **Secrets**, use **Copy Secret Path** and confirm the clipboard contains `/<project>/<environment>/<path>/<key>`.

2. **Prepare a Machine Identity**: This extension uses [Token Auth](https://infisical.com/docs/documentation/platform/identities/token-auth) through a dedicated [Machine Identity](https://infisical.com/docs/documentation/platform/identities/machine-identities):

    a. `Navigate` to [Project Members](https://app.infisical.com/organization/projects)

    b. `Click` [Access Control](https://app.infisical.com/organization/access-management?selectedTab=members) from the nav

    c. `Click` [Identities](https://app.infisical.com/organization/access-management?selectedTab=identities) tab

    d. `Click` "Create Identity"

    e. `Enter` a name, such as _Raycast_, select the least-privileged role that can read the required projects, then click `Create`

    f. Open the identity's **Token Auth** settings, create an access token, and copy it. Store it securely: Infisical only displays the token when it is created.

3. **Configure**:

    a. **Site URL** - unless you are self-hosting, there is no need to change this from the default of `https://app.infisical.com`

    b. **Organization ID** - `Navigate` to [Organization Settings](https://app.infisical.com/organization/settings), `Copy` ID

    c. **Access Token** - Paste the access token created for the dedicated Machine Identity

## ✨ What you can do

### Authenticate with a Machine Identity token

- Connect directly with an Infisical **Access Token**; there is no browser login, OAuth client ID/client secret, token refresh flow, or saved session.
- Configure the hosted Infisical URL or a self-hosted **Site URL**, your **Organization ID**, and the machine identity token in Raycast preferences.
- Keep the token in Raycast's password preference. The extension never writes it to source files or logs it.

### Browse projects quickly

| Where | Shortcut | Result |
| --- | --- | --- |
| Project list | `Enter` | Opens the project's **Secrets** view. |
| Project list | `Command-Enter` | Opens the project's **Details** view. |

### Navigate folders and environments

- The root of a project lists its immediate folders even when no secret exists at the root.
- Folders appear before the secrets stored at the current path. Press `Enter` to open a folder and use Raycast's Back action to return to its parent.
- The environment dropdown remains available at every level. Opening a folder preserves the environment you selected, including a non-default one.
- The extension loads only the current folder's direct secrets and immediate child folders; it does not recursively load the whole project.

### Work with secrets in the current folder

- Reveal or hide values, copy a secret value, and open the related project in Infisical.
- Create, edit, and delete secrets. Each mutation is scoped to the folder and environment currently open, avoiding collisions with a secret that has the same key elsewhere.
- Copy the logical Infisical path without copying its value:

  ```text
  /<project-slug>/<environment>/<optional-folder-path>/<secret-key>
  ```

  For example, a root secret is `/platform/production/API_KEY`; a nested secret is `/platform/production/aws/credentials/AWS_ACCESS_KEY_ID`.
- Copy or save the secrets currently visible in a folder as an `.env` file. Saved files go to **Downloads**; non-production environments append their environment name to the filename.

## 🛡️ Security and token lifecycle

- The extension does not log in or renew access tokens. Infisical enforces the token lifespan. If an operator rotates, revokes, or lets the token expire, replace the **Access Token** preference in Raycast.
- Grant the machine identity only the projects and environments it needs. The extension can perform the secret actions permitted by that token.
- Secret paths are safe identifiers, but secret values are sensitive. Use **Copy Secret Path** when you need to share a location without exposing the value.

## Local development and validation

Run the following commands from the extension directory to validate changes:

```sh
npm test
npm run lint
npm run build
```

- Open a project that has secrets only in folders: its root lists folders instead of an empty state.
- Press Enter on a folder and confirm that its direct child folders and secrets are shown.
- Select a non-default environment before entering a folder, then confirm the nested folder loads in that environment.
- Copy a nested secret path and confirm it includes the selected environment and nested folder path without the secret value.
- Use Back to return to the parent folder, switch environments, and confirm the selected path remains visible.
- In a nested folder, copy, edit, delete, and add a secret; each action remains scoped to that folder.

---

Looking for more cool OSS extensions? Try these:

<a title="Install appwrite Raycast Extension" href="https://www.raycast.com/xmok/appwrite"><img src="https://www.raycast.com/xmok/appwrite/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install coolify Raycast Extension" href="https://www.raycast.com/xmok/coolify"><img src="https://www.raycast.com/xmok/coolify/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install dokploy Raycast Extension" href="https://www.raycast.com/xmok/dokploy"><img src="https://www.raycast.com/xmok/dokploy/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install keygen Raycast Extension" href="https://www.raycast.com/xmok/keygen"><img src="https://www.raycast.com/xmok/keygen/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install umami Raycast Extension" href="https://www.raycast.com/xmok/umami"><img src="https://www.raycast.com/xmok/umami/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install vanguard-backup Raycast Extension" href="https://www.raycast.com/xmok/vanguard-backup"><img src="https://www.raycast.com/xmok/vanguard-backup/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
