import { Controller, Get, Param } from "@nestjs/common";

import { PublicProductService } from "./public-product.service";

@Controller("products")
export class PublicProductController {
  constructor(private readonly products: PublicProductService) {}

  @Get(":productId")
  get(@Param("productId") productId: string) {
    return this.products.get(productId);
  }
}
