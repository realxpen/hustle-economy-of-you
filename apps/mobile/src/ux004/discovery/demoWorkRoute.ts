/**
 * Offline UX004 discovery → demonstrated-work index resolver.
 * Keeps the Explore handoff tied to the same local fictional Feed posts.
 * No persistence, identity, location lookup, API, or commerce.
 */
export function findDemoWorkIndex<T extends { id: string }>(
  posts: readonly T[],
  postId: string
): number | null {
  const index = posts.findIndex(post => post.id === postId);
  return index < 0 ? null : index;
}
