import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderInventorySource, OrderStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export interface AuthoritativeOrderRefundInput {
  orderId: string;
  refundReference: string;
  source?: string;
}

@Injectable()
export class CommerceFinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async markRefundedFromAuthoritativeRefund(input: AuthoritativeOrderRefundInput) {
    const orderId = this.required(input.orderId, "orderId");
    const refundReference = this.required(input.refundReference, "refundReference");
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    if (!existing) throw new NotFoundException("Order not found");
    if (existing.status === OrderStatus.REFUNDED) return existing;
    if (existing.status !== OrderStatus.PAID) {
      throw new ConflictException(`Order cannot be refunded from ${existing.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: existing.id, status: OrderStatus.PAID },
        data: { status: OrderStatus.REFUNDED, refundedAt: new Date() }
      });
      if (changed.count !== 1) {
        const current = await tx.order.findUnique({ where: { id: existing.id } });
        if (current?.status === OrderStatus.REFUNDED) return current;
        throw new ConflictException("Order state changed before refund could be applied");
      }

      for (const item of existing.items) {
        if (item.inventorySource === OrderInventorySource.VARIANT && item.productVariantId) {
          const restored = await tx.productVariant.updateMany({
            where: { id: item.productVariantId, productId: item.productId },
            data: { inventoryQuantity: { increment: item.quantity } }
          });
          if (restored.count !== 1) throw new ConflictException("Refund inventory restoration failed for Product variant");
        }
        if (item.inventorySource === OrderInventorySource.PRODUCT) {
          const restored = await tx.product.updateMany({
            where: { id: item.productId },
            data: { inventoryQuantity: { increment: item.quantity } }
          });
          if (restored.count !== 1) throw new ConflictException("Refund inventory restoration failed for Product");
        }
      }

      await tx.systemEvent.create({
        data: {
          name: "order.refunded",
          source: "payment",
          payload: {
            orderId: existing.id,
            buyerUserId: existing.buyerUserId,
            sellerUserId: existing.sellerUserId,
            refundReference,
            source: input.source ?? "phase13",
            status: OrderStatus.REFUNDED
          }
        }
      });

      return tx.order.findUniqueOrThrow({
        where: { id: existing.id },
        include: { items: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private required(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 300) {
      throw new ConflictException(`${field} is required`);
    }
    return value.trim();
  }
}
