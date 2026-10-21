/** Typed local-only copy for fictional offers. Never represents actual availability. */
export type DemoOfferKind = "service" | "product";

export type DemoOfferCopy = {
  badge: string;
  action: string;
  noTransaction: string;
};

export function getDemoOfferCopy(kind: DemoOfferKind): DemoOfferCopy {
  return kind === "service"
    ? {
        badge: "SAMPLE SERVICE",
        action: "View service",
        noTransaction: "Preview only; no booking is made",
      }
    : {
        badge: "SAMPLE PRODUCT",
        action: "View product",
        noTransaction: "Preview only; no purchase is made",
      };
}
