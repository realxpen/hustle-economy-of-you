import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Capability, CapabilityStatus, OrderStatus, ProductType } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

const fulfillmentOrderSelect = {
  id: true,
  buyerUserId: true,
  sellerUserId: true,
  status: true,
  paidAt: true,
  processingAt: true,
  shippedAt: true,
  deliveredAt: true,
  completedAt: true,
  cancelledAt: true,
  refundedAt: true,
  items: {
    select: {
      productTypeSnapshot: true
    }
  }
} as const;

@Injectable()
export class FulfillmentService {
  constructor(private readonly prisma: PrismaService) {}

  async process(identity: AuthIdentity, orderId: string) {
    const userId = await this.requireUserId(identity);
    const order = await this.requireOrder(orderId);
    await this.requireSeller(order, userId);
    this.requireStatus(order.status, OrderStatus.PAID, "Only a PAID Order can move to PROCESSING");

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, sellerUserId: userId, status: OrderStatus.PAID },
        data: { status: OrderStatus.PROCESSING, processingAt: now }
      });
      if (updated.count !== 1) throw new ConflictException("Order changed before processing could start. Refresh and try again");
      await tx.systemEvent.create({
        data: {
          name: "order.processing",
          source: "api",
          payload: { orderId: order.id, sellerUserId: userId, status: OrderStatus.PROCESSING }
        }
      });
    });

    return this.getTransitionState(order.id, userId);
  }

  async ship(identity: AuthIdentity, orderId: string) {
    const userId = await this.requireUserId(identity);
    const order = await this.requireOrder(orderId);
    await this.requireSeller(order, userId);
    if (!this.hasPhysicalItems(order)) {
      throw new ConflictException("Digital-only Orders do not use SHIPPED. Mark the Order delivered from PROCESSING instead");
    }
    this.requireStatus(order.status, OrderStatus.PROCESSING, "Only a PROCESSING physical Order can move to SHIPPED");

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, sellerUserId: userId, status: OrderStatus.PROCESSING },
        data: { status: OrderStatus.SHIPPED, shippedAt: now }
      });
      if (updated.count !== 1) throw new ConflictException("Order changed before shipping could be recorded. Refresh and try again");
      await tx.systemEvent.create({
        data: {
          name: "order.shipped",
          source: "api",
          payload: { orderId: order.id, sellerUserId: userId, status: OrderStatus.SHIPPED }
        }
      });
    });

    return this.getTransitionState(order.id, userId);
  }

  async deliver(identity: AuthIdentity, orderId: string) {
    const userId = await this.requireUserId(identity);
    const order = await this.requireOrder(orderId);
    await this.requireSeller(order, userId);
    const physical = this.hasPhysicalItems(order);
    const expected = physical ? OrderStatus.SHIPPED : OrderStatus.PROCESSING;
    const message = physical
      ? "A physical Order must be SHIPPED before it can be marked DELIVERED"
      : "A digital-only Order must be PROCESSING before it can be marked DELIVERED";
    this.requireStatus(order.status, expected, message);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, sellerUserId: userId, status: expected },
        data: { status: OrderStatus.DELIVERED, deliveredAt: now }
      });
      if (updated.count !== 1) throw new ConflictException("Order changed before delivery could be recorded. Refresh and try again");
      await tx.systemEvent.create({
        data: {
          name: "order.delivered",
          source: "api",
          payload: {
            orderId: order.id,
            sellerUserId: userId,
            status: OrderStatus.DELIVERED,
            fulfillmentType: physical ? "PHYSICAL" : "DIGITAL"
          }
        }
      });
    });

    return this.getTransitionState(order.id, userId);
  }

  async complete(identity: AuthIdentity, orderId: string) {
    const userId = await this.requireUserId(identity);
    const order = await this.requireOrder(orderId);
    if (order.buyerUserId !== userId) throw new ForbiddenException("Only the buyer can confirm Order completion");
    this.requireStatus(order.status, OrderStatus.DELIVERED, "Only a DELIVERED Order can be completed");

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, buyerUserId: userId, status: OrderStatus.DELIVERED },
        data: { status: OrderStatus.COMPLETED, completedAt: now }
      });
      if (updated.count !== 1) throw new ConflictException("Order changed before completion could be confirmed. Refresh and try again");
      await tx.systemEvent.create({
        data: {
          name: "order.completed",
          source: "api",
          payload: { orderId: order.id, buyerUserId: userId, status: OrderStatus.COMPLETED }
        }
      });
    });

    return this.getTransitionState(order.id, userId);
  }

  async cancel(identity: AuthIdentity, orderId: string) {
    const userId = await this.requireUserId(identity);
    const order = await this.requireOrder(orderId);
    const relationship = order.buyerUserId === userId ? "BUYER" : order.sellerUserId === userId ? "SELLER" : null;
    if (!relationship) throw new ForbiddenException("Only the buyer or seller can cancel this Order");
    if (order.status !== OrderStatus.PENDING) {
      if (order.status === OrderStatus.PAID || order.paidAt) {
        throw new ConflictException("Paid Orders cannot be cancelled by Phase 12. Refund execution and REFUNDED state belong to Phase 13");
      }
      throw new ConflictException(`Order cannot be cancelled from ${order.status}`);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED, cancelledAt: now }
      });
      if (updated.count !== 1) throw new ConflictException("Order changed before cancellation completed. Refresh and try again");
      await tx.systemEvent.create({
        data: {
          name: "order.cancelled",
          source: "api",
          payload: { orderId: order.id, actorUserId: userId, actorRelationship: relationship, status: OrderStatus.CANCELLED }
        }
      });
    });

    return this.getTransitionState(order.id, userId);
  }

  private async requireUserId(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user.id;
  }

  private async requireOrder(orderId: string) {
    if (!orderId?.trim()) throw new NotFoundException("Order not found");
    const order = await this.prisma.order.findUnique({
      where: { id: orderId.trim() },
      select: fulfillmentOrderSelect
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private async requireSeller(order: Awaited<ReturnType<FulfillmentService["requireOrder"]>>, userId: string) {
    if (order.sellerUserId !== userId) throw new ForbiddenException("Only the seller can perform this fulfillment action");
    const capability = await this.prisma.userCapability.findUnique({
      where: { userId_capability: { userId, capability: Capability.HUSTLER } },
      select: { status: true }
    });
    if (capability?.status !== CapabilityStatus.ACTIVE) {
      throw new ForbiddenException("Seller fulfillment requires an ACTIVE HUSTLER capability");
    }
  }

  private hasPhysicalItems(order: Awaited<ReturnType<FulfillmentService["requireOrder"]>>) {
    return order.items.some((item) => item.productTypeSnapshot === ProductType.PHYSICAL);
  }

  private requireStatus(actual: OrderStatus, expected: OrderStatus, message: string) {
    if (actual !== expected) throw new ConflictException(message);
  }

  private async getTransitionState(orderId: string, viewerUserId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: fulfillmentOrderSelect
    });
    if (!order) throw new NotFoundException("Order not found");
    const physical = this.hasPhysicalItems(order);
    const viewerRole = order.buyerUserId === viewerUserId ? "BUYER" : "SELLER";
    return {
      id: order.id,
      status: order.status,
      viewerRole,
      fulfillmentType: physical ? "PHYSICAL" : "DIGITAL",
      paidAt: order.paidAt,
      processingAt: order.processingAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      refundedAt: order.refundedAt,
      nextAction: this.nextAction(order.status, viewerRole, physical)
    };
  }

  private nextAction(status: OrderStatus, viewerRole: "BUYER" | "SELLER", physical: boolean) {
    if (status === OrderStatus.PENDING) return "Await authoritative Phase 13 payment confirmation, or cancel before payment";
    if (status === OrderStatus.PAID) return viewerRole === "SELLER" ? "Start processing the paid Order" : "Seller will begin processing";
    if (status === OrderStatus.PROCESSING) {
      if (viewerRole !== "SELLER") return physical ? "Seller is preparing shipment" : "Seller is preparing digital delivery";
      return physical ? "Mark the Order shipped" : "Mark the digital Order delivered";
    }
    if (status === OrderStatus.SHIPPED) return viewerRole === "SELLER" ? "Mark the physical Order delivered" : "Shipment is on the way";
    if (status === OrderStatus.DELIVERED) return viewerRole === "BUYER" ? "Confirm completion after receiving the Order" : "Waiting for buyer completion confirmation";
    if (status === OrderStatus.COMPLETED) return "Order completed";
    if (status === OrderStatus.CANCELLED) return "Order cancelled before payment";
    if (status === OrderStatus.REFUNDED) return "Order refunded through authoritative payment handling";
    return null;
  }
}
