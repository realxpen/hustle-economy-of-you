import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export interface AuthoritativeBookingRefundInput {
  bookingId: string;
  refundReference: string;
  source?: string;
}

@Injectable()
export class BookingFinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async markRefundedFromAuthoritativeRefund(input: AuthoritativeBookingRefundInput) {
    const bookingId = this.required(input.bookingId, "bookingId");
    const refundReference = this.required(input.refundReference, "refundReference");
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        serviceId: true,
        status: true,
        refundedAt: true,
        clientUserId: true,
        hustlerUserId: true
      }
    });
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.status === BookingStatus.REFUNDED) return booking;
    if (booking.status !== BookingStatus.FUNDED && booking.status !== BookingStatus.DISPUTED) {
      throw new ConflictException(`Booking cannot be refunded from ${booking.status}`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: { in: [BookingStatus.FUNDED, BookingStatus.DISPUTED] }
        },
        data: { status: BookingStatus.REFUNDED, refundedAt: now }
      });
      if (changed.count !== 1) {
        const current = await tx.booking.findUnique({ where: { id: booking.id } });
        if (current?.status === BookingStatus.REFUNDED) return current;
        throw new ConflictException("Booking state changed before refund could be applied");
      }

      await tx.systemEvent.create({
        data: {
          name: "booking.refunded",
          source: "payment",
          payload: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            clientUserId: booking.clientUserId,
            hustlerUserId: booking.hustlerUserId,
            refundReference,
            source: input.source ?? "phase13",
            status: BookingStatus.REFUNDED
          }
        }
      });

      return tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    });

    return updated;
  }

  private required(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 300) {
      throw new ConflictException(`${field} is required`);
    }
    return value.trim();
  }
}
