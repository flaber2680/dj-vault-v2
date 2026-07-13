import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getDataDirectory } from "./config.ts";

let database: Database.Database | null = null;
let databasePath: string | null = null;

export function openDatabase(pathOverride?: string): Database.Database {
  const nextPath = pathOverride ?? path.join(getDataDirectory(), "dj-vault.sqlite");

  if (database && databasePath === nextPath) {
    return database;
  }

  if (database) {
    database.close();
  }

  mkdirSync(path.dirname(nextPath), { recursive: true });

  database = new Database(nextPath);
  databasePath = nextPath;
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");

  return database;
}

export function closeDatabaseForTests(): void {
  database?.close();
  database = null;
  databasePath = null;
}
