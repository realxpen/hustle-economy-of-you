import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Capability,
  CapabilityStatus,
  OrderInventorySource,
  OrderStatus,
  Prisma,
  ProductStatus,
  ProductType,
  ProfessionalProfileStatus
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface AddCartItemInput {
  productId?: unknown;
  productVariantId?: unknown;
  quantity?: unknown;
}

export interface UpdateCartItemInput {
  quantity?: unknown;
}

export interface CheckoutInput {
  deliveryName?: unknown;
  deliveryPhone?: unknown;
  deliveryAddress?: unknown;
  deliveryCity?: unknown;
  deliveryState?: unknown;
  deliveryCountry?: unknown;
  deliveryNote?: unknown;
}

export interface OrderPaginationInput {
  cursor?: unknown;
  limit?: unknown;
}

export interface AuthoritativeOrderPaymentInput {
  orderId: string;
  paymentReference: string;
  source?: string;
}

const commerceUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  location: true,
  emailVerified: true,
  phoneVerified: true,
  capabilities: {
    where: { capability: Capability.HUSTLER },
    select: { status: true }
  }
} satisfies Prisma.UserSelect;

const cartItemInclude = {
  product: {
    include: {
      professionalProfile: {
        select: {
          id: true,
          status: true,
          user: { select: commerceUserSelect }
        }
      },
      variants: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" as const }
      }
    }
  },
  productVariant: true
} satisfies Prisma.CartItemInclude;

const orderSelect = {
  id: true,
  buyerUserId: true,
  sellerUserId: true,
  status: true,
  currency: true,
  subtotalMinor: true,
  totalMinor: true,
  deliveryName: true,
  deliveryPhone: true,
  deliveryAddress: true,
  deliveryCity: true,
  deliveryState: true,
  deliveryCountry: true,
  deliveryNote: true,
  paymentReference: true,
  paidAt: true,
  processingAt: true,
  shippedAt: true,
  deliveredAt: true,
  completedAt: true,
  cancelledAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
  buyer: { select: commerceUserSelect },
  seller: { select: commerceUserSelect },
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      productId: true,
      productVariantId: true,
      productTitleSnapshot: true,
      variantNameSnapshot: true,
      skuSnapshot: true,
      optionValuesSnapshot: true,
      productTypeSnapshot: true,
      unitPriceMinor: true,
      quantity: true,
      lineTotalMinor: true,
      inventorySource: true,
      createdAt: true
    }
  }
} satisfies Prisma.OrderSelect;

type CartItemRecord = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;
type OrderRecord = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

type AssessedCartItem = {
  cartItemId: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  sellerId: string;
  seller: ReturnType<CommerceService["serializeUser"]>;
  currency: string;
  productTitle: string;
  variantName: string | null;
  sku: string | null;
  optionValues: Prisma.JsonValue | null;
  productType: ProductType;
  unitPriceMinor: number;
  lineTotalMinor: number;
  inventorySource: OrderInventorySource;
  inventoryAvailable: number | null;
  available: boolean;
  reason: string | null;
};

