import path from "node:path";

export function getDataDirectory(): string {
  return process.env.DATA_DIRECTORY?.trim() || path.join(process.cwd(), ".data");
}
