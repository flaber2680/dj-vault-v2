const localDevelopmentSecret =
  "dj-vault-local-development-secret-not-for-production";

export function getSessionSecret(
  environment = process.env.NODE_ENV,
  configuredSecret = process.env.AUTH_SECRET,
) {
  const secret = configuredSecret?.trim();

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (environment === "production") {
    throw new Error("AUTH_SECRET must be at least 32 characters in production.");
  }

  return localDevelopmentSecret;
}
