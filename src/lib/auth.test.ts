import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  getSessionCookie,
  hashPassword,
  isValidCsrfToken,
  makeSessionCookie,
  timingSafeEqual,
  verifyPassword,
  verifyUnknownUserPassword
} from "@/lib/auth";

describe("timingSafeEqual", () => {
  it("matches identical strings and rejects any difference", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "a")).toBe(false);
  });
});

describe("password hashing", () => {
  it("verifies a password against its PBKDF2 hash and rejects others", async () => {
    const { hash, salt, iterations } = await hashPassword("correct horse battery", undefined, 1_000);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(salt).toMatch(/^[a-f0-9]{32}$/);
    expect(await verifyPassword("correct horse battery", salt, iterations, hash)).toBe(true);
    expect(await verifyPassword("correct horse batter", salt, iterations, hash)).toBe(false);
    expect(await verifyPassword("correct horse battery", salt, iterations, `${hash.slice(0, -1)}0`)).toBe(false);
  });

  it("never accepts a password for an unknown account", async () => {
    expect(await verifyUnknownUserPassword("anything")).toBe(false);
  });
});

describe("session cookie", () => {
  it("is HttpOnly, Secure and SameSite=Lax by default", () => {
    const cookie = makeSessionCookie("tok en", new Date(Date.UTC(2030, 0, 1)));

    expect(cookie).toContain("llt_session=tok%20en;");
    expect(cookie).toContain("HttpOnly;");
    expect(cookie).toContain("Secure;");
    expect(cookie).toContain("SameSite=Lax;");
    expect(cookie).toContain("Expires=Tue, 01 Jan 2030 00:00:00 GMT");
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("reads the token back from the request cookie header", () => {
    const cookie = makeSessionCookie("tok en", new Date(Date.UTC(2030, 0, 1))).split(";")[0];
    const request = new Request("https://example.com/admin", {
      headers: { cookie: `l2l_visitor=abc; ${cookie}; other=1` }
    });

    expect(getSessionCookie(request)).toBe("tok en");
    expect(getSessionCookie(new Request("https://example.com/admin"))).toBeNull();
  });
});

describe("isValidCsrfToken", () => {
  const session = { user: { id: 1, email: "operator@example.com" }, csrfToken: "expected-token" };

  it("accepts only the exact session token", () => {
    expect(isValidCsrfToken(session, "expected-token")).toBe(true);
    expect(isValidCsrfToken(session, "expected-toke")).toBe(false);
    expect(isValidCsrfToken(session, "")).toBe(false);
  });
});
