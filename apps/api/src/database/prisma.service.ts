import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

function runtimeDatabaseUrl(value?: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      // Supabase transaction-mode Supavisor does not preserve prepared statements.
      // Prisma requires pgbouncer mode here, and serverless should keep its client pool tiny.
      if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
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
