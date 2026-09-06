import { SetMetadata } from "@nestjs/common";
import type { Capability } from "@prisma/client";

export const REQUIRED_CAPABILITY = "hustle:required-capability";
export const RequireCapability = (capability: Capability) => SetMetadata(REQUIRED_CAPABILITY, capability);
