export function buildSecretPath(
  projectSlug: string,
  environment: string,
  secretPath: string | undefined,
  secretKey: string,
): string {
  const nestedSegments = (secretPath ?? "").split("/").filter(Boolean);

  return `/${[projectSlug, environment, ...nestedSegments, secretKey].join("/")}`;
}
