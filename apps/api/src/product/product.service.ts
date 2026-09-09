import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProductStatus, ProductType, ProfessionalProfileStatus } from "@prisma/client";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { PrismaService } from "../database/prisma.service";

export interface SaveProductInput {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  mediaUrls?: unknown;
  type?: unknown;
  priceMinor?: unknown;
  trackInventory?: unknown;
  inventoryQuantity?: unknown;
  deliveryInformation?: unknown;
}

export interface SaveProductVariantInput {
  name?: unknown;
  sku?: unknown;
  optionValues?: unknown;
  priceOverrideMinor?: unknown;
  inventoryQuantity?: unknown;
  isActive?: unknown;
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(identity: AuthIdentity) {
    const profile = await this.requireOwnerProfile(identity);
    return this.prisma.product.findMany({
      where: { professionalProfileId: profile.id },
      include: { variants: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" }
    });
  }

  async create(identity: AuthIdentity, input: SaveProductInput) {
    const profile = await this.requireOwnerProfile(identity);
    const product = await this.prisma.product.create({
      data: { professionalProfileId: profile.id, ...this.normalizeProductInput(input) }
    });
    await this.prisma.systemEvent.create({
      data: {
        name: "product.created",
        source: "api",
        payload: { productId: product.id, professionalProfileId: profile.id, userId: profile.userId }
      }
    });
    return this.getMine(identity, product.id);
  }

  async getMine(identity: AuthIdentity, productId: string) {
    const profile = await this.requireOwnerProfile(identity);
    return this.requireOwnedProduct(profile.id, productId);
  }

  async save(identity: AuthIdentity, productId: string, input: SaveProductInput) {
    const profile = await this.requireOwnerProfile(identity);
    await this.requireOwnedProduct(profile.id, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: this.normalizeProductInput(input)
    });
    return this.requireOwnedProduct(profile.id, productId);
  }

  async createVariant(identity: AuthIdentity, productId: string, input: SaveProductVariantInput) {
    const profile = await this.requireOwnerProfile(identity);
    await this.requireOwnedProduct(profile.id, productId);

    const name = this.requiredText(input.name, "name", 120);
    const sku = this.optionalText(input.sku, "sku", 120);
    const optionValues = this.optionalOptionValues(input.optionValues);
    const priceOverrideMinor = this.optionalMoney(input.priceOverrideMinor, "priceOverrideMinor");
    const inventoryQuantity = this.optionalInventoryQuantity(input.inventoryQuantity);
    const isActive = this.optionalBoolean(input.isActive, "isActive");

    return this.withSkuConflict(() => this.prisma.productVariant.create({
      data: {
        productId,
        name,
        ...(sku !== undefined ? { sku } : {}),
        ...(optionValues !== undefined ? { optionValues } : {}),
        ...(priceOverrideMinor !== undefined ? { priceOverrideMinor } : {}),
        ...(inventoryQuantity !== undefined ? { inventoryQuantity } : {}),
        ...(isActive !== undefined ? { isActive } : {})
      }
    }));
  }

