"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatProductPrice } from "../../../lib/product";
import { formatServicePrice } from "../../../lib/service";
import {
  addPostComment,
  deletePostComment,
  followUser,
  getMyPostInteractionState,
  getPostInteractions,
  getPublicPost,
  likePost,
  recordPostShare,
  savePublicPost,
  unlikePost,
  unfollowUser,
  unsavePublicPost,
  type PostInteractionState,
  type PostInteractionSummary,
  type PublicPost
} from "../../../lib/post";
import styles from "./page.module.css";

export default function PublicPostPage() {
  const params = useParams<{ postId: string }>();
  const [data, setData] = useState<PublicPost | null>(null);
  const [interactions, setInteractions] = useState<PostInteractionSummary | null>(null);
  const [viewer, setViewer] = useState<PostInteractionState | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getPublicPost(params.postId),
      getPostInteractions(params.postId),
      getMyPostInteractionState(params.postId).catch(() => null)
    ])
      .then(([nextPost, nextInteractions, nextViewer]) => {
        setData(nextPost);
        setInteractions(nextInteractions);
        setViewer(nextViewer);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [params.postId]);

  async function refreshInteractions() {
    const [nextInteractions, nextViewer] = await Promise.all([
      getPostInteractions(params.postId),
      getMyPostInteractionState(params.postId).catch(() => null)
    ]);
    setInteractions(nextInteractions);
    setViewer(nextViewer);
  }

  function requireViewer() {
    if (viewer) return true;
    setInteractionError("Sign in with your Hustle account to like, save, follow or comment.");
    return false;
  }

  async function toggleLike() {
    if (!requireViewer() || !viewer) return;
    setBusy("like");
    setInteractionError(null);
    try {
      setViewer(viewer.liked ? await unlikePost(params.postId) : await likePost(params.postId));
      setInteractions((current) => current ? {
        ...current,
        likeCount: Math.max(0, current.likeCount + (viewer.liked ? -1 : 1))
      } : current);
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : "Could not update like");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSave() {
    if (!requireViewer() || !viewer) return;
    setBusy("save");
    setInteractionError(null);
    try {
      setViewer(viewer.saved ? await unsavePublicPost(params.postId) : await savePublicPost(params.postId));
      setInteractions((current) => current ? {
        ...current,
        saveCount: Math.max(0, current.saveCount + (viewer.saved ? -1 : 1))
      } : current);
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : "Could not update save");
    } finally {
      setBusy(null);
    }
  }

  async function toggleFollow() {
    if (!data || !requireViewer() || !viewer || viewer.isCreator) return;
    setBusy("follow");
    setInteractionError(null);
    try {
      if (viewer.followingCreator) await unfollowUser(data.owner.id);
      else await followUser(data.owner.id);
      setViewer({ ...viewer, followingCreator: !viewer.followingCreator });
      setInteractions((current) => current ? {
        ...current,
        followerCount: Math.max(0, current.followerCount + (viewer.followingCreator ? -1 : 1))
      } : current);
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : "Could not update follow");
    } finally {
      setBusy(null);
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!requireViewer() || !commentBody.trim()) return;
    setBusy("comment");
    setInteractionError(null);
    try {
      await addPostComment(params.postId, commentBody);
      setCommentBody("");
      await refreshInteractions();
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : "Could not add comment");
    } finally {
      setBusy(null);
    }
  }

  async function removeComment(commentId: string) {
    if (!window.confirm("Delete your comment?")) return;
    setBusy(commentId);
    setInteractionError(null);
    try {
      await deletePostComment(params.postId, commentId);
      await refreshInteractions();
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : "Could not delete comment");
    } finally {
      setBusy(null);
    }
  }

  async function sharePost() {
    setBusy("share");
    setInteractionError(null);
    setNotice(null);
    try {
      const shareData = {
        title: data?.post.caption?.slice(0, 80) ?? "Hustle post",
        text: data?.post.caption ?? "See this demonstrated capability on Hustle.",
        url: window.location.href
      };
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setNotice("Post link copied.");
      } else {
        setNotice("Copy the URL from your browser to share this post.");
      }
      await recordPostShare(params.postId);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setInteractionError(reason instanceof Error ? reason.message : "Could not share post");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <main className={styles.shell}><section className={styles.notFound}><p>CONTENT UNAVAILABLE</p><h1>This post is not public.</h1><span>{error}</span><a href="/">Back to Hustle →</a></section></main>;
  if (!data || !interactions) return <main className={styles.shell}><p className={styles.loading}>Loading post…</p></main>;

  const { post, owner } = data;
  const initial = (owner.displayName ?? owner.username ?? "H").charAt(0).toUpperCase();

  return <main className={styles.shell}>
    <header className={styles.header}><a className={styles.brand} href="/">HUSTLE↗</a><span>DEMONSTRATED CAPABILITY</span></header>

    <section className={styles.layout}>
      <div className={styles.content}>
        <div className={styles.mediaGrid}>
          {post.media.map((item) => item.type === "VIDEO"
            ? <video className={styles.media} key={item.id} src={item.mediaUrl ?? undefined} controls playsInline />
            : <img className={styles.media} key={item.id} src={item.mediaUrl ?? ""} alt="Post media" />)}
        </div>
        <div className={styles.body}>
          <div className={styles.meta}><span>{post.category}</span>{post.location && <span>{post.location}</span>}</div>
          <p className={styles.caption}>{post.caption}</p>
          {post.tags.length > 0 && <div className={styles.tags}>{post.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          <div className={styles.interactionBar}>
            <button type="button" className={viewer?.liked ? styles.activeAction : ""} onClick={toggleLike} disabled={busy === "like"}>{viewer?.liked ? "♥" : "♡"} {interactions.likeCount} Like</button>
            <button type="button" className={viewer?.saved ? styles.activeAction : ""} onClick={toggleSave} disabled={busy === "save"}>{viewer?.saved ? "Saved" : "Save"} · {interactions.saveCount}</button>
            <button type="button" onClick={sharePost} disabled={busy === "share"}>Share ↗</button>
          </div>
          {notice && <p className={styles.notice}>{notice}</p>}
          {interactionError && <p className={styles.interactionError}>{interactionError} {!viewer && <a href="/auth">Sign in →</a>}</p>}
        </div>
      </div>

      <aside className={styles.ownerCard}>
        <small>CREATOR</small>
        <div className={styles.ownerTop}>
          <div className={styles.avatar}>{owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initial}</div>
          <div><h2>{owner.displayName ?? owner.username ?? "Hustler"}</h2><span>@{owner.username ?? "hustler"}{owner.verified ? " · Verified" : ""}</span></div>
        </div>
        <p>{owner.professionalProfile.headline ?? owner.professionalProfile.professionalSummary ?? owner.bio}</p>
        <div className={styles.skills}>{[owner.professionalProfile.primarySkill, ...owner.professionalProfile.secondarySkills].filter(Boolean).map((skill) => <span key={skill ?? "skill"}>{skill}</span>)}</div>
        <div className={styles.followLine}><span>{interactions.followerCount} follower{interactions.followerCount === 1 ? "" : "s"}</span>{!viewer?.isCreator && <button type="button" onClick={toggleFollow} disabled={busy === "follow"}>{viewer?.followingCreator ? "Following" : "Follow"}</button>}</div>
        {!viewer?.isCreator && <a className={styles.profileLink} href={`/messages/start?userId=${encodeURIComponent(owner.id)}&contextType=POST&contextId=${encodeURIComponent(post.id)}`}>Message creator about this post →</a>}
        {owner.username && <a className={styles.profileLink} href={`/u/${owner.username}`}>View professional identity →</a>}
      </aside>
    </section>

    {(post.serviceAttachments.length > 0 || post.productAttachments.length > 0) && <section className={styles.offers}>
      <div className={styles.sectionHeading}><small>ATTACHED OPPORTUNITIES</small><h2>Move from proof to action.</h2></div>
      <div className={styles.offerGrid}>
        {post.serviceAttachments.map(({ service }) => <a className={styles.offerCard} key={service.id} href={`/services/${service.id}`}>
          <span>SERVICE</span><h3>{service.title ?? "Service"}</h3><p>{service.description?.slice(0, 150)}</p><strong>{formatServicePrice(service)}</strong><b>View service →</b>
        </a>)}
        {post.productAttachments.map(({ product }) => <a className={styles.offerCard} key={product.id} href={`/products/${product.id}`}>
          <span>PRODUCT</span><h3>{product.title ?? "Product"}</h3><p>{product.description?.slice(0, 150)}</p><strong>{formatProductPrice(product)}</strong><b>View product →</b>
        </a>)}
      </div>
    </section>}

    <section className={styles.comments}>
      <div className={styles.sectionHeading}><small>CONVERSATION</small><h2>{interactions.commentCount} comment{interactions.commentCount === 1 ? "" : "s"}</h2></div>
      {viewer ? <form className={styles.commentForm} onSubmit={submitComment}><textarea maxLength={1200} rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Add useful context, ask about the work, or respond to the capability shown…" /><button type="submit" disabled={busy === "comment" || !commentBody.trim()}>{busy === "comment" ? "Posting…" : "Post comment"}</button></form> : <div className={styles.signInPrompt}><span>Join the conversation with your Hustle identity.</span><a href="/auth">Sign in →</a></div>}
      <div className={styles.commentList}>
        {interactions.comments.length === 0 && <p className={styles.muted}>No comments yet.</p>}
        {interactions.comments.map((comment) => <article key={comment.id} className={comment.parentId ? styles.replyComment : styles.commentCard}>
          <div className={styles.commentAvatar}>{comment.user.avatarUrl ? <img src={comment.user.avatarUrl} alt="" /> : (comment.user.displayName ?? comment.user.username ?? "H").charAt(0).toUpperCase()}</div>
          <div><div className={styles.commentMeta}><strong>{comment.user.displayName ?? comment.user.username ?? "Hustle user"}</strong><span>@{comment.user.username ?? "user"}</span>{comment.parentId && <em>reply</em>}</div><p>{comment.body}</p></div>
          {viewer?.viewerUserId === comment.user.id && <button className={styles.deleteComment} type="button" onClick={() => removeComment(comment.id)} disabled={busy === comment.id}>Delete</button>}
        </article>)}
      </div>
    </section>
  </main>;
}
