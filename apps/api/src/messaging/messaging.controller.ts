import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  MessagingPresenceService,
  type SetTypingInput
} from "./messaging-presence.service";
import {
  MessagingService,
  type MarkConversationReadInput,
  type MessagingPaginationInput,
  type OpenDirectConversationInput,
  type SendMessageInput
} from "./messaging.service";

@Controller("messaging")
@UseGuards(AuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingPresenceService: MessagingPresenceService
  ) {}

  @Post("conversations/direct")
  openDirectConversation(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: OpenDirectConversationInput
  ) {
    return this.messagingService.openDirect(identity, input);
  }

  @Get("conversations")
  listConversations(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: MessagingPaginationInput
  ) {
    return this.messagingService.listConversations(identity, query);
  }

  @Get("conversations/:conversationId")
  getConversation(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string
  ) {
    return this.messagingService.getConversation(identity, conversationId);
  }

  @Get("conversations/:conversationId/messages")
  listMessages(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string,
    @Query() query: MessagingPaginationInput
  ) {
    return this.messagingService.listMessages(identity, conversationId, query);
  }

  @Post("conversations/:conversationId/messages")
  sendMessage(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string,
    @Body() input: SendMessageInput
  ) {
    return this.messagingService.sendMessage(identity, conversationId, input);
  }

  @Post("conversations/:conversationId/read")
  markRead(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string,
    @Body() input: MarkConversationReadInput
  ) {
    return this.messagingService.markRead(identity, conversationId, input);
  }

  @Get("conversations/:conversationId/typing")
  getTyping(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string
  ) {
    return this.messagingPresenceService.getTyping(identity, conversationId);
  }

  @Post("conversations/:conversationId/typing")
  setTyping(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string,
    @Body() input: SetTypingInput
  ) {
    return this.messagingPresenceService.setTyping(identity, conversationId, input);
  }

  @Post("conversations/:conversationId/messages/:messageId/context-opened")
  recordContextOpened(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("conversationId") conversationId: string,
    @Param("messageId") messageId: string
  ) {
    return this.messagingService.recordContextOpened(identity, conversationId, messageId);
  }
}
