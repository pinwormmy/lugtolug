import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

// Runs scripts/generate-og-images.ts before `astro build`. The generator lives
// in a child process under tsx because Astro's config loader cannot resolve the
// `@/` path aliases the catalog modules use.

const require = createRequire(import.meta.url);
const TSX_CLI = require.resolve("tsx/cli");
const GENERATOR = fileURLToPath(new URL("../../scripts/generate-og-images.ts", import.meta.url));
const TSCONFIG = fileURLToPath(new URL("../../tsconfig.json", import.meta.url));

function runGenerator(publicDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, "--tsconfig", TSCONFIG, GENERATOR, publicDir], {
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Open Graph card generation failed (exit code ${code}).`));
    });
  });
}

export function ogImages(): AstroIntegration {
  let publicDir = "";
  return {
    name: "og-images",
    hooks: {
      "astro:config:setup": ({ config }) => {
        publicDir = fileURLToPath(config.publicDir);
      },
      "astro:build:start": async ({ logger }) => {
        logger.info("Rendering Open Graph cards…");
        await runGenerator(publicDir);
      }
    }
  };
}
