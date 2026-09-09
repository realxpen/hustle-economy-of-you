import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OwnerProductController } from "./product.controller";
import { ProductService } from "./product.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerProductController],
  providers: [ProductService],
  exports: [ProductService]
})
export class ProductModule {}
