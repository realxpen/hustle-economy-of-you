import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  PostStatus,
  ProductStatus,
  ProductType,
  ProfessionalProfileStatus,
  ServiceDeliveryMode,
  ServiceStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export type SearchTab = "top" | "people" | "posts" | "services" | "products";
export type MarketplaceTab = "all" | "services" | "products";

export interface DiscoveryQueryInput {
  q?: string;
  cursor?: string;
  limit?: string;
  category?: string;
  skill?: string;
  location?: string;
  nearby?: string;
  minPrice?: string;
  maxPrice?: string;
  verified?: string;
  deliveryMode?: string;
  productType?: string;
}

type ResultKind = "person" | "post" | "service" | "product";

type ParsedFilters = {
  category: string | null;
  skill: string | null;
  location: string | null;
  nearby: boolean;
  nearbyLocation: string | null;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  verified: boolean | null;
  deliveryMode: ServiceDeliveryMode | null;
  productType: ProductType | null;
};

type RankedResult = {
  kind: ResultKind;
  id: string;
  score: number;
  timestamp: string;
  reasons: string[];
  value: Record<string, unknown>;
};

type Cursor = {
  score: number;
  timestamp: string;
  kind: ResultKind;
  id: string;
};

const searchTabs = new Set<SearchTab>(["top", "people", "posts", "services", "products"]);
const marketplaceTabs = new Set<MarketplaceTab>(["all", "services", "products"]);
const ignoredTokens = new Set(["a", "an", "and", "for", "in", "near", "me", "of", "the", "to", "with"]);

const professionalProfileSelect = {
  id: true,
  headline: true,
  primarySkill: true,
  secondarySkills: true,
  category: true,
  professionalSummary: true,
  yearsExperience: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      bio: true,
      location: true,
      emailVerified: true,
      phoneVerified: true
    }
  }
} satisfies Prisma.ProfessionalProfileSelect;

const personSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  bio: true,
  location: true,
  emailVerified: true,
  phoneVerified: true,
  updatedAt: true,
  professionalProfile: {
    select: {
      id: true,
      headline: true,
      primarySkill: true,
      secondarySkills: true,
      category: true,
      professionalSummary: true,
      yearsExperience: true,
      status: true,
      publishedAt: true,
      updatedAt: true
    }
  }
} satisfies Prisma.UserSelect;

const postInclude = {
  media: {
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }]
  },
  professionalProfile: { select: professionalProfileSelect },
  _count: { select: { likes: true, saves: true, comments: true } }
} satisfies Prisma.PostInclude;

const serviceInclude = {
  professionalProfile: { select: professionalProfileSelect }
} satisfies Prisma.ServiceInclude;

const productInclude = {
  variants: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" as const }
  },
  professionalProfile: { select: professionalProfileSelect }
} satisfies Prisma.ProductInclude;

