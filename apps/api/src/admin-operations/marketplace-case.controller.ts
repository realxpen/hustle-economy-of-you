import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  MarketplaceCaseService,
  type CreateMarketplaceCaseInput,
  type UpdateMarketplaceCaseInput,
  type AddMarketplaceCaseNoteInput
} from "./marketplace-case.service";

@Controller("admin/operations/cases")
@UseGuards(AuthGuard, AdminGuard)
export class MarketplaceCaseController {
  constructor(private readonly cases: MarketplaceCaseService) {}

  @Get("overview")
  overview() {
    return this.cases.overview();
  }

  @Get()
  list(
    @Query("status") status?: string,
    @Query("subjectType") subjectType?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    return this.cases.list({ status, subjectType, limit, cursor });
  }

  @Get("viewer")
  viewer(@CurrentIdentity() identity: AuthIdentity) {
    return this.cases.viewer(identity);
  }

  @Get(":caseId")
  get(@Param("caseId") caseId: string) {
    return this.cases.get(caseId);
  }

  @Post()
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: CreateMarketplaceCaseInput
  ) {
    return this.cases.create(identity, input);
  }

  @Post(":caseId/claim")
  claim(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("caseId") caseId: string
  ) {
    return this.cases.claim(identity, caseId);
  }

  @Post(":caseId/release")
  release(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("caseId") caseId: string
  ) {
    return this.cases.release(identity, caseId);
  }

  @Patch(":caseId")
  update(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("caseId") caseId: string,
    @Body() input: UpdateMarketplaceCaseInput
  ) {
    return this.cases.update(identity, caseId, input);
  }

  @Post(":caseId/notes")
  note(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("caseId") caseId: string,
    @Body() input: AddMarketplaceCaseNoteInput
  ) {
    return this.cases.addNote(identity, caseId, input);
  }
}