@Injectable()
export class CommerceService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const cart = await this.getOrCreateCart(user.id);
    return this.serializeCart(cart);
  }

  async addCartItem(identity: AuthIdentity, input: AddCartItemInput) {
    const user = await this.requireUser(identity);
    const productId = this.requiredId(input.productId, "productId");
    const productVariantId = this.optionalId(input.productVariantId, "productVariantId");
    const quantity = this.quantity(input.quantity, 1);
    const product = await this.requireEligibleProduct(productId);
    const assessed = this.assessProductSelection(product, productVariantId, quantity);

    if (assessed.sellerId === user.id) {
      throw new BadRequestException("You cannot add your own Product to your Cart");
    }
    this.requireAvailableQuantity(assessed);

    const cart = await this.getOrCreateCart(user.id);
    const itemKey = `${productId}:${productVariantId ?? "base"}`;
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_itemKey: { cartId: cart.id, itemKey } },
      select: { id: true, quantity: true }
    });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > 99) throw new BadRequestException("Cart item quantity cannot exceed 99");
    this.requireAvailableQuantity({ ...assessed, quantity: nextQuantity });

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
      } else {
        await tx.cartItem.create({
          data: { cartId: cart.id, productId, productVariantId, itemKey, quantity }
        });
      }
      await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
      await tx.systemEvent.create({
        data: {
          name: "cart.item_added",
          source: "api",
          payload: { userId: user.id, cartId: cart.id, productId, productVariantId, quantity, resultingQuantity: nextQuantity }
        }
      });
    });

    return this.getCart(identity);
  }

  async updateCartItem(identity: AuthIdentity, itemId: string, input: UpdateCartItemInput) {
    const user = await this.requireUser(identity);
    const id = this.requiredId(itemId, "itemId");
    const quantity = this.quantity(input.quantity);
    const item = await this.requireOwnedCartItem(user.id, id);
    const assessed = this.assessCartItem(item);
    this.requireAvailableQuantity({ ...assessed, quantity });

    await this.prisma.$transaction([
      this.prisma.cartItem.update({ where: { id }, data: { quantity } }),
      this.prisma.cart.update({ where: { id: item.cartId }, data: { version: { increment: 1 } } }),
      this.prisma.systemEvent.create({
        data: {
          name: "cart.item_updated",
          source: "api",
          payload: { userId: user.id, cartId: item.cartId, cartItemId: id, productId: item.productId, quantity }
        }
      })
    ]);
    return this.getCart(identity);
  }

  async removeCartItem(identity: AuthIdentity, itemId: string) {
    const user = await this.requireUser(identity);
    const id = this.requiredId(itemId, "itemId");
    const item = await this.requireOwnedCartItem(user.id, id);
    await this.prisma.$transaction([
      this.prisma.cartItem.delete({ where: { id } }),
      this.prisma.cart.update({ where: { id: item.cartId }, data: { version: { increment: 1 } } }),
      this.prisma.systemEvent.create({
        data: {
          name: "cart.item_removed",
          source: "api",
          payload: { userId: user.id, cartId: item.cartId, cartItemId: id, productId: item.productId }
        }
      })
    ]);
    return this.getCart(identity);
  }

  async clearCart(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const cart = await this.getOrCreateCart(user.id);
    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
      await tx.systemEvent.create({
        data: {
          name: "cart.cleared",
          source: "api",
          payload: { userId: user.id, cartId: cart.id, removedItems: result.count }
        }
      });
      return result.count;
    });
    return { cleared: true, removedItems: deleted, cart: await this.getCart(identity) };
  }

  async checkoutPreview(identity: AuthIdentity) {
    const user = await this.requireUser(identity);
    const snapshot = await this.checkoutSnapshot(user.id);
    await this.recordEvent("checkout.previewed", {
      userId: user.id,
      cartId: snapshot.cartId,
      itemCount: snapshot.items.length,
      sellerGroups: snapshot.groups.length
    });
    return this.serializeCheckoutSnapshot(snapshot);
  }

  async checkout(identity: AuthIdentity, input: CheckoutInput) {
    const user = await this.requireUser(identity);
    const parsedDelivery = this.parseDeliveryInput(input);

    try {
      const orderIds = await this.prisma.$transaction(async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { userId: user.id },
          include: { items: { include: cartItemInclude, orderBy: { createdAt: "asc" } } }
        });
        if (!cart || cart.items.length === 0) throw new BadRequestException("Your Cart is empty");

        const assessed = cart.items.map((item) => this.assessCartItem(item));
        this.requireCheckoutItems(assessed, user.id);
        const groups = this.groupItems(assessed);
        const requiresDelivery = groups.some((group) => group.requiresDelivery);
        const delivery = requiresDelivery ? this.requirePhysicalDelivery(parsedDelivery) : parsedDelivery;

        const claimed = await tx.cart.updateMany({
          where: { id: cart.id, version: cart.version },
          data: { version: { increment: 1 } }
        });
        if (claimed.count !== 1) {
          throw new ConflictException("Your Cart changed during checkout. Review it and try again");
        }

        const createdIds: string[] = [];
        for (const group of groups) {
          const subtotalMinor = group.items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
          const order = await tx.order.create({
            data: {
              buyerUserId: user.id,
              sellerUserId: group.sellerId,
              currency: group.currency,
              subtotalMinor,
              totalMinor: subtotalMinor,
              ...(group.requiresDelivery
                ? {
                    deliveryName: delivery.deliveryName,
                    deliveryPhone: delivery.deliveryPhone,
                    deliveryAddress: delivery.deliveryAddress,
                    deliveryCity: delivery.deliveryCity,
                    deliveryState: delivery.deliveryState,
                    deliveryCountry: delivery.deliveryCountry,
                    deliveryNote: delivery.deliveryNote
                  }
                : {}),
              items: {
                create: group.items.map((item) => ({
                  productId: item.productId,
                  productVariantId: item.productVariantId,
                  productTitleSnapshot: item.productTitle,
                  variantNameSnapshot: item.variantName,
                  skuSnapshot: item.sku,
                  optionValuesSnapshot: item.optionValues === null ? Prisma.JsonNull : item.optionValues,
                  productTypeSnapshot: item.productType,
                  unitPriceMinor: item.unitPriceMinor,
                  quantity: item.quantity,
                  lineTotalMinor: item.lineTotalMinor,
                  inventorySource: item.inventorySource
                }))
              }
            },
            select: { id: true }
          });
          createdIds.push(order.id);
          await tx.systemEvent.create({
            data: {
              name: "order.created",
              source: "api",
              payload: {
                orderId: order.id,
                buyerUserId: user.id,
                sellerUserId: group.sellerId,
                status: OrderStatus.PENDING,
                currency: group.currency,
                subtotalMinor,
                itemCount: group.items.length,
                requiresDelivery: group.requiresDelivery
              }
            }
          });
        }

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.systemEvent.create({
          data: {
            name: "cart.checked_out",
            source: "api",
            payload: { userId: user.id, cartId: cart.id, orderIds: createdIds, itemCount: assessed.length }
          }
        });
        return createdIds;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      const orders = await this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: orderSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });
      return {
        orders: orders.map((order) => this.serializeOrder(order, user.id)),
        paymentBoundary: {
          phase: "PHASE_13",
          status: OrderStatus.PENDING,
          message: "Orders are created as PENDING. Only authoritative Phase 13 payment confirmation can mark them PAID."
        }
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("Checkout conflicted with another Cart update. Review the Cart and try again");
      }
      throw error;
    }
  }

  async listBuyerOrders(identity: AuthIdentity, input: OrderPaginationInput) {
    const user = await this.requireUser(identity);
    return this.listOrders(user.id, "buyer", input);
  }

  async listSellerOrders(identity: AuthIdentity, input: OrderPaginationInput) {
    const user = await this.requireUser(identity);
    return this.listOrders(user.id, "seller", input);
  }

  async getOrder(identity: AuthIdentity, orderId: string) {
    const user = await this.requireUser(identity);
    const order = await this.requireOrderParticipant(this.requiredId(orderId, "orderId"), user.id);
    return this.serializeOrder(order, user.id);
  }

  /**
   * Phase 13 integration boundary. Deliberately not exposed by CommerceController.
   * The future payment module must call this only after an idempotently verified
   * payment/escrow confirmation. Inventory is deducted here, not when a Cart or
   * PENDING Order is created.
   */
  async markPaidFromAuthoritativePayment(input: AuthoritativeOrderPaymentInput) {
    const orderId = this.requiredId(input.orderId, "orderId");
    const paymentReference = this.requiredText(input.paymentReference, "paymentReference", 300);
    const existing = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!existing) throw new NotFoundException("Order not found");
    if (existing.status !== OrderStatus.PENDING) {
      if (existing.paymentReference === paymentReference && existing.paidAt) {
        return this.serializeOrder(existing, existing.buyerUserId);
      }
      throw new ConflictException(`Order cannot be paid from ${existing.status}`);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const transitioned = await tx.order.updateMany({
          where: { id: orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.PAID, paymentReference, paidAt: new Date() }
        });
        if (transitioned.count !== 1) {
          throw new ConflictException("Order changed before payment confirmation completed");
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            items: {
              select: {
                productId: true,
                productVariantId: true,
                quantity: true,
                inventorySource: true
              }
            }
          }
        });
        if (!order) throw new NotFoundException("Order not found");

        for (const item of order.items) {
          if (item.inventorySource === OrderInventorySource.NONE) continue;
          if (item.inventorySource === OrderInventorySource.VARIANT) {
            if (!item.productVariantId) throw new ConflictException("Order inventory metadata is invalid");
            const updated = await tx.productVariant.updateMany({
              where: { id: item.productVariantId, inventoryQuantity: { gte: item.quantity } },
              data: { inventoryQuantity: { decrement: item.quantity } }
            });
            if (updated.count !== 1) throw new ConflictException("A Product variant no longer has enough stock for this Order");
          } else {
            const updated = await tx.product.updateMany({
              where: { id: item.productId, inventoryQuantity: { gte: item.quantity } },
              data: { inventoryQuantity: { decrement: item.quantity } }
            });
            if (updated.count !== 1) throw new ConflictException("A Product no longer has enough stock for this Order");
          }
        }

        await tx.systemEvent.create({
          data: {
            name: "order.paid",
            source: "api",
            payload: {
              orderId,
              paymentReference,
              source: input.source ?? "phase13",
              status: OrderStatus.PAID
            }
          }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw new ConflictException("paymentReference has already been used");
        if (error.code === "P2034") throw new ConflictException("Payment confirmation conflicted with another inventory update. Retry safely");
      }
      throw error;
    }

    const paid = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!paid) throw new NotFoundException("Order not found");
    return this.serializeOrder(paid, paid.buyerUserId);
  }

  private async getOrCreateCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: cartItemInclude, orderBy: { createdAt: "asc" } } }
    });
  }

  private async requireOwnedCartItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { is: { userId } } },
      include: { ...cartItemInclude, cart: { select: { id: true } } }
    });
    if (!item) throw new NotFoundException("Cart item not found");
    return item;
  }

  private async requireEligibleProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
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
      include: cartItemInclude.product.include
    });
    if (!product) throw new NotFoundException("Product is not currently purchasable");
    return product;
  }

  private assessProductSelection(
    product: CartItemRecord["product"],
    productVariantId: string | null,
    quantity: number
  ): Omit<AssessedCartItem, "cartItemId"> {
    const activeVariants = product.variants;
    const variant = productVariantId ? activeVariants.find((candidate) => candidate.id === productVariantId) ?? null : null;
    const seller = product.professionalProfile.user;
    let reason: string | null = null;

    if (product.status !== ProductStatus.PUBLISHED) reason = "Product is no longer published";
    else if (product.professionalProfile.status !== ProfessionalProfileStatus.PUBLISHED) reason = "Seller profile is not currently published";
    else if (seller.capabilities[0]?.status !== CapabilityStatus.ACTIVE) reason = "Seller is not currently active";
    else if (!product.title?.trim()) reason = "Product is missing a title";
    else if (product.priceMinor === null) reason = "Product is missing a price";
    else if (productVariantId && !variant) reason = "Selected variant is no longer available";
    else if (!productVariantId && activeVariants.length > 0) reason = "Choose a Product variant";

    const unitPriceMinor = variant?.priceOverrideMinor ?? product.priceMinor ?? 0;
    let inventorySource = OrderInventorySource.NONE;
    let inventoryAvailable: number | null = null;
    if (product.trackInventory) {
      if (variant?.inventoryQuantity !== null && variant?.inventoryQuantity !== undefined) {
        inventorySource = OrderInventorySource.VARIANT;
        inventoryAvailable = variant.inventoryQuantity;
      } else {
        inventorySource = OrderInventorySource.PRODUCT;
        inventoryAvailable = product.inventoryQuantity;
      }
      if (inventoryAvailable === null) reason = reason ?? "Inventory is not configured";
      else if (inventoryAvailable < quantity) reason = reason ?? "Not enough stock is available";
    }

    return {
      productId: product.id,
      productVariantId: variant?.id ?? productVariantId,
      quantity,
      sellerId: seller.id,
      seller: this.serializeUser(seller),
      currency: product.currency,
      productTitle: product.title?.trim() || "Product",
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? null,
      optionValues: variant?.optionValues ?? null,
      productType: product.type,
      unitPriceMinor,
      lineTotalMinor: unitPriceMinor * quantity,
      inventorySource,
      inventoryAvailable,
      available: reason === null,
      reason
    };
  }

  private assessCartItem(item: CartItemRecord): AssessedCartItem {
    return {
      cartItemId: item.id,
      ...this.assessProductSelection(item.product, item.productVariantId, item.quantity)
    };
  }

  private requireAvailableQuantity(item: Pick<AssessedCartItem, "available" | "reason" | "inventoryAvailable" | "quantity">) {
    if (!item.available) throw new ConflictException(item.reason ?? "Cart item is unavailable");
    if (item.inventoryAvailable !== null && item.quantity > item.inventoryAvailable) {
      throw new ConflictException(`Only ${item.inventoryAvailable} item(s) are currently in stock`);
    }
  }

  private serializeCart(cart: { id: string; userId: string; version: number; updatedAt: Date; items: CartItemRecord[] }) {
    const items = cart.items.map((item) => this.assessCartItem(item));
    const currencies = [...new Set(items.map((item) => item.currency))];
    return {
      id: cart.id,
      userId: cart.userId,
      version: cart.version,
      items: items.map((item) => ({
        id: item.cartItemId,
        productId: item.productId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        productTitle: item.productTitle,
        variantName: item.variantName,
        seller: item.seller,
        productType: item.productType,
        currency: item.currency,
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: item.lineTotalMinor,
        inventoryAvailable: item.inventoryAvailable,
        available: item.available,
        availabilityReason: item.reason,
        productUrl: `/products/${item.productId}`
      })),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totals: currencies.map((currency) => ({
        currency,
        subtotalMinor: items.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.lineTotalMinor, 0)
      })),
      updatedAt: cart.updatedAt
    };
  }

  private async checkoutSnapshot(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: cartItemInclude, orderBy: { createdAt: "asc" } } }
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException("Your Cart is empty");
    const items = cart.items.map((item) => this.assessCartItem(item));
    this.requireCheckoutItems(items, userId);
    return { cartId: cart.id, cartVersion: cart.version, items, groups: this.groupItems(items) };
  }

  private requireCheckoutItems(items: AssessedCartItem[], buyerUserId: string) {
    for (const item of items) {
      if (item.sellerId === buyerUserId) throw new BadRequestException("You cannot checkout your own Product");
      this.requireAvailableQuantity(item);
    }
  }

  private groupItems(items: AssessedCartItem[]) {
    const groups = new Map<string, { sellerId: string; seller: AssessedCartItem["seller"]; currency: string; requiresDelivery: boolean; items: AssessedCartItem[] }>();
    for (const item of items) {
      const key = `${item.sellerId}:${item.currency}`;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
        existing.requiresDelivery ||= item.productType === ProductType.PHYSICAL;
      } else {
        groups.set(key, {
          sellerId: item.sellerId,
          seller: item.seller,
          currency: item.currency,
          requiresDelivery: item.productType === ProductType.PHYSICAL,
          items: [item]
        });
      }
    }
    return [...groups.values()];
  }

  private serializeCheckoutSnapshot(snapshot: Awaited<ReturnType<CommerceService["checkoutSnapshot"]>>) {
    return {
      cartId: snapshot.cartId,
      itemCount: snapshot.items.length,
      groups: snapshot.groups.map((group) => ({
        seller: group.seller,
        currency: group.currency,
        requiresDelivery: group.requiresDelivery,
        subtotalMinor: group.items.reduce((sum, item) => sum + item.lineTotalMinor, 0),
        items: group.items.map((item) => ({
          cartItemId: item.cartItemId,
          productId: item.productId,
          productVariantId: item.productVariantId,
          productTitle: item.productTitle,
          variantName: item.variantName,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.lineTotalMinor,
          currency: item.currency,
          productType: item.productType,
          inventoryAvailable: item.inventoryAvailable
        }))
      })),
      inventoryPolicy: "Cart and PENDING Orders do not reserve stock. Phase 13 payment confirmation revalidates and deducts inventory atomically."
    };
  }

  private async listOrders(userId: string, side: "buyer" | "seller", input: OrderPaginationInput) {
    const limit = this.parseLimit(input.limit, 20, 50);
    const cursor = this.decodeCursor(input.cursor);
    const sideWhere = side === "buyer" ? { buyerUserId: userId } : { sellerUserId: userId };
    const rows = await this.prisma.order.findMany({
      where: {
        ...sideWhere,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.timestamp } },
                { createdAt: cursor.timestamp, id: { lt: cursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: orderSelect
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    return {
      items: page.map((order) => this.serializeOrder(order, userId)),
      nextCursor: hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null,
      hasMore
    };
  }

  private async requireOrderParticipant(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      select: orderSelect
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private serializeOrder(order: OrderRecord, viewerUserId: string) {
    const viewerRole = order.buyerUserId === viewerUserId ? "BUYER" : "SELLER";
    return {
      ...order,
      buyer: this.serializeUser(order.buyer),
      seller: this.serializeUser(order.seller),
      viewerRole,
      paymentBoundary: {
        phase: "PHASE_13",
        paid: order.paidAt !== null,
        message: order.status === OrderStatus.PENDING
          ? "Payment is pending. Only authoritative Phase 13 payment confirmation can mark this Order PAID and deduct inventory."
          : null
      },
      nextAction: order.status === OrderStatus.PENDING
        ? viewerRole === "BUYER" ? "Await payment capability in Phase 13" : "Waiting for authoritative payment confirmation"
        : null
    };
  }

  private serializeUser(user: Prisma.UserGetPayload<{ select: typeof commerceUserSelect }>) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      location: user.location,
      verified: user.emailVerified || user.phoneVerified
    };
  }

  private parseDeliveryInput(input: CheckoutInput) {
    return {
      deliveryName: this.optionalText(input.deliveryName, "deliveryName", 160),
      deliveryPhone: this.optionalText(input.deliveryPhone, "deliveryPhone", 60),
      deliveryAddress: this.optionalText(input.deliveryAddress, "deliveryAddress", 500),
      deliveryCity: this.optionalText(input.deliveryCity, "deliveryCity", 120),
      deliveryState: this.optionalText(input.deliveryState, "deliveryState", 120),
      deliveryCountry: this.optionalText(input.deliveryCountry, "deliveryCountry", 120) ?? "Nigeria",
      deliveryNote: this.optionalText(input.deliveryNote, "deliveryNote", 1000)
    };
  }

  private requirePhysicalDelivery(delivery: ReturnType<CommerceService["parseDeliveryInput"]>) {
    if (!delivery.deliveryName) throw new BadRequestException("deliveryName is required for physical Products");
    if (!delivery.deliveryPhone) throw new BadRequestException("deliveryPhone is required for physical Products");
    if (!delivery.deliveryAddress) throw new BadRequestException("deliveryAddress is required for physical Products");
    if (!delivery.deliveryCity) throw new BadRequestException("deliveryCity is required for physical Products");
    return delivery as typeof delivery & {
      deliveryName: string;
      deliveryPhone: string;
      deliveryAddress: string;
      deliveryCity: string;
      deliveryCountry: string;
    };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private async recordEvent(name: string, payload: Prisma.InputJsonObject) {
    await this.prisma.systemEvent.create({ data: { name, source: "api", payload } });
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }

  private requiredText(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} is required`);
    const normalized = value.trim();
    if (normalized.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
    return normalized;
  }

  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
    return normalized;
  }

  private quantity(value: unknown, fallback?: number) {
    if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
      throw new BadRequestException("quantity must be an integer between 1 and 99");
    }
    return parsed;
  }

  private parseLimit(value: unknown, fallback: number, max: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
      throw new BadRequestException(`limit must be an integer between 1 and ${max}`);
    }
    return parsed;
  }

  private encodeCursor(timestamp: Date, id: string) {
    return Buffer.from(JSON.stringify({ t: timestamp.toISOString(), id }), "utf8").toString("base64url");
  }

  private decodeCursor(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException("Invalid order cursor");
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { t?: unknown; id?: unknown };
      if (typeof parsed.t !== "string" || typeof parsed.id !== "string") throw new Error("invalid");
      const timestamp = new Date(parsed.t);
      if (Number.isNaN(timestamp.getTime()) || !parsed.id) throw new Error("invalid");
      return { timestamp, id: parsed.id };
    } catch {
      throw new BadRequestException("Invalid order cursor");
    }
  }
}
