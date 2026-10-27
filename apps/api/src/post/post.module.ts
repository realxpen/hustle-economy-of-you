import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OwnerPostController, PublicPostController, StagingPostMediaController } from "./post.controller";
import {
  AuthenticatedPostInteractionController,
  PublicPostInteractionController,
  UserFollowController
} from "./post-interaction.controller";
import { PostInteractionService } from "./post-interaction.service";
import { PostService } from "./post.service";
import { StagingUploadService } from "./staging-upload.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    OwnerPostController,
    PublicPostController,
    StagingPostMediaController,
    PublicPostInteractionController,
    AuthenticatedPostInteractionController,
    UserFollowController
  ],
  providers: [PostService, PostInteractionService, StagingUploadService],
  exports: [PostService, PostInteractionService]
})
export class PostModule {}
