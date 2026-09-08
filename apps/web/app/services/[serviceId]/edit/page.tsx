"use client";

import { useParams } from "next/navigation";
import { ServiceEditor } from "../../service-editor";

export default function EditServicePage() {
  const params = useParams<{ serviceId: string }>();
  return <ServiceEditor serviceId={params?.serviceId} />;
}
