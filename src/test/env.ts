import "dotenv/config";

/**
 * Resolves the database the integration tests run against.
 *
 * Set TEST_DATABASE_URL to point somewhere explicit. With nothing set, the dev
 * DATABASE_URL is reused with `_test` appended to the database name, so a
 * checkout works without extra configuration.
 *
 * The tests TRUNCATE every table between cases, so the name is required to end
 * in `_test` — that guard is the only thing standing between a stray env var
 * and someone's real data.
 */
export function resolveTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const url = explicit ?? deriveFromDevUrl();

  const { database } = parseDatabaseUrl(url);

  if (!database.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${database}" — the test ` +
        `database name must end in "_test". Set TEST_DATABASE_URL.`,
    );
  }

  return url;
}

function deriveFromDevUrl(): string {
  const devUrl = process.env.DATABASE_URL;

  if (!devUrl)
    throw new Error(
      "Neither TEST_DATABASE_URL nor DATABASE_URL is set — cannot resolve a test database.",
    );

  const { database } = parseDatabaseUrl(devUrl);

  return devUrl.replace(`/${database}`, `/${database}_test`);
}

/**
 * Postgres passwords in this project contain unescaped `@`, which trips the
 * URL parser, so the connection string is split by hand from the right.
 */
export function parseDatabaseUrl(url: string) {
  const [scheme, rest] = url.split("://");
  const [credentials, hostAndPath] = splitLast(rest, "@");
  const [user, password] = splitFirst(credentials, ":");
  const [hostPort, pathAndQuery] = splitFirst(hostAndPath, "/");
  const [host, port] = splitFirst(hostPort, ":");
  const [database] = pathAndQuery.split("?");

  return { scheme, user, password, host, port: port || "5432", database };
}

function splitFirst(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator);
  return index === -1
    ? [value, ""]
    : [value.slice(0, index), value.slice(index + separator.length)];
}

function splitLast(value: string, separator: string): [string, string] {
  const index = value.lastIndexOf(separator);
  return index === -1
    ? [value, ""]
    : [value.slice(0, index), value.slice(index + separator.length)];
}
