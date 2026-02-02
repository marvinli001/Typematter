#!/usr/bin/env node
const path = require("path");
const { spawnSync } = require("child_process");

const tsxPath = require.resolve("tsx/dist/cli.js");
const cliPath = path.join(__dirname, "..", "scripts", "typematter.ts");

const result = spawnSync(process.execPath, [tsxPath, cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 0);
