import { Controller, Get } from "@nestjs/common";
import { FoundationService } from "./foundation.service";

@Controller()
export class FoundationController {
  constructor(private readonly foundation: FoundationService) {}

  @Get()
  root() {
    return {
      service: "Hustle API",
      status: "ok",
      version: "v1",
      endpoints: {
        health: "/api/v1/health",
        foundation: "/api/v1/foundation"
      }
    };
  }

  @Get("health") health(){ return this.foundation.health(); }
  @Get("foundation") foundationStatus(){ return this.foundation.foundationStatus(); }
}
