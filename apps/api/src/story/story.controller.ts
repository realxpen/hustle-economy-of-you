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
import { StoryService, type CreateStoryInput } from "./story.service";

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
