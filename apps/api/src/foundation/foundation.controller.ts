import { Controller, Get } from "@nestjs/common";
import { FoundationService } from "./foundation.service";

@Controller()
export class FoundationController {
  constructor(private readonly foundation: FoundationService) {}
  @Get("health") health(){ return this.foundation.health(); }
  @Get("foundation") foundationStatus(){ return this.foundation.foundationStatus(); }
}
