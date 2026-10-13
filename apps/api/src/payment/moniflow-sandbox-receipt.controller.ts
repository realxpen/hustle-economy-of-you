import { Controller, ForbiddenException, Headers, HttpCode, NotFoundException, Post, Req } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { verifyAndStoreSandboxPartnerReceipt } from "./moniflow-receipt-inbox";

/** Isolated TEST-only signed partner receipt inbox, not a financial webhook. */
@Controller("payments/partner-sandbox")
export class MoniflowSandboxReceiptController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("received")
  @HttpCode(200)
  async acceptReceipt(
    @Req() request: { rawBody?: Buffer },
    @Headers("x-moniflow-receipt-signature") signature?: string
  ) {
    const secret=process.env.MONIFLOW_PARTNER_HMAC_SECRET;
    if (process.env.NODE_ENV!=="test" ||
        process.env.MONIFLOW_SANDBOX_INBOX_ENABLED!=="true" ||
        !secret || secret.length<32) {
      throw new NotFoundException("Not found");
    }
    if (!Buffer.isBuffer(request.rawBody) || typeof signature!=="string") {
      throw new ForbiddenException("Signed raw receipt required");
    }
    try {
      return await verifyAndStoreSandboxPartnerReceipt(
        this.prisma, request.rawBody, signature, secret
      );
    } catch {
      // Malformed, tampered and financially inconsistent events fail closed.
      // Do not reveal identifiers or trusted financial state in the response.
      throw new ForbiddenException("Receipt not accepted");
    }
  }
}
