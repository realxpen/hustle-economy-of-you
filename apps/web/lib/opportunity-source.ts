"use client";

/** Context is a navigation hint from a public post, never a trust or payment
 * assertion. Verify all offer/payment/booking state on canonical API routes. */
import { useEffect, useState } from "react";

const POST_ID = /^[A-Za-z0-9_-]{6,128}$/;

export function validSourcePostId(candidate: string | null | undefined): string | null {
  return candidate && POST_ID.test(candidate) ? candidate : null;
}

export function withSourcePost(path: string, sourcePostId?: string | null): string {
  const safe = validSourcePostId(sourcePostId);
  if (!safe) return path;
  const [pathnameAndQuery, hash] = path.split("#", 2);
  return pathnameAndQuery + (pathnameAndQuery.includes("?") ? "&" : "?") +
    "sourcePost=" + encodeURIComponent(safe) + (hash ? "#" + hash : "");
}

export function useSourcePost(): string | null {
  const [postId, setPostId] = useState<string | null>(null);
  useEffect(() => {
    setPostId(validSourcePostId(new URLSearchParams(window.location.search).get("sourcePost")));
  }, []);
  return postId;
}
