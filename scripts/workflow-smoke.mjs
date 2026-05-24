import { spawnSync } from "node:child_process";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(value.slice(2), next);
    index += 1;
  } else {
    args.set(value.slice(2), "true");
  }
}

const baseUrl = (args.get("base-url") ?? process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4321").replace(/\/+$/, "");
const adminEmail = args.get("admin-email") ?? process.env.SMOKE_ADMIN_EMAIL;
const adminPassword = args.get("admin-password") ?? process.env.SMOKE_ADMIN_PASSWORD;
const runIpSeed = 20 + Math.floor(Math.random() * 200);
const clientIp = args.get("client-ip") ?? process.env.SMOKE_CLIENT_IP ?? `198.51.100.${runIpSeed}`;
const rejectClientIp = args.get("reject-client-ip") ?? process.env.SMOKE_REJECT_CLIENT_IP ?? `198.51.100.${(runIpSeed + 1) % 254 || 1}`;

if (!adminEmail || !adminPassword) {
  console.error("Usage: SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... node scripts/workflow-smoke.mjs [--base-url ...]");
  process.exit(1);
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nowSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function formData(entries) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, String(value));
  }
  return form;
}

function readCookie(setCookie) {
  return setCookie ? setCookie.split(";")[0] : "";
}

function parseHiddenValue(html, name) {
  const pattern = new RegExp(`name="${name}"[^>]*value="([^"]+)"`);
  const match = html.match(pattern);
  return match ? match[1] : null;
}

class CookieJar {
  cookie = "";

  absorb(response) {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = readCookie(setCookie);
  }

  headers(extra = {}) {
    return this.cookie ? { ...extra, Cookie: this.cookie } : extra;
  }
}

async function request(path, init = {}, jar = new CookieJar(), requestIp = clientIp) {
  const url = new URL(path, baseUrl);
  const method = init.method ?? "GET";
  const headers = [];
  for (const [name, value] of Object.entries(jar.headers(init.headers ?? {}))) {
    headers.push("-H", `${name}: ${value}`);
  }
  if (/^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl)) {
    headers.push("-H", `cf-connecting-ip: ${requestIp}`);
  }
  headers.push("-H", `x-forwarded-for: ${requestIp}`);
  headers.push("-H", `Origin: ${baseUrl}`);
  headers.push("-H", `Referer: ${baseUrl}/submit`);

  const body = init.body instanceof URLSearchParams ? init.body.toString() : init.body;
  if (body) headers.push("-H", "Content-Type: application/x-www-form-urlencoded");

  const args = ["-sS", "-D", "-", "-o", "-", "-X", method, ...headers];
  if (body) args.push("--data", body);
  args.push(url.toString());

  const result = spawnSync("curl", args, { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `curl exited with ${result.status}`);
  }

  const raw = result.stdout;
  const separator = raw.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
  const parts = raw.split(separator);
  const headerText = parts.shift() ?? "";
  const bodyText = parts.join(separator);
  const headerLines = headerText.split(/\r?\n/).filter(Boolean);
  const statusLine = headerLines.shift() ?? "";
  const statusMatch = statusLine.match(/HTTP\/\S+\s+(\d+)/);
  const headersMap = new Map();
  for (const line of headerLines) {
    const index = line.indexOf(":");
    if (index > 0) {
      headersMap.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
    }
  }
  const response = {
    status: statusMatch ? Number(statusMatch[1]) : 0,
    headers: {
      get(name) {
        return headersMap.get(name.toLowerCase()) ?? null;
      }
    },
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText)
  };
  jar.absorb(response);
  return response;
}

function uniquePayload(kind) {
  const suffix = nowSuffix();
  const base = {
    brand: `Smoke ${kind} ${suffix}`,
    model: `Model ${kind}`,
    reference: `REF-${suffix}`,
    lugToLugMm: kind === "approve" ? 41 : 38,
    diameterMm: kind === "approve" ? 39 : 36,
    thicknessMm: kind === "approve" ? 10.2 : 9.4,
    lugWidthMm: kind === "approve" ? 20 : 18,
    sourceUrl: `https://example.com/smoke/${kind}/${suffix}`,
    privateComment: `Smoke ${kind} payload ${suffix}`,
    contactEmail: `smoke-${suffix}@example.com`
  };

  return { ...base, slugPath: `/watches/${slugify(base.brand)}/${slugify(base.model)}/${slugify(base.reference)}` };
}

