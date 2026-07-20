import { AsyncLocalStorage } from "node:async_hooks";
import { register } from "node:module";

globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

register("./alias-loader.mjs", import.meta.url);
