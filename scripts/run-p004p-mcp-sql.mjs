#!/usr/bin/env node
/**
 * Reads P004P pumping SQL from JSON and prints raw query to stdout (for piping to MCP or psql).
 * Usage: node scripts/run-p004p-mcp-sql.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const d = JSON.parse(readFileSync(join(root, "_mcp_execute_args.json"), "utf8"));
process.stdout.write(d.query);
