import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CreatorActivationController } from "./creator-activation.controller";
import { CreatorActivationService } from "./creator-activation.service";

@Module({
  imports: [AuthModule],
  controllers: [CreatorActivationController],
  providers: [CreatorActivationService]
})
export class CreatorActivationModule {}
