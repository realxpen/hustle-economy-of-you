import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OwnerServiceController, PublicServiceController } from "./service.controller";
import { ServiceService } from "./service.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerServiceController, PublicServiceController],
  providers: [ServiceService],
  exports: [ServiceService]
})
export class ServiceModule {}
