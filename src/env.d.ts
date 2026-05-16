/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface RuntimeEnv {
  DB?: D1Database;
  SESSION_SECRET?: string;
}

declare namespace App {
  interface Locals {
    runtime?: {
      env: RuntimeEnv;
    };
  }
}
