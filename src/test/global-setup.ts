import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { parseDatabaseUrl, resolveTestDatabaseUrl } from "./env";

/**
 * Runs once per `npm run test:integration`: creates the test database if it is
 * missing, then brings it up to the current migrations. Data is left in place
 * between runs — each test truncates what it needs in `setup.ts`.
 */
export default async function setup() {
  const url = resolveTestDatabaseUrl();
  const { user, password, host, port, database } = parseDatabaseUrl(url);

  const admin = new Client({
    user,
    password: decodeURIComponent(password),
    host,
    port: Number(port),
    database: "postgres",
  });

  await admin.connect();

  const existing = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [database],
  );

  if (existing.rowCount === 0) {
    // Identifiers cannot be parameterised; the name is checked to end in
    // `_test` by resolveTestDatabaseUrl and is quoted here.
    await admin.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    console.log(`Created test database ${database}`);
  }

  await admin.end();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
