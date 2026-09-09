import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OwnerPostController, PublicPostController } from "./post.controller";
import {
  AuthenticatedPostInteractionController,
  PublicPostInteractionController,
  UserFollowController
} from "./post-interaction.controller";
import { PostInteractionService } from "./post-interaction.service";
import { PostService } from "./post.service";

@Module({
  imports: [AuthModule],
  controllers: [
    OwnerPostController,
    PublicPostController,
    PublicPostInteractionController,
    AuthenticatedPostInteractionController,
    UserFollowController
  ],
  providers: [PostService, PostInteractionService],
  exports: [PostService, PostInteractionService]
})
export class PostModule {}
