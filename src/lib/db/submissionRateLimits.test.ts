import { describe, expect, it } from "vitest";
import { isSubmissionRateLimited } from "@/lib/db/submissionRateLimits";
import type { SubmissionRateLimitRow } from "@/lib/db/rows";

function createMockDb(row: SubmissionRateLimitRow | null, count: number) {
  const prepareCalls: string[] = [];
  const bindCalls: unknown[][] = [];

  const db = {
    prepare(sql: string) {
      prepareCalls.push(sql);
      const statement = {
        bind(...args: unknown[]) {
          bindCalls.push(args);
          return statement;
        },
        async first() {
          if (sql.includes("FROM submission_rate_limits")) return row;
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

  return { db: db as never, prepareCalls, bindCalls };
}

function createRequest(ip = "203.0.113.10") {
  return new Request("https://example.com/api/submissions", {
    headers: {
      "cf-connecting-ip": ip
    }
  });
}

describe("submission rate limits", () => {
  it("allows the first submission when there is no recent rate-limit row", async () => {
    const { db, prepareCalls } = createMockDb(null, 0);

    const result = await isSubmissionRateLimited(db, createRequest());

    expect(prepareCalls[0]).toContain("FROM submission_rate_limits");
    expect(result).toEqual({ limited: false });
  });

  it("blocks a non-admin after 10 submissions in 24 hours", async () => {
    const { db } = createMockDb(
      {
        ip_hash: "hashed-ip",
        last_submitted_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      },
      10
    );

    const result = await isSubmissionRateLimited(db, createRequest());

    expect(result).toEqual({
      limited: true,
      reason: "daily",
      retryAfterSeconds: 24 * 60 * 60
    });
  });

  it("allows a non-admin with fewer than 10 submissions in 24 hours", async () => {
    const { db } = createMockDb(
      {
        ip_hash: "hashed-ip",
        last_submitted_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
      },
      9
    );

    const result = await isSubmissionRateLimited(db, createRequest());

    expect(result).toEqual({ limited: false });
  });
});
