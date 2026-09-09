import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OwnerProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { PublicProductController } from "./public-product.controller";
import { PublicProductService } from "./public-product.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerProductController, PublicProductController],
  providers: [ProductService, PublicProductService],
  exports: [ProductService]
})
export class ProductModule {}
