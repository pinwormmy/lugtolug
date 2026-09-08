import { describe, expect, it } from "vitest";
import { isLoginRateLimited, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MINUTES, recordFailedLogin } from "@/lib/db/loginRateLimits";

function createMockDb(count: number) {
  const calls: { sql: string; params: unknown[] }[] = [];

  const db = {
    prepare(sql: string) {
      const call = { sql, params: [] as unknown[] };
      calls.push(call);
      const statement = {
        bind(...params: unknown[]) {
          call.params = params;
          return statement;
        },
        async first() {
          if (sql.includes("COUNT(*) AS count")) return { count };
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          return { meta: { last_row_id: 1 } };
        }
      };
      return statement;
    }
  };

  return { db: db as never, calls };
}

function createRequest(ip = "203.0.113.10") {
  return new Request("https://example.com/api/admin/login", {
    method: "POST",
    headers: { "cf-connecting-ip": ip }
  });
}

describe("admin login throttle", () => {
  it("allows attempts below the limit and scopes the window to 15 minutes", async () => {
    const { db, calls } = createMockDb(LOGIN_ATTEMPT_LIMIT - 1);

    const result = await isLoginRateLimited(db, createRequest());

    expect(result).toEqual({ limited: false });
    const count = calls.find((call) => call.sql.startsWith("SELECT COUNT(*) AS count FROM submission_rate_events"));
    expect(count?.params[1]).toBe(`-${LOGIN_WINDOW_MINUTES} minutes`);
    expect(calls.some((call) => call.sql.startsWith("DELETE FROM submission_rate_events"))).toBe(true);
  });

  it("blocks attempts at the limit", async () => {
    const { db } = createMockDb(LOGIN_ATTEMPT_LIMIT);

    const result = await isLoginRateLimited(db, createRequest());

    expect(result).toEqual({ limited: true, retryAfterSeconds: LOGIN_WINDOW_MINUTES * 60 });
  });

  it("keeps login and submission buckets separate for the same address", async () => {
    const { db, calls } = createMockDb(0);

    await recordFailedLogin(db, createRequest());
    const { isSubmissionRateLimited } = await import("@/lib/db/submissionRateLimits");
    await isSubmissionRateLimited(db, createRequest());

    const insert = calls.find((call) => call.sql.startsWith("INSERT INTO submission_rate_events"));
    const submissionCount = calls.find((call) => call.sql.startsWith("SELECT COUNT(*) AS count"));
    expect(insert?.params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(submissionCount?.params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(insert?.params[0]).not.toBe(submissionCount?.params[0]);
  });

  it("does nothing without a database", async () => {
    expect(await isLoginRateLimited(undefined, createRequest())).toEqual({ limited: false });
    await expect(recordFailedLogin(undefined, createRequest())).resolves.toBeUndefined();
  });
});
