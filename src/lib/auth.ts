const SESSION_COOKIE = "llt_session";
const encoder = new TextEncoder();

export interface AdminUser {
  id: number;
  email: string;
}

export interface AdminSession {
  user: AdminUser;
  csrfToken: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return bytesToHex(values);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt = randomHex(16), iterations = 100_000) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt).buffer as ArrayBuffer,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return {
    hash: bytesToHex(new Uint8Array(bits)),
    salt,
    iterations
  };
}

export async function verifyPassword(password: string, salt: string, iterations: number, expectedHash: string) {
  const result = await hashPassword(password, salt, iterations);
  return result.hash === expectedHash;
}

export function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function makeSessionCookie(token: string, expires: Date, secure = true): string {
  const securePart = secure ? " Secure;" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly;${securePart} SameSite=Lax; Expires=${expires.toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createSession(db: D1Database, userId: number, request: Request): Promise<{ token: string; csrf: string; expires: Date }> {
  const token = randomHex(32);
  const csrf = randomHex(24);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await db
    .prepare(
      `INSERT INTO admin_sessions
       (admin_user_id, token_hash, csrf_token, expires_at, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      userId,
      await sha256Hex(token),
      csrf,
      expires.toISOString(),
      request.headers.get("user-agent") ?? "",
      request.headers.get("cf-connecting-ip") ?? ""
    )
    .run();
  return { token, csrf, expires };
}

export async function getAdminSession(db: D1Database | undefined, request: Request): Promise<AdminSession | null> {
  if (!db) return null;
  const token = getSessionCookie(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.csrf_token, u.id, u.email
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_user_id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP`
    )
    .bind(tokenHash)
    .first<{ csrf_token: string; id: number; email: string }>();
  if (!row) return null;
  return { user: { id: row.id, email: row.email }, csrfToken: row.csrf_token };
}

export async function requireAdmin(db: D1Database | undefined, request: Request): Promise<AdminSession> {
  const session = await getAdminSession(db, request);
  if (!session) throw new Response(null, { status: 302, headers: { Location: "/admin/login" } });
  return session;
}

export async function destroySession(db: D1Database | undefined, request: Request): Promise<void> {
  if (!db) return;
  const token = getSessionCookie(request);
  if (!token) return;
  await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

export async function assertCsrf(session: AdminSession, request: Request): Promise<void> {
  const form = await request.clone().formData();
  assertCsrfToken(session, String(form.get("csrfToken") ?? ""));
}

export function assertCsrfToken(session: AdminSession, token: string): void {
  if (token !== session.csrfToken) {
    throw new Response("Invalid CSRF token", { status: 403 });
  }
}
