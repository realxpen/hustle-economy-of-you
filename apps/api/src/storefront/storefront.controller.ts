import { Controller, Get, Param } from "@nestjs/common";

import { StorefrontService } from "./storefront.service";

@Controller("storefronts")
export class StorefrontController {
  constructor(private readonly storefronts: StorefrontService) {}

  @Get(":username")
  getPublic(@Param("username") username: string) {
    return this.storefronts.getPublic(username);
  }
}
