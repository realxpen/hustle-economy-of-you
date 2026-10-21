/**
 * Pure helpers for the fictional, in-memory UX004 Feed.
 * No persistence, user identity, network, money movement or new packages.
 */
export type DemoCollection = "Inspiration" | "Outfit ideas";
export type DemoComment = { id: string; handle: string; body: string; parentId?: string };

/** Render root comments in insertion order, with their direct replies beneath. */
export function orderDemoComments<T extends DemoComment>(notes: readonly T[]): T[] {
  const ids = new Set(notes.map(note => note.id));
  const roots = notes.filter(note => !note.parentId || !ids.has(note.parentId));
  const ordered: T[] = [];
  for (const root of roots) {
    ordered.push(root);
    ordered.push(...notes.filter(note => note.parentId === root.id));
  }
  // Older fixtures may contain multi-level replies. Never silently hide them.
  for (const note of notes) {
    if (!ordered.includes(note)) ordered.push(note);
  }
  return ordered;
}

/** New replies to replies attach to their original parent so the UI stays one level deep. */
export function replyRootId(notes: readonly DemoComment[], selectedId: string): string | null {
  let selected = notes.find(note => note.id === selectedId);
  if (!selected) return null;
  const visited = new Set<string>();
  while (selected.parentId && !visited.has(selected.id)) {
    visited.add(selected.id);
    const parent = notes.find(note => note.id === selected?.parentId);
    if (!parent) break;
    selected = parent;
  }
  return selected.id;
}

/** A named collection must never show posts saved only to a different collection. */
export function selectSavedPosts<T extends { id: string }>(
  posts: readonly T[],
  saves: Readonly<Record<string, readonly DemoCollection[]>>,
  selectedCollection: DemoCollection | null
): T[] {
  return posts.filter(post => {
    const collections = saves[post.id] || [];
    return selectedCollection === null
      ? collections.length > 0
      : collections.includes(selectedCollection);
  });
}
