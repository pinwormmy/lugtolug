// Load data/seed.sql into the local D1 database that `wrangler dev` / `wrangler
// pages dev` use. `wrangler d1 execute --local --file` spends tens of minutes
// splitting the 12 MB seed into statements; SQLite itself runs the same file in
// a few seconds, so this writes straight into wrangler's local SQLite file with
// Node's built-in sqlite module (Node 22.13+).
//
//   npm run db:migrate:local      # creates the database and applies migrations
//   npm run db:seed:local         # this script
//
// Refuses to run when no migrated local database exists or when more than one
// local D1 file is present (it would not know which one is the DB binding).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const STATE_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const SEED_FILE = "data/seed.sql";

function findLocalDatabase() {
  let files;
  try {
    files = readdirSync(STATE_DIR).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
  } catch {
    files = [];
  }
  if (files.length === 0) {
    throw new Error(`No local D1 database under ${STATE_DIR}. Run \`npm run db:migrate:local\` first.`);
  }
  if (files.length > 1) {
    throw new Error(`Several local D1 databases under ${STATE_DIR}; remove the stale ones first:\n  ${files.join("\n  ")}`);
  }
  return join(STATE_DIR, files[0]);
}

const databasePath = findLocalDatabase();
const seedSql = readFileSync(SEED_FILE, "utf8");
const db = new DatabaseSync(databasePath);

try {
  const migrations = db.prepare("SELECT count(*) AS count FROM d1_migrations").get().count;
  if (migrations === 0) throw new Error("The local database has no migrations applied. Run `npm run db:migrate:local` first.");

  db.exec("PRAGMA foreign_keys = ON");
  const startedAt = Date.now();
  db.exec("BEGIN");
  db.exec(seedSql);
  db.exec("COMMIT");
  // Fold the write-ahead log back into the main file so wrangler sees the rows immediately.
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

  const counts = db
    .prepare(
      "SELECT (SELECT count(*) FROM watches WHERE status = 'approved') AS approved, (SELECT count(*) FROM watch_sources) AS sources"
    )
    .get();
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `Seeded ${databasePath} (${(statSync(SEED_FILE).size / 1048576).toFixed(1)} MB of SQL) in ${seconds}s: ` +
      `${counts.approved} approved watches, ${counts.sources} sources.`
  );
} catch (error) {
  try {
    db.exec("ROLLBACK");
  } catch {
    // no open transaction
  }
  throw error;
} finally {
  db.close();
}
