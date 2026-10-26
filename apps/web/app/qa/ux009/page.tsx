import { notFound } from "next/navigation";
import { UX009AuthorizationCheck } from "./ux009-authorization-check";

/** This diagnostic cannot be rendered outside isolated, nonproduction Hustle. */
export const dynamic = "force-dynamic";

export default function UX009AuthorizationPage() {
  if (
    process.env.HUSTLE_ISOLATED_PWA_GATE !== "isolated-staging" ||
    process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH !== "true"
  ) {
    notFound();
  }

  return <UX009AuthorizationCheck />;
}