  async saveVariant(identity: AuthIdentity, productId: string, variantId: string, input: SaveProductVariantInput) {
    const profile = await this.requireOwnerProfile(identity);
    await this.requireOwnedProduct(profile.id, productId);
    await this.requireOwnedVariant(productId, variantId);

    const name = this.optionalNonEmptyText(input.name, "name", 120);
    const sku = this.optionalText(input.sku, "sku", 120);
    const optionValues = this.optionalOptionValues(input.optionValues);
    const priceOverrideMinor = this.optionalMoney(input.priceOverrideMinor, "priceOverrideMinor");
    const inventoryQuantity = this.optionalInventoryQuantity(input.inventoryQuantity);
    const isActive = this.optionalBoolean(input.isActive, "isActive");

    return this.withSkuConflict(() => this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sku !== undefined ? { sku } : {}),
        ...(optionValues !== undefined ? { optionValues } : {}),
        ...(priceOverrideMinor !== undefined ? { priceOverrideMinor } : {}),
        ...(inventoryQuantity !== undefined ? { inventoryQuantity } : {}),
        ...(isActive !== undefined ? { isActive } : {})
      }
    }));
  }

  async removeVariant(identity: AuthIdentity, productId: string, variantId: string) {
    const profile = await this.requireOwnerProfile(identity);
    await this.requireOwnedProduct(profile.id, productId);
    const variant = await this.requireOwnedVariant(productId, variantId);
    await this.prisma.productVariant.delete({ where: { id: variant.id } });
    return { deleted: true, id: variant.id };
  }

  async publish(identity: AuthIdentity, productId: string) {
    const profile = await this.requireOwnerProfile(identity);
    const product = await this.requireOwnedProduct(profile.id, productId);

    if (profile.status !== ProfessionalProfileStatus.PUBLISHED) {
      throw new BadRequestException("Publish your professional profile before publishing a product");
    }

    const missing: string[] = [];
    if (!product.title) missing.push("title");
    if (!product.category) missing.push("category");
    if (!product.description) missing.push("description");
    if (product.mediaUrls.length === 0) missing.push("mediaUrls");
    if (product.priceMinor === null) missing.push("price");
    if (product.type === ProductType.PHYSICAL && !product.deliveryInformation) missing.push("deliveryInformation");
    if (product.trackInventory && product.inventoryQuantity === null) missing.push("inventoryQuantity");

    if (missing.length > 0) {
      throw new BadRequestException(`Complete these fields before publishing: ${missing.join(", ")}`);
    }

    const publishedAt = product.publishedAt ?? new Date();
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: product.id },
        data: { status: ProductStatus.PUBLISHED, publishedAt }
      }),
      this.prisma.systemEvent.create({
        data: {
          name: "product.published",
          source: "api",
          payload: { productId: product.id, professionalProfileId: profile.id, userId: profile.userId }
        }
      })
    ]);
    return this.requireOwnedProduct(profile.id, product.id);
  }

  async pause(identity: AuthIdentity, productId: string) {
    const profile = await this.requireOwnerProfile(identity);
    const product = await this.requireOwnedProduct(profile.id, productId);
    if (product.status === ProductStatus.PAUSED) return product;
    if (product.status !== ProductStatus.PUBLISHED) {
      throw new BadRequestException("Only a published product can be paused");
    }

    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id: product.id }, data: { status: ProductStatus.PAUSED } }),
      this.prisma.systemEvent.create({
        data: {
          name: "product.paused",
          source: "api",
          payload: { productId: product.id, professionalProfileId: profile.id, userId: profile.userId }
        }
      })
    ]);
    return this.requireOwnedProduct(profile.id, product.id);
  }

  async remove(identity: AuthIdentity, productId: string) {
    const profile = await this.requireOwnerProfile(identity);
    const product = await this.requireOwnedProduct(profile.id, productId);
    if (product.status === ProductStatus.PUBLISHED) {
      throw new BadRequestException("Pause a published product before deleting it");
    }

    await this.prisma.$transaction([
      this.prisma.product.delete({ where: { id: product.id } }),
      this.prisma.systemEvent.create({
        data: {
          name: "product.deleted",
          source: "api",
          payload: { productId: product.id, professionalProfileId: profile.id, userId: profile.userId }
        }
      })
    ]);
    return { deleted: true, id: product.id };
  }

  private async requireOwnerProfile(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: { where: { capability: "HUSTLER" }, select: { status: true } },
        professionalProfile: true
      }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    if (user.capabilities[0]?.status !== "ACTIVE") {
      throw new BadRequestException("An ACTIVE HUSTLER capability is required");
    }
    if (!user.professionalProfile) {
      throw new BadRequestException("Create your professional profile before creating products");
    }
    return user.professionalProfile;
  }

  private async requireOwnedProduct(profileId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, professionalProfileId: profileId },
      include: { variants: { orderBy: { createdAt: "asc" } } }
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  private async requireOwnedVariant(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw new NotFoundException("Product variant not found");
    return variant;
  }

  private normalizeProductInput(input: SaveProductInput) {
    const title = this.optionalText(input.title, "title", 160);
    const description = this.optionalText(input.description, "description", 5000);
    const category = this.optionalText(input.category, "category", 100);
    const mediaUrls = this.optionalUrls(input.mediaUrls);
    const type = this.optionalProductType(input.type);
    const priceMinor = this.optionalMoney(input.priceMinor, "priceMinor");
    const trackInventory = this.optionalBoolean(input.trackInventory, "trackInventory");
    const inventoryQuantity = this.optionalInventoryQuantity(input.inventoryQuantity);
    const deliveryInformation = this.optionalText(input.deliveryInformation, "deliveryInformation", 1500);
    return {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(mediaUrls !== undefined ? { mediaUrls } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(priceMinor !== undefined ? { priceMinor } : {}),
      ...(trackInventory !== undefined ? { trackInventory } : {}),
      ...(inventoryQuantity !== undefined ? { inventoryQuantity } : {}),
      ...(deliveryInformation !== undefined ? { deliveryInformation } : {})
    };
  }

  private requiredText(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
    const normalized = value.trim();
    if (normalized.length > maxLength) throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    return normalized;
  }

  private optionalNonEmptyText(value: unknown, field: string, maxLength: number): string | undefined {
    if (value === undefined) return undefined;
    return this.requiredText(value, field, maxLength);
  }

  private optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maxLength) throw new BadRequestException(`${field} must be at most ${maxLength} characters`);
    return normalized;
  }

  private optionalUrls(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) throw new BadRequestException("mediaUrls must be a list");
    if (value.length > 10) throw new BadRequestException("A product can have at most 10 media items");
    return value.map((item) => {
      if (typeof item !== "string") throw new BadRequestException("mediaUrls must contain text values only");
      const normalized = item.trim();
      if (!normalized) throw new BadRequestException("mediaUrls cannot contain empty values");
      if (normalized.length > 1200) throw new BadRequestException("Each media URL must be at most 1200 characters");
      try {
        const url = new URL(normalized);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
        return url.toString();
      } catch {
        throw new BadRequestException("Each media item must be a valid http or https URL");
      }
    });
  }

  private optionalProductType(value: unknown): ProductType | undefined {
    if (value === undefined) return undefined;
    if (!Object.values(ProductType).includes(value as ProductType)) throw new BadRequestException("Invalid product type");
    return value as ProductType;
  }

  private optionalMoney(value: unknown, field: string): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(amount) || amount < 0 || amount > 2_000_000_000) {
      throw new BadRequestException(`${field} must be an integer between 0 and 2000000000`);
    }
    return amount;
  }

  private optionalInventoryQuantity(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    const quantity = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 2_000_000_000) {
      throw new BadRequestException("inventoryQuantity must be an integer between 0 and 2000000000");
    }
    return quantity;
  }

  private optionalBoolean(value: unknown, field: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") throw new BadRequestException(`${field} must be true or false`);
    return value;
  }

  private optionalOptionValues(value: unknown): Record<string, string> | undefined {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("optionValues must be an object of text values");
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 12) throw new BadRequestException("A variant can have at most 12 option values");
    const normalized: Record<string, string> = {};
    for (const [rawKey, rawValue] of entries) {
      const key = rawKey.trim();
      if (!key || key.length > 60) throw new BadRequestException("Variant option names must be between 1 and 60 characters");
      if (typeof rawValue !== "string") throw new BadRequestException("Variant option values must be text");
      const option = rawValue.trim();
      if (!option || option.length > 120) throw new BadRequestException("Variant option values must be between 1 and 120 characters");
      normalized[key] = option;
    }
    return normalized;
  }

  private async withSkuConflict<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("SKU must be unique within this product");
      }
      throw error;
    }
  }
}
