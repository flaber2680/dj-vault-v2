import { getSessionSecret } from "@/lib/auth/secret";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    getSessionSecret();
  }
}