type PersonCandidate = Prisma.UserGetPayload<{ select: typeof personSelect }>;
type PostCandidate = Prisma.PostGetPayload<{ include: typeof postInclude }>;
type ServiceCandidate = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;
type ProductCandidate = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ProfessionalContext = Prisma.ProfessionalProfileGetPayload<{ select: typeof professionalProfileSelect }>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(identity: AuthIdentity, tabInput: string | undefined, raw: DiscoveryQueryInput) {
    const viewer = await this.requireViewer(identity);
    const tab = this.parseSearchTab(tabInput);
    const query = this.requiredQuery(raw.q);
    const filters = this.parseFilters(raw, viewer.location);
    const limit = this.parseLimit(raw.limit);
    const cursor = this.decodeCursor(raw.cursor);

    const ranked = await this.loadSearchResults(tab, query, filters);
    const page = this.paginate(ranked, cursor, limit);

    return {
      mode: "search" as const,
      tab,
      query,
      filters: this.publicFilters(filters),
      items: page.items.map((item) => this.publicResult(item)),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      zeroResults: ranked.length === 0
    };
  }

  async marketplace(identity: AuthIdentity, tabInput: string | undefined, raw: DiscoveryQueryInput) {
    const viewer = await this.requireViewer(identity);
    const tab = this.parseMarketplaceTab(tabInput);
    const query = this.optionalQuery(raw.q);
    const filters = this.parseFilters(raw, viewer.location);
    const limit = this.parseLimit(raw.limit);
    const cursor = this.decodeCursor(raw.cursor);

    const [services, products] = await Promise.all([
      tab === "products" ? Promise.resolve([] as RankedResult[]) : this.rankServices(query, filters, true),
      tab === "services" ? Promise.resolve([] as RankedResult[]) : this.rankProducts(query, filters, true)
    ]);

    const ranked = [...services, ...products].sort((left, right) => this.compare(left, right));
    const page = this.paginate(ranked, cursor, limit);

    return {
      mode: "marketplace" as const,
      tab,
      query,
      filters: this.publicFilters(filters),
      items: page.items.map((item) => this.publicResult(item)),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      zeroResults: ranked.length === 0
    };
  }

  private async loadSearchResults(tab: SearchTab, query: string, filters: ParsedFilters) {
    if (tab === "people") return this.rankPeople(query, filters);
    if (tab === "posts") return this.rankPosts(query, filters);
    if (tab === "services") return this.rankServices(query, filters, false);
    if (tab === "products") return this.rankProducts(query, filters, false);

    const [people, posts, services, products] = await Promise.all([
      this.rankPeople(query, filters),
      this.rankPosts(query, filters),
      this.rankServices(query, filters, false),
      this.rankProducts(query, filters, false)
    ]);

    return [...people, ...posts, ...services, ...products]
      .sort((left, right) => this.compare(left, right))
      .slice(0, 240);
  }

  private async rankPeople(query: string, filters: ParsedFilters): Promise<RankedResult[]> {
    if (filters.minPriceMinor !== null || filters.maxPriceMinor !== null || filters.deliveryMode || filters.productType) {
      return [];
    }

    const people = await this.prisma.user.findMany({
      where: {
        professionalProfile: { is: { status: ProfessionalProfileStatus.PUBLISHED } },
        capabilities: {
          some: { capability: Capability.HUSTLER, status: CapabilityStatus.ACTIVE }
        }
      },
      select: personSelect,
      orderBy: { updatedAt: "desc" },
      take: 180
    });

    return people.flatMap((person) => {
      const profile = person.professionalProfile;
      if (!profile) return [];
      const verified = person.emailVerified || person.phoneVerified;
      if (!this.passesCommonFilters(filters, profile.category, profile, person.location, verified)) return [];

      const searchable = [
        { label: "name", value: person.displayName, weight: 16 },
        { label: "username", value: person.username, weight: 20 },
        { label: "headline", value: profile.headline, weight: 15 },
        { label: "primary-skill", value: profile.primarySkill, weight: 18 },
        ...profile.secondarySkills.map((value) => ({ label: "skill", value, weight: 13 })),
        { label: "category", value: profile.category, weight: 10 },
        { label: "summary", value: profile.professionalSummary, weight: 6 },
        { label: "bio", value: person.bio, weight: 5 },
        { label: "location", value: person.location, weight: 8 }
      ];
      const lexical = this.lexicalScore(query, searchable);
      if (!lexical.matched) return [];

      let score = lexical.score;
      const reasons = [...lexical.reasons];
      if (verified) { score += 6; reasons.push("verified-identity"); }
      if ((profile.yearsExperience ?? 0) > 0) { score += Math.min(5, profile.yearsExperience ?? 0); reasons.push("experience"); }
      if (this.locationMatches(filters.nearbyLocation ?? filters.location, person.location)) { score += 8; reasons.push("location"); }

      const timestamp = (profile.publishedAt ?? profile.updatedAt).toISOString();
      return [{
        kind: "person" as const,
        id: person.id,
        score: Math.min(100, score),
        timestamp,
        reasons: this.unique(reasons),
        value: {
          person: {
            id: person.id,
            displayName: person.displayName,
            username: person.username,
            avatarUrl: person.avatarUrl,
            bio: person.bio,
            location: person.location,
            verified,
            professionalProfile: profile
          },
          url: person.username ? `/u/${person.username}` : null
        }
      }];
    }).sort((left, right) => this.compare(left, right));
  }

  private async rankPosts(query: string, filters: ParsedFilters): Promise<RankedResult[]> {
    if (filters.minPriceMinor !== null || filters.maxPriceMinor !== null || filters.deliveryMode || filters.productType) {
      return [];
    }

    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        professionalProfile: {
          is: {
            status: ProfessionalProfileStatus.PUBLISHED,
            user: {
              capabilities: {
                some: { capability: Capability.HUSTLER, status: CapabilityStatus.ACTIVE }
              }
            }
          }
        }
      },
      include: postInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 220
    });

    return posts.flatMap((post) => {
      const profile = post.professionalProfile;
      const owner = profile.user;
      const verified = owner.emailVerified || owner.phoneVerified;
      const location = post.location ?? owner.location;
      if (!this.passesCommonFilters(filters, post.category ?? profile.category, profile, location, verified)) return [];

      const searchable = [
        { label: "caption", value: post.caption, weight: 14 },
        { label: "category", value: post.category, weight: 14 },
        ...post.tags.map((value) => ({ label: "tag", value, weight: 13 })),
        { label: "creator", value: owner.displayName, weight: 8 },
        { label: "username", value: owner.username, weight: 9 },
        { label: "headline", value: profile.headline, weight: 9 },
        { label: "primary-skill", value: profile.primarySkill, weight: 12 },
        ...profile.secondarySkills.map((value) => ({ label: "skill", value, weight: 8 })),
        { label: "location", value: location, weight: 7 }
      ];
      const lexical = this.lexicalScore(query, searchable);
      if (!lexical.matched) return [];

      let score = lexical.score;
      const reasons = [...lexical.reasons];
      score += this.recencyScore(post.publishedAt ?? post.createdAt, 8);
      reasons.push("recency");
      const engagement = Math.min(8, post._count.likes + post._count.saves * 2 + post._count.comments * 2);
      if (engagement > 0) { score += engagement; reasons.push("engagement"); }
      if (verified) { score += 5; reasons.push("verified-identity"); }
      if (this.locationMatches(filters.nearbyLocation ?? filters.location, location)) { score += 6; reasons.push("location"); }

      return [{
        kind: "post" as const,
        id: post.id,
        score: Math.min(100, score),
        timestamp: (post.publishedAt ?? post.createdAt).toISOString(),
        reasons: this.unique(reasons),
        value: {
          post: {
            id: post.id,
            caption: post.caption,
            category: post.category,
            location: post.location,
            tags: post.tags,
            publishedAt: post.publishedAt,
            media: post.media
          },
          owner: this.publicOwner(profile),
          engagement: {
            likes: post._count.likes,
            saves: post._count.saves,
            comments: post._count.comments
          },
          url: `/posts/${post.id}`
        }
      }];
    }).sort((left, right) => this.compare(left, right));
  }

  private async rankServices(query: string | null, filters: ParsedFilters, browseMode: boolean): Promise<RankedResult[]> {
    if (filters.productType) return [];

    const services = await this.prisma.service.findMany({
      where: {
        status: ServiceStatus.PUBLISHED,
        professionalProfile: {
          is: {
            status: ProfessionalProfileStatus.PUBLISHED,
            user: {
              capabilities: {
                some: { capability: Capability.HUSTLER, status: CapabilityStatus.ACTIVE }
              }
            }
          }
        }
      },
      include: serviceInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 220
    });

    return services.flatMap((service) => {
      const profile = service.professionalProfile;
      const owner = profile.user;
      const verified = owner.emailVerified || owner.phoneVerified;
      const location = service.location ?? owner.location;
      if (!this.passesCommonFilters(filters, service.category ?? profile.category, profile, location, verified)) return [];
      if (filters.deliveryMode && service.deliveryMode !== filters.deliveryMode) return [];
      if (!this.priceMatches(service.priceMinor, filters)) return [];

      const searchable = [
        { label: "title", value: service.title, weight: 20 },
        { label: "category", value: service.category, weight: 14 },
        { label: "description", value: service.description, weight: 9 },
        { label: "requirements", value: service.requirements, weight: 5 },
        { label: "availability", value: service.availabilityNote, weight: 4 },
        { label: "delivery", value: service.deliveryMode, weight: 6 },
        { label: "creator", value: owner.displayName, weight: 7 },
        { label: "headline", value: profile.headline, weight: 8 },
        { label: "primary-skill", value: profile.primarySkill, weight: 12 },
        ...profile.secondarySkills.map((value) => ({ label: "skill", value, weight: 8 })),
        { label: "location", value: location, weight: 7 }
      ];
      const lexical = query ? this.lexicalScore(query, searchable) : { matched: true, score: 0, reasons: [] as string[] };
      if (!lexical.matched) return [];

      let score = lexical.score;
      const reasons = [...lexical.reasons];
      score += this.recencyScore(service.publishedAt ?? service.createdAt, browseMode ? 14 : 7);
      reasons.push("recency");
      if (verified) { score += browseMode ? 8 : 5; reasons.push("verified-identity"); }
      if (service.mediaUrls.length > 0) { score += 3; reasons.push("media"); }
      if (this.locationMatches(filters.nearbyLocation ?? filters.location, location)) { score += 7; reasons.push("location"); }

      return [{
        kind: "service" as const,
        id: service.id,
        score: Math.min(100, score),
        timestamp: (service.publishedAt ?? service.createdAt).toISOString(),
        reasons: this.unique(reasons),
        value: {
          service: this.stripProfessionalProfile(service),
          owner: this.publicOwner(profile),
          url: `/services/${service.id}`
        }
      }];
    }).sort((left, right) => this.compare(left, right));
  }

  private async rankProducts(query: string | null, filters: ParsedFilters, browseMode: boolean): Promise<RankedResult[]> {
    if (filters.deliveryMode) return [];

    const products = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED,
        professionalProfile: {
          is: {
            status: ProfessionalProfileStatus.PUBLISHED,
            user: {
              capabilities: {
                some: { capability: Capability.HUSTLER, status: CapabilityStatus.ACTIVE }
              }
            }
          }
        }
      },
      include: productInclude,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 220
    });

    return products.flatMap((product) => {
      const profile = product.professionalProfile;
      const owner = profile.user;
      const verified = owner.emailVerified || owner.phoneVerified;
      const location = owner.location;
      if (!this.passesCommonFilters(filters, product.category ?? profile.category, profile, location, verified)) return [];
      if (filters.productType && product.type !== filters.productType) return [];
      if (!this.priceMatches(product.priceMinor, filters)) return [];

      const searchable = [
        { label: "title", value: product.title, weight: 20 },
        { label: "category", value: product.category, weight: 14 },
        { label: "description", value: product.description, weight: 9 },
        { label: "type", value: product.type, weight: 6 },
        { label: "delivery", value: product.deliveryInformation, weight: 5 },
        { label: "creator", value: owner.displayName, weight: 7 },
        { label: "headline", value: profile.headline, weight: 8 },
        { label: "primary-skill", value: profile.primarySkill, weight: 10 },
        ...profile.secondarySkills.map((value) => ({ label: "skill", value, weight: 7 })),
        { label: "location", value: location, weight: 6 }
      ];
      const lexical = query ? this.lexicalScore(query, searchable) : { matched: true, score: 0, reasons: [] as string[] };
      if (!lexical.matched) return [];

      let score = lexical.score;
      const reasons = [...lexical.reasons];
      score += this.recencyScore(product.publishedAt ?? product.createdAt, browseMode ? 14 : 7);
      reasons.push("recency");
      if (verified) { score += browseMode ? 8 : 5; reasons.push("verified-identity"); }
      if (product.mediaUrls.length > 0) { score += 4; reasons.push("media"); }
      if (!product.trackInventory || (product.inventoryQuantity ?? 0) > 0 || product.variants.some((variant) => (variant.inventoryQuantity ?? 0) > 0)) {
        score += 3;
        reasons.push("available-inventory");
      }
      if (this.locationMatches(filters.nearbyLocation ?? filters.location, location)) { score += 6; reasons.push("location"); }

      return [{
        kind: "product" as const,
        id: product.id,
        score: Math.min(100, score),
        timestamp: (product.publishedAt ?? product.createdAt).toISOString(),
        reasons: this.unique(reasons),
        value: {
          product: this.stripProfessionalProfile(product),
          owner: this.publicOwner(profile),
          url: `/products/${product.id}`
        }
      }];
    }).sort((left, right) => this.compare(left, right));
  }

  private passesCommonFilters(
    filters: ParsedFilters,
    category: string | null,
    profile: { headline: string | null; primarySkill: string | null; secondarySkills: string[]; category: string | null },
    location: string | null,
    verified: boolean
  ) {
    if (filters.category && !this.textMatches(filters.category, category) && !this.textMatches(filters.category, profile.category)) return false;
    if (filters.skill) {
      const skillFields = [profile.primarySkill, profile.headline, profile.category, ...profile.secondarySkills];
      if (!skillFields.some((value) => this.textMatches(filters.skill, value))) return false;
    }
    if (filters.location && !this.locationMatches(filters.location, location)) return false;
    if (filters.nearby && !this.locationMatches(filters.nearbyLocation, location)) return false;
    if (filters.verified !== null && verified !== filters.verified) return false;
    return true;
  }

  private priceMatches(priceMinor: number | null, filters: ParsedFilters) {
    if (filters.minPriceMinor === null && filters.maxPriceMinor === null) return true;
    if (priceMinor === null) return false;
    if (filters.minPriceMinor !== null && priceMinor < filters.minPriceMinor) return false;
    if (filters.maxPriceMinor !== null && priceMinor > filters.maxPriceMinor) return false;
    return true;
  }

  private lexicalScore(query: string, fields: Array<{ label: string; value: unknown; weight: number }>) {
    const normalizedQuery = this.normalize(query);
    const tokens = this.queryTokens(query);
    const matchedTokens = new Set<string>();
    const reasons: string[] = [];
    let score = 0;
    let phraseMatched = false;

    for (const field of fields) {
      if (typeof field.value !== "string") continue;
      const value = this.normalize(field.value);
      if (!value) continue;

      if (value === normalizedQuery) {
        score += field.weight * 2.8;
        phraseMatched = true;
        reasons.push(`exact-${field.label}`);
      } else if (value.startsWith(normalizedQuery)) {
        score += field.weight * 2.1;
        phraseMatched = true;
        reasons.push(`prefix-${field.label}`);
      } else if (normalizedQuery.length > 2 && value.includes(normalizedQuery)) {
        score += field.weight * 1.7;
        phraseMatched = true;
        reasons.push(`phrase-${field.label}`);
      }

      for (const token of tokens) {
        if (!value.includes(token)) continue;
        matchedTokens.add(token);
        score += value === token ? field.weight * 1.2 : value.startsWith(token) ? field.weight * 0.8 : field.weight * 0.45;
      }
    }

    const required = tokens.length === 0 ? 0 : Math.max(1, Math.ceil(tokens.length * 0.65));
    const matched = phraseMatched || matchedTokens.size >= required;
    if (matchedTokens.size > 0) reasons.push("token-match");
    return { matched, score: Math.round(score), reasons };
  }

  private publicResult(result: RankedResult) {
    return {
      kind: result.kind,
      id: result.id,
      ...result.value,
      ranking: {
        score: result.score,
        reasons: result.reasons
      }
    };
  }

  private publicOwner(profile: ProfessionalContext) {
    const owner = profile.user;
    return {
      id: owner.id,
      displayName: owner.displayName,
      username: owner.username,
      avatarUrl: owner.avatarUrl,
      bio: owner.bio,
      location: owner.location,
      verified: owner.emailVerified || owner.phoneVerified,
      professionalProfile: {
        id: profile.id,
        headline: profile.headline,
        primarySkill: profile.primarySkill,
        secondarySkills: profile.secondarySkills,
        category: profile.category,
        professionalSummary: profile.professionalSummary,
        yearsExperience: profile.yearsExperience
      }
    };
  }

  private stripProfessionalProfile<T extends { professionalProfile: unknown }>(record: T) {
    const { professionalProfile: _profile, ...safe } = record;
    return safe;
  }

  private paginate(items: RankedResult[], cursor: Cursor | null, limit: number) {
    const afterCursor = cursor ? items.filter((item) => this.isAfterCursor(item, cursor)) : items;
    const window = afterCursor.slice(0, limit + 1);
    const hasMore = window.length > limit;
    const page = hasMore ? window.slice(0, limit) : window;
    const last = page.at(-1);
    return {
      items: page,
      hasMore,
      nextCursor: hasMore && last ? this.encodeCursor(last) : null
    };
  }

  private compare(left: RankedResult, right: RankedResult) {
    if (left.score !== right.score) return right.score - left.score;
    if (left.timestamp !== right.timestamp) return right.timestamp.localeCompare(left.timestamp);
    if (left.kind !== right.kind) return left.kind.localeCompare(right.kind);
    return right.id.localeCompare(left.id);
  }

  private isAfterCursor(item: RankedResult, cursor: Cursor) {
    if (item.score !== cursor.score) return item.score < cursor.score;
    if (item.timestamp !== cursor.timestamp) return item.timestamp < cursor.timestamp;
    if (item.kind !== cursor.kind) return item.kind > cursor.kind;
    return item.id < cursor.id;
  }

  private encodeCursor(item: RankedResult) {
    const cursor: Cursor = { score: item.score, timestamp: item.timestamp, kind: item.kind, id: item.id };
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
  }

  private decodeCursor(value: string | undefined): Cursor | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
      if (
        typeof parsed.score !== "number" ||
        typeof parsed.timestamp !== "string" ||
        typeof parsed.id !== "string" ||
        !["person", "post", "service", "product"].includes(String(parsed.kind))
      ) throw new Error();
      return parsed as Cursor;
    } catch {
      throw new BadRequestException("Invalid search cursor");
    }
  }

  private parseFilters(raw: DiscoveryQueryInput, viewerLocation: string | null): ParsedFilters {
    const category = this.optionalText(raw.category, 100);
    const skill = this.optionalText(raw.skill, 100);
    const location = this.optionalText(raw.location, 120);
    const nearby = this.parseBoolean(raw.nearby, "nearby") ?? false;
    const verified = this.parseBoolean(raw.verified, "verified");
    const minPriceMinor = this.parsePrice(raw.minPrice, "minPrice");
    const maxPriceMinor = this.parsePrice(raw.maxPrice, "maxPrice");
    if (minPriceMinor !== null && maxPriceMinor !== null && minPriceMinor > maxPriceMinor) {
      throw new BadRequestException("minPrice cannot be greater than maxPrice");
    }

    const deliveryMode = this.parseEnum(raw.deliveryMode, "deliveryMode", Object.values(ServiceDeliveryMode));
    const productType = this.parseEnum(raw.productType, "productType", Object.values(ProductType));
    const nearbyLocation = nearby ? location ?? viewerLocation : null;
    if (nearby && !nearbyLocation) {
      throw new BadRequestException("nearby requires a location or a location on the viewer account");
    }

    return { category, skill, location, nearby, nearbyLocation, minPriceMinor, maxPriceMinor, verified, deliveryMode, productType };
  }

  private publicFilters(filters: ParsedFilters) {
    return {
      category: filters.category,
      skill: filters.skill,
      location: filters.location,
      nearby: filters.nearby,
      nearbyLocation: filters.nearbyLocation,
      minPrice: filters.minPriceMinor === null ? null : filters.minPriceMinor / 100,
      maxPrice: filters.maxPriceMinor === null ? null : filters.maxPriceMinor / 100,
      verified: filters.verified,
      deliveryMode: filters.deliveryMode,
      productType: filters.productType
    };
  }

  private async requireViewer(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true, location: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private parseSearchTab(value: string | undefined): SearchTab {
    const tab = (value ?? "top").toLowerCase() as SearchTab;
    if (!searchTabs.has(tab)) throw new BadRequestException("Invalid search tab");
    return tab;
  }

  private parseMarketplaceTab(value: string | undefined): MarketplaceTab {
    const tab = (value ?? "all").toLowerCase() as MarketplaceTab;
    if (!marketplaceTabs.has(tab)) throw new BadRequestException("Invalid marketplace tab");
    return tab;
  }

  private parseLimit(value: string | undefined) {
    if (!value) return 12;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
      throw new BadRequestException("limit must be an integer between 1 and 30");
    }
    return parsed;
  }

  private requiredQuery(value: string | undefined) {
    const query = this.optionalQuery(value);
    if (!query) throw new BadRequestException("q is required for Search");
    return query;
  }

  private optionalQuery(value: string | undefined) {
    if (value === undefined) return null;
    const query = value.trim().replace(/\s+/g, " ");
    if (!query) return null;
    if (query.length > 160) throw new BadRequestException("q must be at most 160 characters");
    return query;
  }

  private optionalText(value: string | undefined, max: number) {
    if (value === undefined) return null;
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) return null;
    if (normalized.length > max) throw new BadRequestException(`Filter must be at most ${max} characters`);
    return normalized;
  }

  private parsePrice(value: string | undefined, field: string) {
    if (value === undefined || value.trim() === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000_000) {
      throw new BadRequestException(`${field} must be a non-negative price`);
    }
    return Math.round(parsed * 100);
  }

  private parseBoolean(value: string | undefined, field: string): boolean | null {
    if (value === undefined || value === "") return null;
    const normalized = value.toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
    throw new BadRequestException(`${field} must be true or false`);
  }

  private parseEnum<T extends string>(value: string | undefined, field: string, values: readonly T[]): T | null {
    if (value === undefined || value === "") return null;
    const normalized = value.trim().toUpperCase() as T;
    if (!values.includes(normalized)) {
      throw new BadRequestException(`${field} must be one of: ${values.join(", ")}`);
    }
    return normalized;
  }

  private queryTokens(value: string) {
    return this.normalize(value)
      .split(" ")
      .filter((token) => token.length > 1 && !ignoredTokens.has(token));
  }

  private normalize(value: string) {
    return value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}@]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  private textMatches(expected: string | null, candidate: string | null | undefined) {
    if (!expected || !candidate) return false;
    const left = this.normalize(expected);
    const right = this.normalize(candidate);
    return right === left || right.includes(left) || left.includes(right);
  }

  private locationMatches(expected: string | null, candidate: string | null | undefined) {
    if (!expected || !candidate) return false;
    const left = this.normalize(expected);
    const right = this.normalize(candidate);
    if (left === right || left.includes(right) || right.includes(left)) return true;
    const leftCity = left.split(" ")[0];
    const rightCity = right.split(" ")[0];
    return Boolean(leftCity && rightCity && leftCity === rightCity);
  }

  private recencyScore(date: Date, max: number) {
    const hours = Math.max(0, (Date.now() - date.getTime()) / 3_600_000);
    if (hours <= 24) return max;
    if (hours <= 72) return Math.round(max * 0.85);
    if (hours <= 168) return Math.round(max * 0.65);
    if (hours <= 720) return Math.round(max * 0.4);
    return Math.round(max * 0.15);
  }

  private unique(values: string[]) {
    return [...new Set(values)];
  }
}
