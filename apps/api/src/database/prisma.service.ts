import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const defaultServerlessConnectionLimit = 3;
const maximumServerlessConnectionLimit = 10;

function serverlessConnectionLimit(value?: string) {
  if (!value) return defaultServerlessConnectionLimit;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximumServerlessConnectionLimit) {
    return defaultServerlessConnectionLimit;
  }
  return parsed;
}

function runtimeDatabaseUrl(value?: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      // Supabase transaction-mode Supavisor does not preserve prepared statements.
      // Prisma requires pgbouncer mode here. A tiny application-side pool is still
      // desirable for serverless, but one connection proved insufficient once Fluid
      // Compute began serving concurrent Hustle reads within the same runtime.
      if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
      url.searchParams.set(
        "connection_limit",
        String(serverlessConnectionLimit(process.env.PRISMA_CONNECTION_LIMIT))
      );
      if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "30");
      if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
    }
    return url.toString();
  } catch {
    return value;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = runtimeDatabaseUrl(process.env.DATABASE_URL);
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {});
  }

  async onModuleInit() {
    if (process.env.DATABASE_URL) await this.$connect();
  }
  async onModuleDestroy() {
    if (process.env.DATABASE_URL) await this.$disconnect();
  }
}