async function submitWatch(payload, jar, requestIp) {
  const response = await request("/api/submissions", { method: "POST", body: formData(payload) }, jar, requestIp);
  const body = await response.json().catch(() => null);
  expect(response.status === 201, `Expected submission to return 201, got ${response.status}`);
  expect(body?.id, "Submission response did not include an id");
  return body.id;
}

async function loginAdmin(jar) {
  const response = await request(
    "/api/admin/login",
    {
      method: "POST",
      body: formData({ email: adminEmail, password: adminPassword })
    },
    jar
  );
  expect(response.status === 302, `Expected admin login to redirect, got ${response.status}`);
  expect(response.headers.get("location") === "/admin/submissions", "Admin login did not redirect to submissions");
}

async function getReviewPage(id, jar) {
  const response = await request(`/admin/submissions/${id}`, { method: "GET" }, jar);
  expect(response.status === 200, `Expected review page for submission ${id}, got ${response.status}`);
  return await response.text();
}

async function getPendingPage(jar) {
  const response = await request("/admin/submissions", { method: "GET" }, jar);
  expect(response.status === 200, `Expected pending submissions page, got ${response.status}`);
  return await response.text();
}

async function approveSubmission(id, payload, csrfToken, jar) {
  const response = await request(
    `/api/admin/submissions/${id}/approve`,
    {
      method: "POST",
      body: formData({
        csrfToken,
        brand: payload.brand,
        model: payload.model,
        reference: payload.reference,
        sourceUrl: payload.sourceUrl,
        lugToLugMm: payload.lugToLugMm,
        diameterMm: payload.diameterMm,
        thicknessMm: payload.thicknessMm,
        lugWidthMm: payload.lugWidthMm,
        reviewerNote: "Smoke approval"
      })
    },
    jar
  );
  expect(response.status === 302, `Expected approve to redirect, got ${response.status}`);
  expect(response.headers.get("location") === "/admin/submissions?approved=1", "Approve redirect mismatch");
}

async function rejectSubmission(id, csrfToken, jar) {
  const response = await request(
    `/api/admin/submissions/${id}/reject`,
    {
      method: "POST",
      body: formData({
        csrfToken,
        reviewerNote: "Smoke rejection"
      })
    },
    jar
  );
  expect(response.status === 302, `Expected reject to redirect, got ${response.status}`);
  expect(response.headers.get("location") === "/admin/submissions?rejected=1", "Reject redirect mismatch");
}

async function verifyApprovedWatch(payload, jar) {
  const response = await request(payload.slugPath, { method: "GET" }, jar);
  expect(response.status === 200, `Expected approved watch page at ${payload.slugPath}, got ${response.status}`);
  const html = await response.text();
  expect(html.includes(payload.brand), "Approved watch page is missing the brand");
  expect(html.includes(payload.reference), "Approved watch page is missing the reference");
}

async function run() {
  console.log(`Base URL: ${baseUrl}`);
  const submitJar = new CookieJar();
  const adminJar = new CookieJar();

  const approvedPayload = uniquePayload("approve");
  const approvedId = await submitWatch(approvedPayload, submitJar, clientIp);
  console.log(`Submitted approval candidate ${approvedId}`);

  const rejectedPayload = uniquePayload("reject");
  const rejectedId = await submitWatch(rejectedPayload, submitJar, rejectClientIp);
  console.log(`Submitted rejection candidate ${rejectedId}`);

  await loginAdmin(adminJar);
  console.log("Logged in as admin");

  const approvedReviewHtml = await getReviewPage(approvedId, adminJar);
  const approvedCsrf = parseHiddenValue(approvedReviewHtml, "csrfToken");
  expect(approvedCsrf, `Could not find CSRF token for submission ${approvedId}`);
  await approveSubmission(approvedId, approvedPayload, approvedCsrf, adminJar);
  await verifyApprovedWatch(approvedPayload, adminJar);
  console.log(`Approved submission ${approvedId} and verified ${approvedPayload.slugPath}`);

  const rejectedReviewHtml = await getReviewPage(rejectedId, adminJar);
  const rejectedCsrf = parseHiddenValue(rejectedReviewHtml, "csrfToken");
  expect(rejectedCsrf, `Could not find CSRF token for submission ${rejectedId}`);
  await rejectSubmission(rejectedId, rejectedCsrf, adminJar);

  const pendingHtml = await getPendingPage(adminJar);
  expect(!pendingHtml.includes(`/admin/submissions/${rejectedId}`), "Rejected submission is still listed as pending");
  console.log(`Rejected submission ${rejectedId} and verified it left the pending queue`);

  console.log("Workflow smoke test passed.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
