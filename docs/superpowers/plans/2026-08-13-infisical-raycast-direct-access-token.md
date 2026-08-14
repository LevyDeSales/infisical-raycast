# Infisical Raycast Direct Access Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Raycast extension fork that uses only a configured Infisical Machine Identity Access Token, with no Client ID/Secret, login, cache, or renewal.

**Architecture:** A required password preference holds the direct token. The SDK and REST helper send it as `Authorization: Bearer` on every request. The first workspace request validates the configured token; HTTP 401 and 403 become safe, actionable messages.

**Tech Stack:** TypeScript, Raycast API, React, `@infisical/sdk`, ESLint, Prettier.

## Global Constraints

- Support only direct Machine Identity Token Auth access tokens.
- Remove `clientId`, `clientSecret`, `disableTokenVerification`, `universalAuth`, token renewal, and persisted token cache.
- Preserve `siteUrl`, `organizationId`, project listing, and secret commands.
- Never persist, log, or display a token, authorization header, or secret response.
- Human validation means a Raycast-installable build with documented setup.
- The README is the user-facing setup documentation; `docs/` contains internal historical design and planning records and may mention superseded approaches.

---

### Task 1: Import an isolated upstream baseline

**Files:** create `package.json`, `src/`, `assets/`, config files, and `README.md` from the upstream `extensions/infisical` directory; preserve `docs/`.

- [ ] Sparse-clone the Raycast extensions repository to a temporary directory.
- [ ] Copy only `extensions/infisical` to this workspace; do not overwrite `docs/`.
- [ ] Initialize the fork repository, install exact lockfile dependencies with `npm ci`, and verify the upstream build.
- [ ] Commit the imported baseline.

### Task 2: Replace the credential preferences and configure the test runner

**Files:** modify `package.json` and `package-lock.json`.

- [ ] Delete the `Client ID`, `Client Secret`, and `Disable Token Verification` preferences.
- [ ] Add a required `Access Token` preference with `name: "accessToken"` and `type: "password"`.
- [ ] Add Vitest as a development dependency and a `test` script that runs `vitest run` so the direct-token behavior can be tested outside Raycast.
- [ ] Run `npm run lint`; record that Vitest has no tests until Task 3 adds the direct-token suite, then commit the preference contract.

### Task 3: Implement direct bearer authentication

**Files:** create `src/authentication.ts` and `src/authentication.test.ts`; modify `src/infisical.ts` and `src/manage-projects.tsx`.

- [ ] Write failing tests for a new testable API factory: it must configure the provided client with the direct token, return JSON for a successful response, send `Authorization: Bearer <token>`, and map 401/403 to the specified sanitized errors without exposing the server body.
- [ ] Run the focused test and confirm that it fails because `src/authentication.ts` does not yet exist.
- [ ] Implement `createInfisicalApi(client, siteUrl, fetchImplementation)` in `src/authentication.ts`, and make `src/infisical.ts` obtain `accessToken` from preferences and use this factory.
- [ ] Delete LocalStorage, toasts, Universal Auth login/renewal, token cache, and verification-disable behavior.
- [ ] Map HTTP 401 to `Access Token invalid, expired, or revoked.` and HTTP 403 to `Machine Identity does not have permission for this resource.` without using server error bodies.
- [ ] Keep the existing preference-opening recovery action and run focused tests plus lint.
- [ ] Commit the authentication replacement.

### Task 4: Produce an installable test build

**Files:** modify `README.md`.

- [ ] Replace Universal Auth setup with Token Auth Machine Identity setup and the three required preferences.
- [ ] State that the extension never renews tokens; if the server expires, revokes, or rotates one, the operator replaces it in Raycast preferences.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Search for forbidden legacy credential flow references in source, manifest, and README.
- [ ] Commit the final fork.
- [ ] Hand off the generated build and exact Raycast installation/test instructions for human validation.
