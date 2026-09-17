import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  StoryService,
  type CreateStoryInput,
  type StoryEventInput,
  type StoryReactionInput,
  type StoryReplyInput,
  type StoryViewInput
} from "./story.service";

@Controller("stories")
export class StoryController {
  constructor(private readonly stories: StoryService) {}

  @Get()
  listActive(@Query("limit") limit?: string) {
    return this.stories.listActive(limit);
  }

  @Get("mine")
  @UseGuards(AuthGuard)
  listMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.stories.listMine(identity);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: CreateStoryInput
  ) {
    return this.stories.create(identity, body);
  }

  @Post(":storyId/views")
  recordView(
    @Param("storyId") storyId: string,
    @Body() body: StoryViewInput
  ) {
    return this.stories.recordView(storyId, body);
  }

  @Get(":storyId/interactions")
  getInteractions(@Param("storyId") storyId: string) {
    return this.stories.getInteractions(storyId);
  }

  @Get(":storyId/interactions/me")
  @UseGuards(AuthGuard)
  getViewerInteraction(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("storyId") storyId: string
  ) {
    return this.stories.getViewerInteraction(identity, storyId);
  }

  @Post(":storyId/reaction")
  @UseGuards(AuthGuard)
  react(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("storyId") storyId: string,
    @Body() body: StoryReactionInput
  ) {
    return this.stories.react(identity, storyId, body);
  }

  @Delete(":storyId/reaction")
  @UseGuards(AuthGuard)
  removeReaction(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("storyId") storyId: string
  ) {
    return this.stories.removeReaction(identity, storyId);
  }

  @Post(":storyId/replies")
  @UseGuards(AuthGuard)
  reply(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("storyId") storyId: string,
    @Body() body: StoryReplyInput
  ) {
    return this.stories.reply(identity, storyId, body);
  }

  @Get(":storyId/replies")
  @UseGuards(AuthGuard)
  listReplies(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("storyId") storyId: string
  ) {
    return this.stories.listReplies(identity, storyId);
  }

  @Post(":storyId/events")
  recordEvent(
    @Param("storyId") storyId: string,
    @Body() body: StoryEventInput
  ) {
    return this.stories.recordEvent(storyId, body);
  }

  @Get(":storyId")
  getPublic(@Param("storyId") storyId: string) {
    return this.stories.getPublic(storyId);
  }

  @Delete(":storyId")
  @UseGuards(AuthGuard)
  remove(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("storyId") storyId: string
  ) {
    return this.stories.remove(identity, storyId);
  }
}
