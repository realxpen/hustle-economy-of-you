import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { Capability } from "@prisma/client";

import { AuthGuard } from "../auth/auth.guard";
import { CapabilityGuard } from "../auth/capability.guard";
import { RequireCapability } from "../auth/capability.decorator";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import type {
  AcceptBookingInput,
  BookingPaginationInput,
  CancelBookingInput,
  DeclineBookingInput
} from "../booking/booking.service";
import {
  AgentClientOperationsService,
  type AgentConversationPaginationInput,
  type AgentMessagePaginationInput,
  type AgentSendMessageInput
} from "./agent-client-operations.service";

@Controller("agent-client/:principalUserId")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.AGENT)
export class AgentClientOperationsController {
  constructor(
    private readonly operations: AgentClientOperationsService
  ) {}

  @Get("bookings")
  listBookings(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Query() query: BookingPaginationInput
  ) {
    return this.operations.listBookings(
      identity,
      principalUserId,
      query
    );
  }

  @Get("bookings/:bookingId")
  getBooking(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("bookingId") bookingId: string
  ) {
    return this.operations.getBooking(
      identity,
      principalUserId,
      bookingId
    );
  }

  @Post("bookings/:bookingId/accept")
  acceptBooking(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("bookingId") bookingId: string,
    @Body() input: AcceptBookingInput
  ) {
    return this.operations.acceptBooking(
      identity,
      principalUserId,
      bookingId,
      input
    );
  }

  @Post("bookings/:bookingId/decline")
  declineBooking(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("bookingId") bookingId: string,
    @Body() input: DeclineBookingInput
  ) {
    return this.operations.declineBooking(
      identity,
      principalUserId,
      bookingId,
      input
    );
  }

  @Post("bookings/:bookingId/cancel")
  cancelBooking(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("bookingId") bookingId: string,
    @Body() input: CancelBookingInput
  ) {
    return this.operations.cancelBooking(
      identity,
      principalUserId,
      bookingId,
      input
    );
  }

  @Post("bookings/:bookingId/start")
  startBooking(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("bookingId") bookingId: string
  ) {
    return this.operations.startBooking(
      identity,
      principalUserId,
      bookingId
    );
  }

  @Get("messages/conversations")
  listConversations(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Query() query: AgentConversationPaginationInput
  ) {
    return this.operations.listConversations(
      identity,
      principalUserId,
      query
    );
  }

  @Get("messages/conversations/:conversationId")
  getConversation(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("conversationId") conversationId: string
  ) {
    return this.operations.getConversation(
      identity,
      principalUserId,
      conversationId
    );
  }

  @Get("messages/conversations/:conversationId/messages")
  listMessages(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("conversationId") conversationId: string,
    @Query() query: AgentMessagePaginationInput
  ) {
    return this.operations.listMessages(
      identity,
      principalUserId,
      conversationId,
      query
    );
  }

  @Post("messages/conversations/:conversationId/messages")
  sendMessage(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("conversationId") conversationId: string,
    @Body() input: AgentSendMessageInput
  ) {
    return this.operations.sendMessage(
      identity,
      principalUserId,
      conversationId,
      input
    );
  }
}
