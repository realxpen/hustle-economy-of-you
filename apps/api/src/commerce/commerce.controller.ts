import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  type AddCartItemInput,
  type CheckoutInput,
  CommerceService,
  type OrderPaginationInput,
  type UpdateCartItemInput
} from "./commerce.service";

@Controller("cart")
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly commerce: CommerceService) {}

  @Get()
  getCart(@CurrentIdentity() identity: AuthIdentity) {
    return this.commerce.getCart(identity);
  }

  @Post("items")
  addItem(@CurrentIdentity() identity: AuthIdentity, @Body() input: AddCartItemInput) {
    return this.commerce.addCartItem(identity, input);
  }

  @Put("items/:itemId")
  updateItem(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("itemId") itemId: string,
    @Body() input: UpdateCartItemInput
  ) {
    return this.commerce.updateCartItem(identity, itemId, input);
  }

  @Delete("items/:itemId")
  removeItem(@CurrentIdentity() identity: AuthIdentity, @Param("itemId") itemId: string) {
    return this.commerce.removeCartItem(identity, itemId);
  }

  @Delete()
  clear(@CurrentIdentity() identity: AuthIdentity) {
    return this.commerce.clearCart(identity);
  }

  @Post("checkout/preview")
  preview(@CurrentIdentity() identity: AuthIdentity) {
    return this.commerce.checkoutPreview(identity);
  }

  @Post("checkout")
  checkout(@CurrentIdentity() identity: AuthIdentity, @Body() input: CheckoutInput) {
    return this.commerce.checkout(identity, input);
  }
}

@Controller("orders")
@UseGuards(AuthGuard)
export class OrderController {
  constructor(private readonly commerce: CommerceService) {}

  @Get("buyer")
  buyerOrders(@CurrentIdentity() identity: AuthIdentity, @Query() query: OrderPaginationInput) {
    return this.commerce.listBuyerOrders(identity, query);
  }

  @Get("seller")
  sellerOrders(@CurrentIdentity() identity: AuthIdentity, @Query() query: OrderPaginationInput) {
    return this.commerce.listSellerOrders(identity, query);
  }

  @Get(":orderId")
  getOrder(@CurrentIdentity() identity: AuthIdentity, @Param("orderId") orderId: string) {
    return this.commerce.getOrder(identity, orderId);
  }
}
