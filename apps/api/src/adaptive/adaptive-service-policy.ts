/**
 * Draft-only service configuration contract, v1.
 *
 * These settings describe an offer; they do not reserve any staff, verify
 * actual capacity, produce quotes, charge customers or publish a listing.
 * Unknown fields are rejected instead of entering trusted policy JSON.
 */
export type AdaptiveServiceKind =
  | "appointment" | "item" | "project" | "group" | "event"
  | "product" | "digital" | "recurring" | "live";
export type AdaptivePolicy = Record<string, string | number | boolean | string[]>;

const OPTIONS = {
  consultationMode: ["disabled", "optional", "required"],
  itemType: ["laundry", "tailoring", "shoemaking", "repair", "other"],
  handoverMethods: ["drop_off", "home_pickup", "courier"],
  returnMethods: ["shop_pickup", "home_delivery", "courier"],
  measurementMethods: ["not_required", "shop_visit", "home_visit", "guided_remote"],
  meetingMode: ["remote", "onsite", "hybrid"],
  frequency: ["daily", "weekly", "biweekly", "monthly"],
  stockMode: ["made_to_order", "tracked", "unlimited_digital"]
} as const;

type Field =
  | { kind: "int"; default: number; min: number; max: number }
  | { kind: "bool"; default: boolean }
  | { kind: "enum"; default: string; options: readonly string[] }
  | { kind: "list"; default: readonly string[]; options: readonly string[]; min: number };
const num=(def:number,min:number,max:number):Field=>({kind:"int",default:def,min,max});
const bool=(def:boolean):Field=>({kind:"bool",default:def});
const one=(def:string,options:readonly string[]):Field=>({kind:"enum",default:def,options});
const many=(def:readonly string[],options:readonly string[],min=1):Field=>({kind:"list",default:def,options,min});

export const POLICY_SCHEMA: Record<AdaptiveServiceKind, Record<string, Field>> = {
  appointment: {
    durationMinutes: num(45, 5, 720),
    bookingWindowDays: num(30, 1, 365),
    concurrentCapacity: num(1, 1, 100),
    availableProfessionals: num(1, 1, 200),
    availableStations: num(1, 1, 200),
    consultationMode: one("optional", OPTIONS.consultationMode),
    consultationFeeMinor: num(0, 0, 2000000000),
    creditConsultation: bool(false),
    homeService: bool(false)
  },
  item: {
    itemType: one("laundry", OPTIONS.itemType),
    turnaroundHours: num(48, 1, 2160),
    handoverMethods: many(["drop_off"], OPTIONS.handoverMethods),
    returnMethods: many(["shop_pickup"], OPTIONS.returnMethods),
    measurementMethods: many(["not_required"], OPTIONS.measurementMethods),
    notifyWhenReady: bool(true),
    needsClientApproval: bool(true)
  },
  project: {
    estimatedDays: num(7, 1, 365),
    revisionRounds: num(2, 0, 30),
    milestoneReview: bool(true),
    consultationMode: one("optional", OPTIONS.consultationMode),
    meetingMode: one("hybrid", OPTIONS.meetingMode)
  },
  group: {
    maxParticipants: num(12, 2, 500),
    sessionMinutes: num(60, 15, 480),
    sessionCount: num(1, 1, 100),
    meetingMode: one("onsite", OPTIONS.meetingMode),
    registrationApproval: bool(false)
  },
  event: {
    minimumLeadDays: num(7, 0, 365),
    teamMembersNeeded: num(1, 1, 100),
    estimatedGuests: num(30, 1, 100000),
    quoteRequired: bool(true),
    homeOrVenueService: bool(true)
  },
  product: {
    stockMode: one("made_to_order", OPTIONS.stockMode),
    productionDays: num(3, 0, 365),
    returnsDays: num(7, 0, 90),
    deliveryAvailable: bool(true)
  },
  digital: {
    estimatedDays: num(5, 1, 365),
    revisionRounds: num(2, 0, 30),
    fileDelivery: bool(true),
    milestoneReview: bool(false),
    consultationMode: one("optional", OPTIONS.consultationMode)
  },
  recurring: {
    frequency: one("weekly", OPTIONS.frequency),
    durationMinutes: num(60, 5, 720),
    sessionsPerCycle: num(1, 1, 31),
    availableProfessionals: num(1, 1, 200),
    pauseAllowed: bool(true)
  },
  live: {
    maxAttendees: num(100, 1, 100000),
    durationMinutes: num(60, 5, 720),
    replayAvailable: bool(true),
    registrationRequired: bool(false)
  }
};

export function defaultAdaptiveServicePolicy(kind: AdaptiveServiceKind): AdaptivePolicy {
  const schema = POLICY_SCHEMA[kind];
  const out: AdaptivePolicy = {};
  for (const [key, spec] of Object.entries(schema)) {
    out[key] = spec.kind === "list" ? [...spec.default] : spec.default;
  }
  return out;
}

export function validateAdaptiveServicePolicy(kind: AdaptiveServiceKind, input: unknown): AdaptivePolicy {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Policy must be an object");
  const obj = input as Record<string, unknown>;
  const schema = POLICY_SCHEMA[kind];
  if (!schema) throw new Error("Unsupported service workflow");
  if (JSON.stringify(input).length > 5000) throw new Error("Policy exceeds configured size");
  const output = defaultAdaptiveServicePolicy(kind);
  for (const [key, value] of Object.entries(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      throw new Error("Invalid policy key");
    const spec = schema[key];
    if (!spec) throw new Error("Unknown " + kind + " policy field: " + key);
    if (spec.kind === "int") {
      if (typeof value !== "number" || !Number.isSafeInteger(value) ||
          value < spec.min || value > spec.max)
        throw new Error(key + " must be a whole number between " + spec.min + " and " + spec.max);
      output[key] = value;
    } else if (spec.kind === "bool") {
      if (typeof value !== "boolean") throw new Error(key + " must be true or false");
      output[key] = value;
    } else if (spec.kind === "enum") {
      if (typeof value !== "string" || !spec.options.includes(value))
        throw new Error("Unsupported " + key + " option");
      output[key] = value;
    } else {
      if (!Array.isArray(value) || value.length < spec.min ||
          value.length > spec.options.length ||
          new Set(value).size !== value.length ||
          !value.every(x => typeof x === "string" && spec.options.includes(x)))
        throw new Error(key + " must include valid unique choices");
      output[key] = [...value];
    }
  }
  if (kind === "appointment") {
    const capacity = output.concurrentCapacity as number;
    const people = output.availableProfessionals as number;
    const stations = output.availableStations as number;
    if (capacity > Math.min(people, stations))
      throw new Error("Concurrent capacity cannot exceed available professionals or stations");
    if (output.consultationMode === "disabled" && output.consultationFeeMinor !== 0)
      throw new Error("Disabled consultations must be free");
    if (output.consultationMode === "disabled" && output.creditConsultation)
      throw new Error("Consultation credit requires consultations to be enabled");
    if (output.consultationFeeMinor === 0 && output.creditConsultation)
      throw new Error("Consultation credit requires a paid consultation");
  }
  if (kind === "item" && (output.measurementMethods as string[]).includes("not_required") &&
      (output.measurementMethods as string[]).length > 1)
    throw new Error("Choose either no measurements or one or more measurement methods");
  if (kind === "item" && output.itemType === "laundry" &&
      (output.measurementMethods as string[]).some(x => x !== "not_required"))
    throw new Error("Laundry bookings do not request body measurements");
  return output;
}
