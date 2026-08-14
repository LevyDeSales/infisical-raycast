type InfisicalClient = {
  auth: () => {
    accessToken: (token: string) => unknown;
    getAccessToken: () => string | null | undefined;
  };
};

type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

export const callInfisicalSdk = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("[StatusCode=401]")) {
      throw new Error("Access Token invalid, expired, or revoked.");
    }

    if (message.includes("[StatusCode=403]")) {
      throw new Error("Machine Identity does not have permission for this resource.");
    }

    throw new Error("Infisical secret request failed.");
  }
};

export const createInfisicalApi = (
  client: InfisicalClient,
  siteUrl: string,
  fetchImplementation: FetchImplementation,
) => {
  const authenticate = (accessToken: string) => {
    client.auth().accessToken(accessToken);
  };

  const callInfisical = async <T>(endpoint: string) => {
    const token = client.auth().getAccessToken();
    const response = await fetchImplementation(new URL(`api/${endpoint}`, siteUrl), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      throw new Error("Access Token invalid, expired, or revoked.");
    }

    if (response.status === 403) {
      throw new Error("Machine Identity does not have permission for this resource.");
    }

    if (!response.ok) {
      throw new Error(`Infisical request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  };

  return { authenticate, callInfisical };
};
