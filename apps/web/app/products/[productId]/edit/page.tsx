"use client";

import { useParams } from "next/navigation";
import ProductEditor from "../../product-editor";

export default function EditProductPage() {
  const params = useParams<{ productId: string }>();
  return <ProductEditor productId={params.productId} />;
}
