import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import { Capability } from "@prisma/client";

import { AuthGuard } from "../auth/auth.guard";
import { CapabilityGuard } from "../auth/capability.guard";
import { RequireCapability } from "../auth/capability.decorator";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  ProductService,
  type SaveProductInput,
  type SaveProductVariantInput
} from "./product.service";

@Controller("products")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.HUSTLER)
export class OwnerProductController {
  constructor(private readonly products: ProductService) {}

  @Get("mine")
  listMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.products.listMine(identity);
  }

  @Post()
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SaveProductInput
  ) {
    return this.products.create(identity, body);
  }

  @Get("mine/:productId")
  getMine(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string
  ) {
    return this.products.getMine(identity, productId);
  }

  @Put(":productId")
  save(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string,
    @Body() body: SaveProductInput
  ) {
    return this.products.save(identity, productId, body);
  }

  @Post(":productId/variants")
  createVariant(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string,
    @Body() body: SaveProductVariantInput
  ) {
    return this.products.createVariant(identity, productId, body);
  }

  @Put(":productId/variants/:variantId")
  saveVariant(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() body: SaveProductVariantInput
  ) {
    return this.products.saveVariant(identity, productId, variantId, body);
  }

  @Delete(":productId/variants/:variantId")
  removeVariant(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string,
    @Param("variantId") variantId: string
  ) {
    return this.products.removeVariant(identity, productId, variantId);
  }

  @Post(":productId/publish")
  publish(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string
  ) {
    return this.products.publish(identity, productId);
  }

  @Post(":productId/pause")
  pause(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string
  ) {
    return this.products.pause(identity, productId);
  }

  @Delete(":productId")
  remove(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("productId") productId: string
  ) {
    return this.products.remove(identity, productId);
  }
}
