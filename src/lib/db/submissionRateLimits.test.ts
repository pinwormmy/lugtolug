import { describe, expect, it } from "vitest";
import { isSubmissionRateLimited, recordSubmissionRateLimit } from "@/lib/db/submissionRateLimits";

function createMockDb(count: number) {
  const prepareCalls: string[] = [];

  const db = {
    prepare(sql: string) {
      prepareCalls.push(sql);
      const statement = {
        bind() {
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

  return { db: db as never, prepareCalls };
}

function createRequest(ip = "203.0.113.10") {
  return new Request("https://example.com/api/submissions", {
    headers: {
      "cf-connecting-ip": ip
    }
  });
}

describe("submission rate limits", () => {
  it("allows submissions below the 24-hour cap", async () => {
    const { db, prepareCalls } = createMockDb(9);

    const result = await isSubmissionRateLimited(db, createRequest());

    expect(prepareCalls.some((sql) => sql.startsWith("DELETE FROM submission_rate_events"))).toBe(true);
    expect(prepareCalls.some((sql) => sql.startsWith("SELECT COUNT(*) AS count FROM submission_rate_events"))).toBe(true);
    expect(result).toEqual({ limited: false });
  });

  it("blocks submissions at the 24-hour cap", async () => {
    const { db } = createMockDb(10);

    const result = await isSubmissionRateLimited(db, createRequest());

    expect(result).toEqual({
      limited: true,
      reason: "daily",
      retryAfterSeconds: 24 * 60 * 60
    });
  });

  it("prunes old submission events when recording a new submission", async () => {
    const { db, prepareCalls } = createMockDb(0);

    await recordSubmissionRateLimit(db, createRequest());

    expect(prepareCalls.filter((sql) => sql.startsWith("DELETE FROM submission_rate_events"))).toHaveLength(1);
    expect(prepareCalls.some((sql) => sql.startsWith("INSERT INTO submission_rate_events"))).toBe(true);
  });
});
