import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import {
  ProfessionalProfileController,
  PublicProfessionalProfileController
} from "./professional-profile.controller";
import { ProfessionalProfileService } from "./professional-profile.service";

@Module({
  imports: [AuthModule],
  controllers: [
    ProfessionalProfileController,
    PublicProfessionalProfileController
  ],
  providers: [ProfessionalProfileService],
  exports: [ProfessionalProfileService]
})
export class ProfessionalProfileModule {}
