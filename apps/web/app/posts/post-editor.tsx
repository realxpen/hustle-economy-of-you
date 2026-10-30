"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ExperienceState } from "../../components/experience/experience-state";
import { useRouter } from "next/navigation";
import { getMarketplacePage } from "../../lib/search";
import { getMyAccount } from "../../lib/auth/hustle-account";
import {
  addPostMedia,
  archivePost,
  attachPostProduct,
  attachPostService,
  createPost,
  detachPostProduct,
  detachPostService,
  getMyPost,
  publishPost,
  removePostMedia,
  savePost,
  type Post,
  type PostMediaType
} from "../../lib/post";
import styles from "../products/product-editor.module.css";
import {
  authorizeStagingPostMedia, confirmStagingPostMedia,
  isStagingTransferTicketFresh, transferFileToPrivateStaging,
  PrivateMediaTransferError,
  validateStagingUploadFile, type MediaUploadAuthorization
} from "../../lib/post-media-upload";
import { isolatedWebMode } from "../../lib/auth/isolated-web-auth";
import { authenticatedFetch } from "../../lib/api/authenticated-fetch";

type PostForm = {
  caption: string;
  category: string;
  location: string;
  tags: string;
};

type OfferOption = {
  id: string;
  title: string | null;
  owner: string;
  ownerUserId: string;
};

const emptyForm: PostForm = { caption: "", category: "", location: "", tags: "" };

/**
 * Pending/attached private media is available only through the signed-in
 * owner preview fetch. Its stable /media/p URL deliberately returns 404
 * until the Post is published; never use it as a fallback for drafts.
 */
function editorMediaPreviewSource(
  item: Post["media"][number] | undefined,
  status: Post["status"] | undefined,
  ownerMediaUrls: Record<string, string>
): string | null {
  if (!item) return null;
  if (item.storageKey?.startsWith("media/") && status !== "PUBLISHED") {
    return ownerMediaUrls[item.id] ?? null;
  }
  return item.mediaUrl ?? null;
}

function toForm(post: Post): PostForm {
  return {
    caption: post.caption ?? "",
    category: post.category ?? "",
    location: post.location ?? "",
    tags: post.tags.join(", ")
  };
}

