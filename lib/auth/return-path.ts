const authPaths = ["/login", "/register"];

export function normalizeAuthReturnPath(value?: string) {
  const path = value?.trim();

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    authPaths.some((authPath) =>
      path === authPath ||
      path.startsWith(`${authPath}?`) ||
      path.startsWith(`${authPath}#`),
    )
  ) {
    return undefined;
  }

  return path;
}
