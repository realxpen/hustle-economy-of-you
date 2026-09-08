import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { HustlerApplicationController } from "./hustler-application.controller";
import { HustlerApplicationService } from "./hustler-application.service";

@Module({
  imports: [AuthModule],
  controllers: [HustlerApplicationController],
  providers: [HustlerApplicationService],
  exports: [HustlerApplicationService]
})
export class HustlerApplicationModule {}
