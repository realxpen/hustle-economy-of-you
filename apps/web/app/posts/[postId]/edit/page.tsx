"use client";

import { useParams } from "next/navigation";
import PostEditor from "../../post-editor";

export default function EditPostPage() {
  const params = useParams<{ postId: string }>();
  return <PostEditor postId={params.postId} />;
}
