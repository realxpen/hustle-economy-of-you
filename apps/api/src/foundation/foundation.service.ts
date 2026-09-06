import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../database/prisma.service";

type State = "connected" | "not_configured" | "unavailable";

@Injectable()
export class FoundationService {
  constructor(private readonly prisma: PrismaService) {}

  private async databaseState(): Promise<State> {
    if (!process.env.DATABASE_URL) return "not_configured";
    try { await this.prisma.$queryRaw`SELECT 1`; return "connected"; } catch { return "unavailable"; }
  }

  private async redisState(): Promise<State> {
    if (!process.env.REDIS_URL) return "not_configured";
    const redis = new Redis(process.env.REDIS_URL, {lazyConnect:true,maxRetriesPerRequest:0,connectTimeout:1500});
    try { await redis.connect(); await redis.ping(); return "connected"; } catch { return "unavailable"; } finally { redis.disconnect(); }
  }

  private authState(): State {
    const provider = process.env.AUTH_PROVIDER;
    if (!provider || provider === "unconfigured") return "not_configured";
    if (provider === "supabase" && (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)) return "not_configured";
    return "connected";
  }

  async health() {
    const [database, redis] = await Promise.all([this.databaseState(), this.redisState()]);
    const auth = this.authState();
    const storage: State = process.env.STORAGE_PROVIDER && process.env.STORAGE_PROVIDER !== "unconfigured" ? "connected" : "not_configured";
    const degraded = [database, redis].includes("unavailable");
    return {service:"hustle-api",status:degraded?"degraded":"ok",environment:process.env.NODE_ENV ?? "development",timestamp:new Date().toISOString(),dependencies:{database,redis,auth,storage}};
  }

  foundationStatus(){
    return {phase:2,name:"Authentication + Unified Account System",architecture:"modular-monolith",apps:["mobile","web","api","admin"],identity:"single-account-progressive-capabilities",authProvider:process.env.AUTH_PROVIDER ?? "unconfigured",nextPhase:"Hustler Application + Verification"};
  }
}
