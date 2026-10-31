import { AdaptiveWorkflowType } from "@prisma/client";

/** Stable versioned defaults; existing Service/Booking/Order remain authoritative. */
export const ADAPTIVE_BLUEPRINTS = [
  { slug: "appointment", type: AdaptiveWorkflowType.APPOINTMENT, version: 1,
    label: "Appointment", steps: ["request","availability","approval","service","confirmation"],
    features: ["schedule","worker","room","consultation"] },
  { slug: "item", type: AdaptiveWorkflowType.ITEM, version: 1,
    label: "Item-based job", steps: ["intake","quote","handover","processing","ready","return","approval"],
    features: ["pickup","measurements","turnaround","delivery","receipt"] },
  { slug: "project", type: AdaptiveWorkflowType.PROJECT, version: 1,
    label: "Project", steps: ["brief","proposal","agreement","milestones","delivery","approval"],
    features: ["scope","files","revisions","milestones"] },
  { slug: "group", type: AdaptiveWorkflowType.GROUP, version: 1,
    label: "Shared session", steps: ["enroll","schedule","attendance","session","followup"],
    features: ["seats","attendance","capacity"] },
  { slug: "event", type: AdaptiveWorkflowType.EVENT, version: 1,
    label: "Event", steps: ["requirements","availability","quote","preparation","event","approval"],
    features: ["venue","team","equipment","logistics"] },
  { slug: "product", type: AdaptiveWorkflowType.PRODUCT, version: 1,
    label: "Product", steps: ["select","checkout","stock","dispatch","delivery","returns"],
    features: ["variants","inventory","shipping"] },
  { slug: "digital", type: AdaptiveWorkflowType.DIGITAL, version: 1,
    label: "Digital deliverable", steps: ["brief","proposal","create","review","revisions","acceptance"],
    features: ["files","revisionLimit","deadline"] },
  { slug: "recurring", type: AdaptiveWorkflowType.RECURRING, version: 1,
    label: "Recurring service", steps: ["plan","schedule","repeat","review","renew"],
    features: ["cadence","renewals","staff"] },
  { slug: "live", type: AdaptiveWorkflowType.LIVE, version: 1,
    label: "Live experience", steps: ["publish","registration","access","live","replay"],
    features: ["broadcast","access","replay"] }
] as const;

export const WORKSPACE_PERMISSIONS = [
  "services.manage", "work.manage", "schedule.manage", "messages.reply", "finance.view"
] as const;

export type WorkspacePermission = typeof WORKSPACE_PERMISSIONS[number];

export function allowedWorkspacePermissions(value: unknown): WorkspacePermission[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > WORKSPACE_PERMISSIONS.length)
    throw new Error("Select at least one valid permission");
  const set = new Set<WorkspacePermission>();
  for (const item of value) {
    if (typeof item !== "string" ||
        !WORKSPACE_PERMISSIONS.includes(item as WorkspacePermission))
      throw new Error("Requested permission is not delegable");
    set.add(item as WorkspacePermission);
  }
  return [...set];
}
