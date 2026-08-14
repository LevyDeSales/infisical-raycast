import { InfisicalSDK } from "@infisical/sdk";
import { getPreferenceValues } from "@raycast/api";
import { createInfisicalApi } from "./authentication";

const { siteUrl, accessToken } = getPreferenceValues<Preferences>();

const client = new InfisicalSDK({
  siteUrl,
});
export const infisical = client;

const api = createInfisicalApi(client, siteUrl, fetch);

export const authenticate = () => api.authenticate(accessToken);
export const callInfisical = api.callInfisical;
