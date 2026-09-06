import { z } from "zod";

export const analyticsEventSchema = z.object({
  name: z.string().min(1).max(120),
  occurredAt: z.string().datetime(),
  source: z.enum(["mobile", "web", "admin", "api"]),
  anonymousId: z.string().optional(),
  userId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});
