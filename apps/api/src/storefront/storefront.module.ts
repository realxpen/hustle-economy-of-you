import { Module } from "@nestjs/common";

import { TrustModule } from "../trust/trust.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [TrustModule],
  controllers: [StorefrontController],
  providers: [StorefrontService]
})
export class StorefrontModule {}
