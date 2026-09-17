"use client";

import { useEffect, useState } from "react";
import { getMyPosts, type Post } from "../../../lib/post";
import styles from "../../products/manage/page.module.css";

export default function PostManagerPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyPosts()
      .then(setPosts)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/account">← Your identity</a><span>CONTENT · EVERY USER</span></header>
    <section className={styles.hero}>
      <div><p>YOUR POSTS</p><h1>Share what you know, saw or <em>experienced.</em></h1><span>Every Hustle identity can publish. Show work, share an opinion, recommend someone, review an experience, @mention people, or reference public Services and Products.</span></div>
      <a className={styles.create} href="/posts/new">Create post ↗</a>
    </section>

    {loading && <p className={styles.message}>Loading posts…</p>}
    {error && <p className={styles.error}>{error}</p>}

    {!loading && !error && posts.length === 0 && <section className={styles.empty}><small>NO POSTS YET</small><h2>Your Hustle identity has a voice too.</h2><p>Post an image or video with useful context. You can reference another user, Service or Product without becoming a Hustler.</p><a href="/posts/new">Create your first post →</a></section>}

    <section className={styles.grid}>
      {posts.map((post) => {
        const first = post.media[0];
        return <article key={post.id} className={styles.card}>
          <div className={styles.media} style={first?.type === "IMAGE" && first.mediaUrl ? { backgroundImage: `url(${first.mediaUrl})` } : undefined}><span>{first?.type ?? "POST"}</span></div>
          <div className={styles.cardBody}>
            <div className={styles.meta}><span>{post.status}</span><span>{post.media.length} MEDIA</span></div>
            <h2>{post.caption?.slice(0, 86) || "Untitled post"}</h2>
            <p>{post.category ?? "Category not set"}</p>
            <strong>{post.serviceAttachments.length + post.productAttachments.length} referenced offers</strong>
            <div className={styles.actions}><a href={`/posts/${post.id}/edit`}>Edit →</a>{post.status === "PUBLISHED" && <a href={`/posts/${post.id}`} target="_blank" rel="noreferrer">Public ↗</a>}</div>
          </div>
        </article>;
      })}
    </section>
  </main>;
}
