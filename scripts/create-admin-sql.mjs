import { webcrypto } from "node:crypto";

const crypto = globalThis.crypto ?? webcrypto;

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/create-admin-sql.mjs operator@example.com 'password'");
  process.exit(1);
}

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(bytes = 16) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return bytesToHex(values);
}

const salt = randomHex(16);
const iterations = 100000;
const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits(
  {
    name: "PBKDF2",
    salt: hexToBytes(salt),
    iterations,
    hash: "SHA-256"
  },
  keyMaterial,
  256
);
const hash = bytesToHex(new Uint8Array(bits));
const safeEmail = email.trim().toLowerCase().replaceAll("'", "''");

console.log(
  `INSERT INTO admin_users (email, password_hash, salt, iterations) VALUES ('${safeEmail}', '${hash}', '${salt}', ${iterations});`
);
