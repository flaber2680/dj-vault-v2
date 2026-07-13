import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("next/")) {
    const nextModulePath = path.join(projectRoot, "node_modules", `${specifier}.js`);

    if (existsSync(nextModulePath)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(nextModulePath).href,
      };
    }
  }

  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const relativePath = specifier.slice(2);
  const basePath = path.join(projectRoot, relativePath);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
  ];
  const resolvedPath = candidates.find(existsSync);

  if (!resolvedPath) {
    return nextResolve(specifier, context);
  }

  return {
    shortCircuit: true,
    url: pathToFileURL(resolvedPath).href,
  };
}
