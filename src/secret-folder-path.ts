export function normalizeSecretFolderPath(path?: string): string {
  const segments = (path ?? "").split("/").filter(Boolean);
  return segments.length ? "/" + segments.join("/") : "/";
}

export function joinSecretFolderPath(parentPath: string, folderName: string): string {
  return normalizeSecretFolderPath(parentPath + "/" + folderName);
}
