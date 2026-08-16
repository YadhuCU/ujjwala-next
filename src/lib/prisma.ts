import dns from "node:dns";
import net from "node:net";
import { PrismaClient } from "@/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Managed Postgres (Neon and friends) answers DNS with both A and AAAA records.
// On a network with no route to the IPv6 address, every query fails with an
// opaque ETIMEDOUT — including the sign-in lookup, so the app looks broken
// rather than unreachable.
//
// Both settings are needed: the first orders IPv4 ahead of IPv6, the second
// stops Node racing the two and giving up on the pair before the IPv4 address
// has had its chance. Ordering alone was not enough here. Neither costs
// anything where IPv6 does work, and the same pin is in prisma/seed.ts and
// prisma/scripts/export-legacy-data.ts.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Every list endpoint pairs findMany with count inside one $transaction.
    // Prisma waits 2s by default to acquire one, which is fine when the
    // database is next door and not when it is a few hundred milliseconds
    // away — the round trips alone exhaust it and the request 500s with
    // "Unable to start a transaction in the given time". Serverless functions
    // and the database are not always in the same region.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Cached in production too, not just in development. On a serverless host each
// module instantiation would otherwise build its own client and its own pool,
// and `withAuth` now reads permissions from the database on every request — so
// an uncached client multiplies connection churn against the exact endpoint
// that can least afford it.
globalForPrisma.prisma = prisma;
