import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OwnerPostController, PublicPostController } from "./post.controller";
import { PostService } from "./post.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerPostController, PublicPostController],
  providers: [PostService],
  exports: [PostService]
})
export class PostModule {}