function parseTags(value: string) {
  return value.split(",").map((item) => item.trim().replace(/^#/, "")).filter(Boolean);
}

export default function PostEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [services, setServices] = useState<OfferOption[]>([]);
  const [products, setProducts] = useState<OfferOption[]>([]);
  const [referenceQuery, setReferenceQuery] = useState("");
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<PostMediaType>("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // Keep the signed receipt when bytes reached S3 but confirmation failed.
  // Retrying verification must NOT upload a second object.
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    file: File; postId: string; receipt: string;
  } | null>(null);
  // An opaque iPhone/S3 network error does not prove storage rejected the file.
  // Keep the SAME signed key and receipt so the owner can verify or retry safely.
  const [pendingTransfer, setPendingTransfer] = useState<{
    file: File; postId: string; ticket: MediaUploadAuthorization; authorizedAtMs: number;
    retryCount: number; checked: boolean;
  } | null>(null);
  const [transferDiagnostic, setTransferDiagnostic] = useState<string | null>(null);
  const [verifyingUpload, setVerifyingUpload] = useState(false);
  const [draftMediaPreviews, setDraftMediaPreviews] = useState<Record<string,string>>({});
  const uploadAbort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!selectedFile) { setSelectedPreview(null); return; }
    const url = URL.createObjectURL(selectedFile);
    setSelectedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  useEffect(() => () => uploadAbort.current?.abort(), []);

  // Draft objects need a Bearer token, so <img src> cannot load the private
  // read route directly. Fetch via the same authenticated bridge and revoke
  // temporary browser blob URLs when the post changes or the account signs out.
  useEffect(() => {
    if (!isolatedWebMode || !post || post.status === "PUBLISHED") {
      setDraftMediaPreviews({});
      return;
    }
    let active = true;
    const objects: string[] = [];
    const controller = new AbortController();
    const privateMedia = post.media.filter(item => item.storageKey?.startsWith("media/"));
    Promise.all(privateMedia.map(async item => {
      try {
        const response = await authenticatedFetch(
          `/media/o/${encodeURIComponent(post.id)}/${encodeURIComponent(item.id)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const blob = await response.blob();
        if (!active) return;
        const url = URL.createObjectURL(blob);
        objects.push(url);
        return { id: item.id, url };
      } catch { return null; }
    })).then(results => {
      if (active) setDraftMediaPreviews(Object.fromEntries(
        results.filter((item): item is { id: string; url: string } => Boolean(item))
          .map(item => [item.id, item.url])
      ));
    });
    return () => {
      active = false;
      controller.abort();
      objects.forEach(url => URL.revokeObjectURL(url));
    };
  }, [post]);
  const [loading, setLoading] = useState(Boolean(postId));
  const [retry, setRetry] = useState(0);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadReferences(query = "") {
    setLoadingReferences(true);
    try {
      const [servicePage, productPage] = await Promise.all([
        getMarketplacePage("services", { q: query, limit: 12 }),
        getMarketplacePage("products", { q: query, limit: 12 })
      ]);
      setServices(servicePage.items.flatMap((item) => item.kind === "service" ? [{
        id: item.service.id,
        title: item.service.title,
        owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
      }] : []));
      setProducts(productPage.items.flatMap((item) => item.kind === "product" ? [{
        id: item.product.id,
        title: item.product.title,
        owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
      }] : []));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load public references");
    } finally {
      setLoadingReferences(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(Boolean(postId));
    setError(null);
    Promise.all([
      postId ? getMyPost(postId) : Promise.resolve(null),
      getMarketplacePage("services", { limit: 12 }),
      getMarketplacePage("products", { limit: 12 }),
      getMyAccount().catch(() => null)
    ])
      .then(([loadedPost, servicePage, productPage, account]) => {
        if (active) setViewerUserId(account?.id ?? null);
        if (!active) return;
        if (loadedPost) {
          setPost(loadedPost);
          setForm(toForm(loadedPost));
        }
        setServices(servicePage.items.flatMap((item) => item.kind === "service" ? [{
          id: item.service.id,
          title: item.service.title,
          owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
        }] : []));
        setProducts(productPage.items.flatMap((item) => item.kind === "product" ? [{
          id: item.product.id,
          title: item.product.title,
          owner: item.owner.displayName ?? item.owner.username ?? "Hustle user",
        ownerUserId: item.owner.id
        }] : []));
      })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [postId, retry]);

  const retryBlocked = Boolean(selectedFile && pendingTransfer?.file === selectedFile &&
    (!pendingTransfer.checked || pendingTransfer.retryCount >= 1 &&
      isStagingTransferTicketFresh(pendingTransfer.ticket, pendingTransfer.authorizedAtMs)));
  const currentId = post?.id ?? postId;
  const published = post?.status === "PUBLISHED";
  const mediaCount = post?.media.length ?? 0;
  const readiness = Math.round(([form.caption.trim(), form.category.trim(), mediaCount > 0].filter(Boolean).length / 3) * 100);
  const attachedServiceIds = useMemo(() => new Set(post?.serviceAttachments.map((item) => item.serviceId) ?? []), [post]);
  const attachedProductIds = useMemo(() => new Set(post?.productAttachments.map((item) => item.productId) ?? []), [post]);

  function buildInput() {
    return {
      caption: form.caption,
      category: form.category,
      location: form.location,
      tags: parseTags(form.tags)
    };
  }

  async function ensurePost(navigate = true) {
    const next = currentId ? await savePost(currentId, buildInput()) : await createPost(buildInput());
    setPost(next);
    setForm(toForm(next));
    if (!currentId && navigate) router.replace(`/posts/${next.id}/edit`);
    return next;
  }

  async function persist(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await ensurePost();
      setNotice("Post draft saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save post");
    } finally {
      setBusy(false);
    }
  }

  async function addMedia() {
    if (busy || !mediaUrl.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await ensurePost();
      const next = await addPostMedia(saved.id, { type: mediaType, mediaUrl: mediaUrl.trim() });
      setPost(next);
      setMediaUrl("");
      setNotice(mediaType === "VIDEO" ? "Video attached." : "Image attached.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add media");
    } finally {
      setBusy(false);
    }
  }

  async function commitUploadedFile(draftId: string, receipt: string, file: File) {
    // Confirmation is owner-scoped and idempotent. A successful POST may have
    // committed even if Safari failed to receive the HTTP response.
    await confirmStagingPostMedia(draftId, receipt);
    // Confirmation can succeed even if the subsequent draft refresh fails.
    // Preserve verification-only recovery; never transfer the bytes again.
    setPendingConfirmation({ file, postId: draftId, receipt });
    setPendingTransfer(null);
    const updated = await getMyPost(draftId);
    setPost(updated);
    if (!currentId) router.replace(`/posts/${draftId}/edit`);
    setPendingConfirmation(null);
    setPendingTransfer(null);
    setSelectedFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setNotice("Private upload attached to your draft. Publish only when ready.");
  }

  async function checkPreviousTransfer() {
    const attempt = pendingTransfer;
    if (busy || !selectedFile || !attempt || attempt.file !== selectedFile) return;
    setBusy(true);
    setVerifyingUpload(true);
    setError(null);
    setNotice(null);
    try {
      // This explicit owner action checks for the signed pending object and
      // attaches it to the DRAFT only if the object exists and passes server
      // signature, MIME, size, ownership and receipt verification.
      await commitUploadedFile(attempt.postId, attempt.ticket.receipt, attempt.file);
    } catch (reason) {
      // An unsuccessful check never proves that the object is absent.
      setPendingTransfer(previous => previous?.ticket === attempt.ticket ? { ...previous, checked: true } : previous);
      setError("The earlier transfer could not be verified. No publication occurred. " +
        (reason instanceof Error ? reason.message : "Try again on a stable connection."));
    } finally {
      setVerifyingUpload(false);
      setBusy(false);
    }
  }

  async function uploadSelectedFile() {
    if (!selectedFile || busy) return;
    const problem = validateStagingUploadFile(selectedFile);
    if (problem) { setError(problem); return; }
    const previousAttempt = pendingTransfer?.file === selectedFile ? pendingTransfer : null;
    if (previousAttempt && !previousAttempt.checked) {
      setError("Check earlier upload first. An unreadable Safari response does not prove S3 rejected the file.");
      return;
    }
    if (previousAttempt && previousAttempt.retryCount >= 1 &&
        isStagingTransferTicketFresh(previousAttempt.ticket, previousAttempt.authorizedAtMs)) {
      setError("One retry was already used for this signed upload. Check earlier upload; request a fresh authorization only after expiry.");
      return;
    }
    const existingReceipt = pendingConfirmation?.file === selectedFile ? pendingConfirmation : null;
    const recoverable = pendingTransfer?.file === selectedFile && 
      isStagingTransferTicketFresh(pendingTransfer.ticket, pendingTransfer.authorizedAtMs)
      ? pendingTransfer : null;
    const controller = new AbortController();
    uploadAbort.current = controller;
    let confirmationStarted = false;
    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferDiagnostic(null);
    setUploadProgress(existingReceipt ? 100 : 0);
    try {
      let draftId: string;
      let receipt: string;
      if (existingReceipt) {
        draftId = existingReceipt.postId;
        receipt = existingReceipt.receipt;
      } else {
        // Retrying uses the SAME pending key if the signed POST policy is still
        // fresh. After expiry, a new key is authorized with the same owner,
        // while old pending uploads are automatically expired by S3 lifecycle.
        const draft = recoverable ? null : await ensurePost(false);
        if (controller.signal.aborted) return;
        const postId = recoverable?.postId ?? draft!.id;
        const ticket = recoverable?.ticket ??
          await authorizeStagingPostMedia(postId, selectedFile);
        if (controller.signal.aborted) return;
        if (!recoverable) setPendingTransfer({
          file: selectedFile, postId, ticket, authorizedAtMs: Date.now(), retryCount: 0, checked: false
        });
        else setPendingTransfer({ ...recoverable, retryCount: recoverable.retryCount + 1, checked: false });
        await transferFileToPrivateStaging(
          selectedFile, ticket, pct => setUploadProgress(pct), controller.signal
        );
        if (controller.signal.aborted) return;
        draftId = postId;
        receipt = ticket.receipt;
        setPendingTransfer(null);
        setPendingConfirmation({ file: selectedFile, postId: draftId, receipt });
      }
      // A verification request can commit the DB. Do not offer cancellation
      // during this stage, even when the browser has not seen a response.
      confirmationStarted = true;
      setVerifyingUpload(true);
      setUploadProgress(100);
      await commitUploadedFile(draftId, receipt, selectedFile);
    } catch (reason) {
      if (controller.signal.aborted && !confirmationStarted) {
        setPendingTransfer(null);
        setNotice("Transfer cancelled. Your draft was not published.");
      } else {
        if (reason instanceof PrivateMediaTransferError) setTransferDiagnostic(reason.diagnostic);
        setError(reason instanceof Error ? reason.message : "Could not finish private media upload");
      }
    } finally {
      if (uploadAbort.current === controller) uploadAbort.current = null;
      setBusy(false);
      setVerifyingUpload(false);
      setUploadProgress(null);
    }
  }

  async function removeMedia(mediaId: string) {
    if (!currentId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await removePostMedia(currentId, mediaId);
      setPost(next);
      setNotice("Media removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove media");
    } finally {
      setBusy(false);
    }
  }

  async function toggleService(serviceId: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePost();
      const next = attachedServiceIds.has(serviceId)
        ? await detachPostService(saved.id, serviceId)
        : await attachPostService(saved.id, serviceId);
      setPost(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update service reference");
    } finally {
      setBusy(false);
    }
  }

  async function toggleProduct(productId: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePost();
      const next = attachedProductIds.has(productId)
        ? await detachPostProduct(saved.id, productId)
        : await attachPostProduct(saved.id, productId);
      setPost(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update product reference");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (busy || !form.caption.trim() || !form.category.trim() || mediaCount === 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await ensurePost();
      const next = await publishPost(saved.id);
      setPost(next);
      setNotice("Post published to Hustle discovery.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish post");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!currentId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await archivePost(currentId);
      setPost(next);
      setNotice("Post archived. It is no longer public.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not archive post");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className={styles.shell}><ExperienceState kind="loading" title="Loading your post…" /></main>;
  if (error && postId && !post) return <main className={styles.shell}>
    <ExperienceState kind="error" title="Could not open this draft." description={error}
      action={{ label: "Try again", onClick:()=>setRetry((count)=>count+1) }} />
  </main>;

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/posts/manage">← Posts</a><span>CONTENT · EVERY HUSTLE IDENTITY</span></header>

    <section className={styles.hero}>
      <div><p>CONTENT · {post?.status ?? "NEW DRAFT"}</p><h1>Share the experience. <em>Reference the opportunity.</em></h1></div>
      <div className={styles.status}><strong>{readiness}%</strong><span>draft checklist</span></div>
    </section>
    <div className={styles.progress} aria-hidden="true"><span style={{ width: `${readiness}%` }} /></div>
    <p className={styles.muted} role="status">Publish checklist: {form.caption.trim() ? "Caption ✓" : "Caption needed"} · {form.category.trim() ? "Category ✓" : "Category needed"} · {mediaCount > 0 ? "Media ✓" : "Media needed"}. Saving a draft is separate from publishing.</p>

    <nav className={styles.creatorNav} aria-label="Choose how to share your work">
      <span aria-current="step">Post</span>
      <a href="/stories/create">Story · 24 hours</a>
      <a href="/live/create">Host a Live</a>
      <a href="/professional-profile">Professional storefront</a>
    </nav>
    <section className={styles.layout}>
      <form className={styles.form} onSubmit={persist} aria-busy={busy}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>What do you want to share?</strong><p>Posts belong to the Hustle user identity. You do not need to be a Hustler to publish.</p></div></div>
        <label><span>Caption *</span><textarea rows={7} maxLength={4000} value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} placeholder="Share work, an experience, recommendation, review-style opinion or useful context. Use @username to reference a Hustle user." /><small>{form.caption.length}/4000 characters · Describe your experience or demonstration.</small></label>
        <div className={styles.twoCol}>
          <label><span>Topic / category *</span><input maxLength={100} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Technology, Fashion, Experience…" /></label>
          <label><span>Location</span><input maxLength={160} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Lagos, Nigeria" /></label>
        </div>
        <label><span>Tags · comma separated</span><input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="review, recommendation, react, lagos" /><small>Up to 20 tags. # is optional.</small></label>

        <div className={styles.sectionTitle}><span>02</span><div><strong>Media</strong><p>Use one video, one image, or multiple images for a carousel.</p></div></div>
        {isolatedWebMode && <div style={{border:"1px solid var(--h-border, #aaa)",borderRadius:18,padding:16,marginBottom:18,display:"grid",gap:12}}>
          <strong>Upload from your iPhone</strong>
          <p className={styles.muted}>Choose a JPEG, PNG or WebP image (up to 8 MB), or an MP4/iPhone MOV video (up to 30 MB). Add up to 10 photos or one video. MOV playback depends on the viewer’s device and codec; MP4 is recommended for widest reach. HEIC photos still need JPEG export. Files stay private until publishing.</p>
          <label>
            <span>Choose photo or video</span>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,.mov"
              disabled={busy || published || mediaCount >= 10 || Boolean(post?.media.some(item => item.type === "VIDEO"))}
              onChange={event => {
                const next = event.target.files?.[0] ?? null;
                setSelectedFile(next);
                 setTransferDiagnostic(null);
                setPendingConfirmation(null);
                setPendingTransfer(null);
                setError(next ? validateStagingUploadFile(next) : null);
              }} />
          </label>
          {selectedFile && <div style={{display:"grid",gap:10}}>
            <p className={styles.muted} role="status">Selected: {selectedFile.name} · {(selectedFile.size / 1_000_000).toFixed(2)} MB</p>
            {validateStagingUploadFile(selectedFile) && <p role="alert" style={{color:"#b44e38",fontWeight:700}}>{validateStagingUploadFile(selectedFile)}</p>}
            {selectedFile.name.toLowerCase().endsWith(".mov") && <p className={styles.muted}>iPhone MOV is supported for this private upload, but other viewers may need an MP4 version for compatible playback.</p>}
            {selectedPreview && (selectedFile.type.startsWith("image/")
              ? <img src={selectedPreview} alt="Your selected photo preview" style={{maxWidth:"100%",maxHeight:230,objectFit:"contain",borderRadius:12}} />
              : <video src={selectedPreview} controls preload="metadata" style={{maxWidth:"100%",maxHeight:230,borderRadius:12}} />)}
            {pendingTransfer?.file === selectedFile && <p className={styles.muted} role="status">Check the earlier upload before retrying; one same-key retry is allowed per signed authorization. A failed check does not prove storage is empty; this post remains a draft.</p>}
            {transferDiagnostic && <p className={styles.muted} role="status">Safe Safari diagnostic: <code>{transferDiagnostic}</code>. No file, account or signed authorization details. This is not a confirmed root cause.</p>}
            {uploadProgress !== null && <div role="status" aria-live="polite">
              <progress value={uploadProgress} max={100} style={{width:"100%"}} />
              <small>{uploadProgress >= 99 ? "Verifying your uploaded media…" : `Uploading ${uploadProgress}%`}</small>
            </div>}
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => void uploadSelectedFile()} disabled={busy || retryBlocked || Boolean(validateStagingUploadFile(selectedFile))}>{pendingConfirmation?.file === selectedFile ? "Retry verification" : pendingTransfer?.file === selectedFile ? "Retry private transfer" : "Upload privately"}</button>
              {pendingTransfer?.file === selectedFile && !busy && <button type="button" className={styles.secondary} onClick={() => void checkPreviousTransfer()}>Check earlier upload first</button>}
              <button type="button" className={styles.secondary} disabled={verifyingUpload} onClick={() => {
                uploadAbort.current?.abort();
                if (!busy) {
                  setPendingConfirmation(null);
                  setPendingTransfer(null);
                  setSelectedFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }
              }}>{verifyingUpload ? "Verifying media…" : busy ? "Cancel transfer" : "Remove selection"}</button>
            </div>
          </div>}
        </div>}
        <div className={styles.twoCol}>
          <label><span>Media type</span><select value={mediaType} onChange={(event) => setMediaType(event.target.value as PostMediaType)} disabled={busy || Boolean(mediaCount > 0 && post?.media[0]?.type === "VIDEO")}><option value="IMAGE">Image</option><option value="VIDEO">Video</option></select></label>
          <label><span>Or use a public media URL</span><input type="url" inputMode="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…" /></label>
        </div>
        <div className={styles.actions}><button className={styles.secondary} type="button" onClick={addMedia} disabled={busy || !mediaUrl.trim()}>{busy ? "Working…" : "Add media"}</button></div>
        <div className={styles.variantList}>
          {post?.media.map((item, index) => {
            const source = editorMediaPreviewSource(item, post.status, draftMediaPreviews);
            return <article className={styles.variantCard} key={item.id}>
              <strong>{index + 1}. {item.type}</strong>
              {source ? (item.type === "VIDEO"
                ? <video src={source} controls preload="metadata" style={{width:"100%",maxHeight:200,objectFit:"contain",borderRadius:12}} />
                : <img src={source} loading="lazy" alt={`Attached post image ${index+1}`} style={{width:"100%",maxHeight:200,objectFit:"contain",borderRadius:12}} />
              ) : item.storageKey?.startsWith("media/") && post.status !== "PUBLISHED"
                ? <p role="status" className={styles.muted}>Loading your private media preview…</p>
                : null}
              <p className={styles.muted}>{item.storageKey ? "Private media attached to this draft" : (item.mediaUrl ?? "No source")}</p>
              <div className={styles.variantActions}><button className={styles.dangerText} type="button" onClick={() => void removeMedia(item.id)} disabled={busy}>Remove</button></div>
            </article>;
          })}
          {mediaCount === 0 && <p className={styles.muted}>No media yet. Add one image or video to publish; incomplete drafts can still be saved.</p>}
        </div>

        <div className={styles.sectionTitle}><span>03</span><div><strong>Link an offer to your post</strong><p>All published services and products can be discovered by every Hustle account. Link your own listing to promote it, or mention another Hustler's offer as a recommendation. Linking does not transfer ownership or count as a verified review.</p></div></div>
        <label><span>Search public offers</span><div className={styles.twoCol}><input type="search" value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)} placeholder="Search product, service or creator name" /><button className={styles.secondary} type="button" onClick={() => void loadReferences(referenceQuery.trim())} disabled={loadingReferences}>{loadingReferences ? "Searching…" : "Search"}</button></div></label>
        <div className={styles.variants}>
          <strong>Published services</strong>
          <div className={styles.variantList}>{services.length === 0 ? <p className={styles.muted}>No matching published services.</p> : services.map((service) => <label className={styles.check} key={service.id}><input type="checkbox" checked={attachedServiceIds.has(service.id)} onChange={() => void toggleService(service.id)} disabled={busy} /> {service.title ?? "Untitled service"} <small>· {viewerUserId && service.ownerUserId === viewerUserId ? "Your service" : `Offered by ${service.owner} · Public reference`}</small></label>)}</div>
          <strong>Published products</strong>
          <div className={styles.variantList}>{products.length === 0 ? <p className={styles.muted}>No matching published products.</p> : products.map((product) => <label className={styles.check} key={product.id}><input type="checkbox" checked={attachedProductIds.has(product.id)} onChange={() => void toggleProduct(product.id)} disabled={busy} /> {product.title ?? "Untitled product"} <small>· {viewerUserId && product.ownerUserId === viewerUserId ? "Your product" : `Sold by ${product.owner} · Public reference`}</small></label>)}</div>
        </div>

        <p className={styles.notice}>An attached service or product always belongs to its original seller. Anyone may link a public offer, but a post or #review tag is not a transaction-verified rating. Only the separate verified Booking/Order review flow affects reputation.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <div className={styles.actions}>
          <button className={styles.secondary} type="submit" disabled={busy}>{busy ? "Working…" : "Save draft"}</button>
          {!published ? <button className={styles.primary} type="button" onClick={() => void publish()} disabled={busy || !form.caption.trim() || !form.category.trim() || mediaCount === 0}>Publish post ↗</button> : <button className={styles.secondary} type="button" onClick={() => void archive()} disabled={busy}>Archive post</button>}
          {currentId && post?.status === "PUBLISHED" && <a className={styles.publicLink} href={`/posts/${currentId}`} target="_blank" rel="noreferrer">Open public post ↗</a>}
        </div>
        {!published && (!form.caption.trim() || !form.category.trim() || mediaCount === 0) && <p className={styles.muted}>To publish: add a caption, category and media. You can save your work as a draft first.</p>}
      </form>

      <aside className={styles.preview}>
        <p className={styles.previewLabel}>CONTENT PREVIEW</p>
        <div className={styles.media}>{(() => {
          const item = post?.media[0];
          const source = editorMediaPreviewSource(item, post?.status, draftMediaPreviews);
          if (!source) return <span role="status">{item?.storageKey?.startsWith("media/") && post?.status !== "PUBLISHED" ? "Loading private preview…" : "Post media"}</span>;
          return item?.type === "VIDEO"
            ? <video src={source} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <img src={source} alt="Post image preview" style={{width:"100%",height:"100%",objectFit:"cover"}} />;
        })()}</div>
        <div className={styles.previewBody}>
          <span className={styles.badge}>{form.category || "CATEGORY"}</span>
          <h2>{form.caption ? form.caption.slice(0, 72) : "What you want to share"}</h2>
          <p>{form.location || "Location optional"}</p>
          <div className={styles.previewMeta}><span>{mediaCount} media</span><span>{attachedServiceIds.size + attachedProductIds.size} references</span></div>
        </div>
      </aside>
    </section>
  </main>;
}
