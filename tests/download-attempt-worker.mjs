import { parentPort, workerData } from "node:worker_threads";

import {
  configureRuntimeDatabaseForTests,
  resetRuntimeDatabaseForTests,
} from "../lib/database/client.ts";
import { registerDownloadAttempt } from "../lib/downloads/store.ts";

configureRuntimeDatabaseForTests({
  dataDirectory: workerData.dataDirectory,
  databasePath: workerData.databasePath,
});

parentPort.postMessage({ ready: true });
Atomics.wait(new Int32Array(workerData.startGate), 0, 0);

try {
  const result = await registerDownloadAttempt(workerData.input);
  resetRuntimeDatabaseForTests();
  parentPort.postMessage({ result });
} catch (error) {
  resetRuntimeDatabaseForTests();
  parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
}

parentPort.close();
