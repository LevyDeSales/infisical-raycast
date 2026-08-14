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

## 🗒️ Notes

- The extension does not log in or renew access tokens. Infisical enforces the token lifespan. If an operator rotates, revokes, or lets the token expire, replace the **Access Token** preference in Raycast.
- You can `copy` or `save` all secrets of an **environment** in _.env_ format (`change` the environment using the `dropdown`). The file is `saved` in the "Downloads" folder (if the environment is not "production", the environment is appended to the extension e.g. `.env.dev`)

## Local development and validation

Run the following commands from the extension directory to validate changes:

```sh
npm test
npm run lint
npm run build
```

---

Looking for more cool OSS extensions? Try these:

<a title="Install appwrite Raycast Extension" href="https://www.raycast.com/xmok/appwrite"><img src="https://www.raycast.com/xmok/appwrite/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install coolify Raycast Extension" href="https://www.raycast.com/xmok/coolify"><img src="https://www.raycast.com/xmok/coolify/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install dokploy Raycast Extension" href="https://www.raycast.com/xmok/dokploy"><img src="https://www.raycast.com/xmok/dokploy/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install keygen Raycast Extension" href="https://www.raycast.com/xmok/keygen"><img src="https://www.raycast.com/xmok/keygen/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install umami Raycast Extension" href="https://www.raycast.com/xmok/umami"><img src="https://www.raycast.com/xmok/umami/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
<a title="Install vanguard-backup Raycast Extension" href="https://www.raycast.com/xmok/vanguard-backup"><img src="https://www.raycast.com/xmok/vanguard-backup/install_button@2x.png?v=1.1" height="64" alt="" style="height: 64px;"></a>
