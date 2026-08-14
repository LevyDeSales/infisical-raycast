import { describe, expect, it, vi } from "vitest";
import { callInfisicalSdk, createInfisicalApi } from "./authentication";

const createFakeClient = () => {
  let token: string | undefined;

  return {
    client: {
      auth: () => ({
        accessToken: (accessToken: string) => {
          token = accessToken;
        },
        getAccessToken: () => token,
      }),
    },
    getStoredToken: () => token,
  };
};

describe("createInfisicalApi", () => {
  it("configures the client with the supplied access token", async () => {
    const { client, getStoredToken } = createFakeClient();
    const api = createInfisicalApi(client, "https://app.infisical.com", vi.fn());

    await api.authenticate("machine-identity-token");

    expect(getStoredToken()).toBe("machine-identity-token");
  });

  it("returns successful JSON and sends the configured bearer token", async () => {
    const { client } = createFakeClient();
    const fetchImplementation = vi.fn(
      async () =>
        new Response(JSON.stringify({ workspaces: [{ id: "workspace-1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const api = createInfisicalApi(client, "https://app.infisical.com", fetchImplementation);
    await api.authenticate("machine-identity-token");

    const result = await api.callInfisical<{ workspaces: Array<{ id: string }> }>(
      "v2/organizations/organization-1/workspaces",
    );

    expect(result).toEqual({ workspaces: [{ id: "workspace-1" }] });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, options] = fetchImplementation.mock.calls[0];
    expect(url.toString()).toBe("https://app.infisical.com/api/v2/organizations/organization-1/workspaces");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer machine-identity-token");
  });

  it.each([
    [401, "Access Token invalid, expired, or revoked."],
    [403, "Machine Identity does not have permission for this resource."],
  ])("maps a %i response to a sanitized error", async (status, expectedMessage) => {
    const { client } = createFakeClient();
    const serverBody = "sensitive server response body";
    const fetchImplementation = vi.fn(async () => new Response(serverBody, { status }));
    const api = createInfisicalApi(client, "https://app.infisical.com", fetchImplementation);
    await api.authenticate("machine-identity-token");

    const error = await api.callInfisical("v2/workspace/workspace-1").catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(expectedMessage);
    expect((error as Error).message).not.toContain(serverBody);
  });

  it("reports a non-auth failure by status without exposing the response body", async () => {
    const { client } = createFakeClient();
    const serverBody = "internal implementation detail";
    const fetchImplementation = vi.fn(async () => new Response(serverBody, { status: 500 }));
    const api = createInfisicalApi(client, "https://app.infisical.com", fetchImplementation);
    await api.authenticate("machine-identity-token");

    const request = api.callInfisical("v2/workspace/workspace-1");

    await expect(request).rejects.toThrow("Infisical request failed with status 500.");
    await expect(request).rejects.not.toThrow(serverBody);
  });
});

describe("callInfisicalSdk", () => {
  it("returns the SDK operation result unchanged", async () => {
    const secret = { id: "secret-1", secretKey: "API_KEY" };

    await expect(callInfisicalSdk(async () => secret)).resolves.toBe(secret);
  });

  it.each([
    [
      401,
      "Access Token invalid, expired, or revoked.",
      '{"message":"raw invalid-token server content","requestId":"private-request-id"}',
    ],
    [
      403,
      "Machine Identity does not have permission for this resource.",
      '{"message":"raw permission server content","projectId":"private-project-id"}',
    ],
  ])("maps an SDK-style %i failure to the exact sanitized message", async (status, expectedMessage, serverBody) => {
    const sdkError = new Error(
      `[URL=https://app.infisical.com/api/v3/secrets/raw/API_KEY] [Method=GET] [StatusCode=${status}] ${serverBody}`,
    );
    sdkError.name = "InfisicalSDKRequestError";

    const error = await callInfisicalSdk(async () => {
      throw sdkError;
    }).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(expectedMessage);
    expect((error as Error).message).not.toContain(serverBody);
  });

  it("replaces any other SDK error with a generic message", async () => {
    const rawError = new Error(
      '[URL=https://app.infisical.com/api/v3/secrets/raw/API_KEY] [Method=POST] [StatusCode=500] {"message":"database details"}',
    );
    rawError.name = "InfisicalSDKRequestError";

    const error = await callInfisicalSdk(async () => {
      throw rawError;
    }).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Infisical secret request failed.");
    expect((error as Error).message).not.toContain(rawError.message);
  });
});
