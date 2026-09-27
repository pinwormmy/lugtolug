import { describe, expect, it } from "vitest";
import { readFormData } from "@/lib/http";
import { POST as login } from "@/pages/api/admin/login";
import { POST as submit } from "@/pages/api/submissions";

// A multipart body whose boundary never appears, which formData() rejects.
function malformedRequest(path: string) {
  return new Request(`https://example.com${path}`, {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=missing" },
    body: "not a form"
  });
}

function createMockDb() {
  const statements: string[] = [];
  const db = {
    prepare(sql: string) {
      statements.push(sql);
      const statement = {
        bind() {
          return statement;
        },
        async first() {
          if (sql.includes("COUNT(*) AS count")) return { count: 0 };
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          return { meta: { last_row_id: 1 } };
        }
      };
      return statement;
    }
  };
  return { db, statements };
}

function routeContext(request: Request, db: unknown) {
  return { request, locals: { runtime: { env: { DB: db } } } } as never;
}

describe("readFormData", () => {
  it("returns the parsed form for a valid body", async () => {
    const body = new FormData();
    body.set("email", "operator@example.com");

    const form = await readFormData(new Request("https://example.com/", { method: "POST", body }));

    expect(form?.get("email")).toBe("operator@example.com");
  });

  it("returns null instead of throwing for a malformed body", async () => {
    await expect(readFormData(malformedRequest("/"))).resolves.toBeNull();
  });
});

describe("public form endpoints with a malformed body", () => {
  it("login redirects with the invalid-credentials error and counts a failed attempt", async () => {
    const { db, statements } = createMockDb();

    const response = await login(routeContext(malformedRequest("/api/admin/login"), db));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/login?error=invalid");
    expect(statements).toContain("INSERT INTO submission_rate_events (ip_hash) VALUES (?)");
  });

  it("submission answers 400 with a message the form can show", async () => {
    const { db, statements } = createMockDb();

    const response = await submit(routeContext(malformedRequest("/api/submissions"), db));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: expect.any(String) });
    expect(statements).toEqual([]);
  });
});
