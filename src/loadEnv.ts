import * as dotenv from "dotenv";
import * as path from "node:path";

/**
 * Loads local env vars from .env.local (falls back to .env for anything missing).
 * Must be the FIRST import in any entry point, so process.env is populated
 * before other modules read it at their own top level (e.g. deviceSetup.ts).
 */
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();
