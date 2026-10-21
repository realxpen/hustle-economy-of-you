/**
 * Discover fictional providers through the work they demonstrate.
 * Stateless and offline: no geolocation, APIs, ranking predictions or accounts.
 */
export type DemoExplorePost = {
  name: string;
  handle: string;
  profession: string;
  place: string;
  category: string;
  caption: string;
  headline: string;
  slogan: string;
  offer: { title: string; detail: string };
};

function searchText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Each query term can match any provider, demonstrated-work or offer field. */
export function filterDemoExplorePosts<T extends DemoExplorePost>(
  posts: readonly T[],
  query: string,
  category: string
): T[] {
  const tokens = searchText(query).split(" ").filter(Boolean);
  return posts.filter(post => {
    if (category !== "All" && post.category !== category) return false;
    if (!tokens.length) return true;
    const haystack = searchText([
      post.name, post.handle, post.profession, post.place, post.category,
      post.caption, post.headline, post.slogan,
      post.offer.title, post.offer.detail
    ].join(" "));
    return tokens.every(token => haystack.includes(token));
  });
}
