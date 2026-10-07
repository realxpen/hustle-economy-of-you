"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  AgentPermissionScope,
  AgentRelationship,
  Post,
  PostMediaType,
  Product,
  ProfessionalProfile,
  Service
} from "@hustle/types";

import {
  addAgentPostMedia,
  archiveAgentPost,
  createAgentPost,
  createAgentProduct,
  createAgentService,
  deleteAgentProduct,
  deleteAgentService,
  getAgentBusinessOverview,
  getAgentBusinessProfile,
  listAgentPosts,
  listAgentProducts,
  listAgentServices,
  pauseAgentProduct,
  pauseAgentService,
  publishAgentBusinessProfile,
  publishAgentPost,
  publishAgentProduct,
  publishAgentService,
  removeAgentPostMedia,
  saveAgentBusinessProfile,
  saveAgentPost,
  saveAgentProduct,
  saveAgentService,
  unpublishAgentBusinessProfile
} from "../../../../lib/agent-business";
import styles from "../../../agents/page.module.css";

const businessScopes: AgentPermissionScope[] = [
  "PROFILE_MANAGE",
  "SERVICE_MANAGE",
  "PRODUCT_MANAGE",
  "CONTENT_MANAGE"
];

function lines(value: string) {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

function tags(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function nairaToMinor(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function minorToNaira(value: number | null) {
  return value === null ? "" : String(value / 100);
}

export default function AgentRepresentationBusinessPage() {
  const params = useParams<{ principalUserId: string }>();
  const principalUserId = params.principalUserId;

  const [overview, setOverview] = useState<AgentRelationship | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    headline: "", primarySkill: "", secondarySkills: "", category: "",
    professionalSummary: "", yearsExperience: "", coverUrl: ""
  });

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    title: "", category: "", description: "", mediaUrls: "", price: "",
    pricingType: "FIXED", deliveryMode: "REMOTE", location: "",
    availabilityNote: "", deliveryTime: "", requirements: ""
  });

  const [productId, setProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    title: "", category: "", description: "", mediaUrls: "", type: "PHYSICAL",
    price: "", trackInventory: false, inventoryQuantity: "", deliveryInformation: ""
  });

  const [postId, setPostId] = useState<string | null>(null);
  const [postForm, setPostForm] = useState({
    caption: "", category: "", location: "", tags: "", mediaUrl: "", mediaType: "IMAGE" as PostMediaType
  });

  const scopes = useMemo(
    () => overview?.permissions.filter((item) => item.active).map((item) => item.scope) ?? [],
    [overview]
  );
  const has = (scope: AgentPermissionScope) => scopes.includes(scope);
  const isHustler = overview?.principal.capabilities?.some(
    (item) => item.capability === "HUSTLER" && item.status === "ACTIVE"
  ) ?? false;

  useEffect(() => { void refresh(); }, [principalUserId]);

  async function refresh() {
    setError(null);
    try {
      const nextOverview = await getAgentBusinessOverview(principalUserId);
      setOverview(nextOverview);
      const nextScopes = nextOverview.permissions.filter((item) => item.active).map((item) => item.scope);

      const [nextProfile, nextServices, nextProducts, nextPosts] = await Promise.all([
        nextScopes.includes("PROFILE_MANAGE") ? getAgentBusinessProfile(principalUserId) : Promise.resolve(null),
        nextScopes.includes("SERVICE_MANAGE") ? listAgentServices(principalUserId).catch(() => []) : Promise.resolve([]),
        nextScopes.includes("PRODUCT_MANAGE") ? listAgentProducts(principalUserId).catch(() => []) : Promise.resolve([]),
        nextScopes.includes("CONTENT_MANAGE") ? listAgentPosts(principalUserId) : Promise.resolve([])
      ]);

      setProfile(nextProfile);
      setServices(nextServices);
      setProducts(nextProducts);
      setPosts(nextPosts);
      if (nextProfile) {
        setProfileForm({
          headline: nextProfile.headline ?? "",
          primarySkill: nextProfile.primarySkill ?? "",
          secondarySkills: nextProfile.secondarySkills.join(", "),
          category: nextProfile.category ?? "",
          professionalSummary: nextProfile.professionalSummary ?? "",
          yearsExperience: nextProfile.yearsExperience === null ? "" : String(nextProfile.yearsExperience),
          coverUrl: nextProfile.coverUrl ?? ""
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load delegated business workspace");
    }
  }

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key); setError(null); setNotice(null);
    try {
      await action();
      setNotice(message);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delegated action failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await run("profile-save", () => saveAgentBusinessProfile(principalUserId, {
      headline: profileForm.headline || null,
      primarySkill: profileForm.primarySkill || null,
      secondarySkills: tags(profileForm.secondarySkills),
      category: profileForm.category || null,
      professionalSummary: profileForm.professionalSummary || null,
      yearsExperience: profileForm.yearsExperience === "" ? null : Number(profileForm.yearsExperience),
      coverUrl: profileForm.coverUrl || null
    }), "Professional profile saved as delegated Agent action.");
  }

  function loadService(item?: Service) {
    setServiceId(item?.id ?? null);
    setServiceForm({
      title: item?.title ?? "", category: item?.category ?? "", description: item?.description ?? "",
      mediaUrls: item?.mediaUrls.join("\n") ?? "", price: minorToNaira(item?.priceMinor ?? null),
      pricingType: item?.pricingType ?? "FIXED", deliveryMode: item?.deliveryMode ?? "REMOTE",
      location: item?.location ?? "", availabilityNote: item?.availabilityNote ?? "",
      deliveryTime: item?.deliveryTime ?? "", requirements: item?.requirements ?? ""
    });
  }

  async function submitService(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: serviceForm.title || null,
      category: serviceForm.category || null,
      description: serviceForm.description || null,
      mediaUrls: lines(serviceForm.mediaUrls),
      priceMinor: nairaToMinor(serviceForm.price),
      pricingType: serviceForm.pricingType as "FIXED" | "STARTING_AT" | "HOURLY",
      deliveryMode: serviceForm.deliveryMode as "REMOTE" | "PHYSICAL" | "BOTH",
      location: serviceForm.location || null,
      availabilityNote: serviceForm.availabilityNote || null,
      deliveryTime: serviceForm.deliveryTime || null,
      requirements: serviceForm.requirements || null
    };
    await run("service-save", () => serviceId
      ? saveAgentService(principalUserId, serviceId, input)
      : createAgentService(principalUserId, input),
      serviceId ? "Service updated for the principal." : "Service draft created for the principal.");
    if (!serviceId) loadService();
  }

  function loadProduct(item?: Product) {
    setProductId(item?.id ?? null);
    setProductForm({
      title: item?.title ?? "", category: item?.category ?? "", description: item?.description ?? "",
      mediaUrls: item?.mediaUrls.join("\n") ?? "", type: item?.type ?? "PHYSICAL",
      price: minorToNaira(item?.priceMinor ?? null), trackInventory: item?.trackInventory ?? false,
      inventoryQuantity: item?.inventoryQuantity === null || item?.inventoryQuantity === undefined ? "" : String(item.inventoryQuantity),
      deliveryInformation: item?.deliveryInformation ?? ""
    });
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: productForm.title || null,
      category: productForm.category || null,
      description: productForm.description || null,
      mediaUrls: lines(productForm.mediaUrls),
      type: productForm.type as "PHYSICAL" | "DIGITAL",
      priceMinor: nairaToMinor(productForm.price),
      trackInventory: productForm.trackInventory,
      inventoryQuantity: productForm.inventoryQuantity === "" ? null : Number(productForm.inventoryQuantity),
      deliveryInformation: productForm.deliveryInformation || null
    };
    await run("product-save", () => productId
      ? saveAgentProduct(principalUserId, productId, input)
      : createAgentProduct(principalUserId, input),
      productId ? "Product updated for the principal." : "Product draft created for the principal.");
    if (!productId) loadProduct();
  }

  function loadPost(item?: Post) {
    setPostId(item?.id ?? null);
    setPostForm({
      caption: item?.caption ?? "", category: item?.category ?? "", location: item?.location ?? "",
      tags: item?.tags.join(", ") ?? "", mediaUrl: "", mediaType: "IMAGE"
    });
  }

  async function submitPost(event: FormEvent) {
    event.preventDefault();
    const input = {
      caption: postForm.caption || null,
      category: postForm.category || null,
      location: postForm.location || null,
      tags: tags(postForm.tags)
    };
    await run("post-save", () => postId
      ? saveAgentPost(principalUserId, postId, input)
      : createAgentPost(principalUserId, input),
      postId ? "Content draft updated for the principal." : "Content draft created for the principal.");
  }

  if (!overview) {
    return <main className={styles.shell}>
      <p className={error ? styles.error : styles.loading}>{error ?? "Loading delegated business workspace…"}</p>
    </main>;
  }

  const professionalBlocked = !isHustler;

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/agent-workspace">← Agent workspace</a>
      <span>PHASE 18D · DELEGATED BUSINESS</span>
    </header>

    <section className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>ACTOR ≠ OWNER</p>
        <h1>{overview.principal.displayName ?? overview.principal.username ?? "Principal"}<br/><em>owns the business.</em></h1>
      </div>
      <p>
        You are acting as the Agent. Every mutation below re-checks the relationship and exact scope
        on the server and writes an actor-vs-owner audit record.
      </p>
    </section>

    {error && <p className={styles.error}>{error}</p>}
    {notice && <p className={styles.notice}>{notice}</p>}

    <section className={styles.boundary}>
      <strong>Granted authority</strong>
      <div className={styles.chips}>
        {scopes.filter((scope) => businessScopes.includes(scope)).map((scope) => <span key={scope}>{scope.replaceAll("_", " ")}</span>)}
      </div>
      <p>
        {professionalBlocked
          ? "This principal is CLIENT-only. Content delegation can work, but Profile/Services/Products remain unavailable until HUSTLER is ACTIVE."
          : "This principal has ACTIVE HUSTLER capability. Professional delegated surfaces can operate within the granted scopes."}
      </p>
    </section>

    {has("PROFILE_MANAGE") && <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}><span>01</span><div><strong>Professional profile</strong><p>Requires PROFILE_MANAGE + principal HUSTLER.</p></div></div>
      {professionalBlocked ? <div className={styles.empty}><strong>Waiting for HUSTLER activation.</strong></div> :
      <form className={styles.card} onSubmit={saveProfile}>
        <label className={styles.field}><span>Headline</span><input value={profileForm.headline} onChange={(e)=>setProfileForm({...profileForm,headline:e.target.value})}/></label>
        <label className={styles.field}><span>Primary skill</span><input value={profileForm.primarySkill} onChange={(e)=>setProfileForm({...profileForm,primarySkill:e.target.value})}/></label>
        <label className={styles.field}><span>Secondary skills — comma separated</span><input value={profileForm.secondarySkills} onChange={(e)=>setProfileForm({...profileForm,secondarySkills:e.target.value})}/></label>
        <label className={styles.field}><span>Category</span><input value={profileForm.category} onChange={(e)=>setProfileForm({...profileForm,category:e.target.value})}/></label>
        <label className={styles.field}><span>Professional summary</span><textarea rows={5} value={profileForm.professionalSummary} onChange={(e)=>setProfileForm({...profileForm,professionalSummary:e.target.value})}/></label>
        <label className={styles.field}><span>Years experience</span><input type="number" min="0" max="80" value={profileForm.yearsExperience} onChange={(e)=>setProfileForm({...profileForm,yearsExperience:e.target.value})}/></label>
        <label className={styles.field}><span>Cover URL</span><input value={profileForm.coverUrl} onChange={(e)=>setProfileForm({...profileForm,coverUrl:e.target.value})}/></label>
        <div className={styles.actions}><span>Status: {profile?.status ?? "NOT CREATED"}</span><div>
          {profile?.status === "PUBLISHED" && <button type="button" className={styles.secondary} disabled={busy!==null} onClick={()=>run("profile-unpublish",()=>unpublishAgentBusinessProfile(principalUserId),"Profile unpublished.")}>Unpublish</button>}
          <button className={styles.secondary} type="submit" disabled={busy!==null}>Save</button>
          <button type="button" className={styles.primary} disabled={busy!==null} onClick={()=>run("profile-publish",()=>publishAgentBusinessProfile(principalUserId),"Profile published by delegated Agent action.")}>Publish</button>
        </div></div>
      </form>}
    </section>}

    {has("SERVICE_MANAGE") && <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}><span>02</span><div><strong>Services</strong><p>Agent may create, edit, publish, pause and delete only this principal&apos;s Services.</p></div></div>
      {professionalBlocked ? <div className={styles.empty}><strong>HUSTLER required.</strong></div> : <>
        <form className={styles.card} onSubmit={submitService}>
          <div className={styles.cardHead}><strong>{serviceId ? "Edit service" : "New service"}</strong>{serviceId && <button type="button" className={styles.secondary} onClick={()=>loadService()}>New draft</button>}</div>
          <label className={styles.field}><span>Title</span><input value={serviceForm.title} onChange={(e)=>setServiceForm({...serviceForm,title:e.target.value})}/></label>
          <label className={styles.field}><span>Category</span><input value={serviceForm.category} onChange={(e)=>setServiceForm({...serviceForm,category:e.target.value})}/></label>
          <label className={styles.field}><span>Description</span><textarea rows={4} value={serviceForm.description} onChange={(e)=>setServiceForm({...serviceForm,description:e.target.value})}/></label>
          <label className={styles.field}><span>Media URLs — one per line</span><textarea rows={3} value={serviceForm.mediaUrls} onChange={(e)=>setServiceForm({...serviceForm,mediaUrls:e.target.value})}/></label>
          <label className={styles.field}><span>Price (NGN)</span><input type="number" min="0" step="0.01" value={serviceForm.price} onChange={(e)=>setServiceForm({...serviceForm,price:e.target.value})}/></label>
          <div className={styles.scopeGrid}>
            <label className={styles.field}><span>Pricing type</span><select value={serviceForm.pricingType} onChange={(e)=>setServiceForm({...serviceForm,pricingType:e.target.value})}><option>FIXED</option><option>STARTING_AT</option><option>HOURLY</option></select></label>
            <label className={styles.field}><span>Delivery mode</span><select value={serviceForm.deliveryMode} onChange={(e)=>setServiceForm({...serviceForm,deliveryMode:e.target.value})}><option>REMOTE</option><option>PHYSICAL</option><option>BOTH</option></select></label>
          </div>
          <label className={styles.field}><span>Location</span><input value={serviceForm.location} onChange={(e)=>setServiceForm({...serviceForm,location:e.target.value})}/></label>
          <label className={styles.field}><span>Availability</span><input value={serviceForm.availabilityNote} onChange={(e)=>setServiceForm({...serviceForm,availabilityNote:e.target.value})}/></label>
          <label className={styles.field}><span>Delivery time</span><input value={serviceForm.deliveryTime} onChange={(e)=>setServiceForm({...serviceForm,deliveryTime:e.target.value})}/></label>
          <label className={styles.field}><span>Requirements</span><textarea rows={3} value={serviceForm.requirements} onChange={(e)=>setServiceForm({...serviceForm,requirements:e.target.value})}/></label>
          <button className={styles.primary} disabled={busy!==null}>{serviceId ? "Save service" : "Create service draft"}</button>
        </form>
        {services.map((item)=><article className={styles.card} key={item.id}>
          <div className={styles.cardHead}><div className={styles.party}><strong>{item.title ?? "Untitled service"}</strong><span>{item.status} · {item.category ?? "No category"}</span></div><button className={styles.secondary} onClick={()=>loadService(item)}>Edit</button></div>
          <div className={styles.actions}><span>{item.priceMinor===null?"No price":`₦${(item.priceMinor/100).toLocaleString()}`}</span><div>
            {item.status==="PUBLISHED" ? <button className={styles.secondary} onClick={()=>run(item.id,()=>pauseAgentService(principalUserId,item.id),"Service paused.")}>Pause</button> : <button className={styles.primary} onClick={()=>run(item.id,()=>publishAgentService(principalUserId,item.id),"Service published.")}>Publish</button>}
            {item.status!=="PUBLISHED" && <button className={styles.danger} onClick={()=>run(item.id,()=>deleteAgentService(principalUserId,item.id),"Service deleted.")}>Delete</button>}
          </div></div>
        </article>)}
      </>}
    </section>}

    {has("PRODUCT_MANAGE") && <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}><span>03</span><div><strong>Products</strong><p>Ownership and inventory stay with the principal.</p></div></div>
      {professionalBlocked ? <div className={styles.empty}><strong>HUSTLER required.</strong></div> : <>
        <form className={styles.card} onSubmit={submitProduct}>
          <div className={styles.cardHead}><strong>{productId ? "Edit product" : "New product"}</strong>{productId && <button type="button" className={styles.secondary} onClick={()=>loadProduct()}>New draft</button>}</div>
          <label className={styles.field}><span>Title</span><input value={productForm.title} onChange={(e)=>setProductForm({...productForm,title:e.target.value})}/></label>
          <label className={styles.field}><span>Category</span><input value={productForm.category} onChange={(e)=>setProductForm({...productForm,category:e.target.value})}/></label>
          <label className={styles.field}><span>Description</span><textarea rows={4} value={productForm.description} onChange={(e)=>setProductForm({...productForm,description:e.target.value})}/></label>
          <label className={styles.field}><span>Media URLs — one per line</span><textarea rows={3} value={productForm.mediaUrls} onChange={(e)=>setProductForm({...productForm,mediaUrls:e.target.value})}/></label>
          <div className={styles.scopeGrid}>
            <label className={styles.field}><span>Type</span><select value={productForm.type} onChange={(e)=>setProductForm({...productForm,type:e.target.value})}><option>PHYSICAL</option><option>DIGITAL</option></select></label>
            <label className={styles.field}><span>Price (NGN)</span><input type="number" min="0" step="0.01" value={productForm.price} onChange={(e)=>setProductForm({...productForm,price:e.target.value})}/></label>
          </div>
          <label style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={productForm.trackInventory} onChange={(e)=>setProductForm({...productForm,trackInventory:e.target.checked})}/> Track inventory</label>
          {productForm.trackInventory && <label className={styles.field}><span>Inventory quantity</span><input type="number" min="0" value={productForm.inventoryQuantity} onChange={(e)=>setProductForm({...productForm,inventoryQuantity:e.target.value})}/></label>}
          <label className={styles.field}><span>Delivery information</span><textarea rows={3} value={productForm.deliveryInformation} onChange={(e)=>setProductForm({...productForm,deliveryInformation:e.target.value})}/></label>
          <button className={styles.primary} disabled={busy!==null}>{productId ? "Save product" : "Create product draft"}</button>
        </form>
        {products.map((item)=><article className={styles.card} key={item.id}>
          <div className={styles.cardHead}><div className={styles.party}><strong>{item.title ?? "Untitled product"}</strong><span>{item.status} · {item.type}</span></div><button className={styles.secondary} onClick={()=>loadProduct(item)}>Edit</button></div>
          <div className={styles.actions}><span>{item.priceMinor===null?"No price":`₦${(item.priceMinor/100).toLocaleString()}`}</span><div>
            {item.status==="PUBLISHED" ? <button className={styles.secondary} onClick={()=>run(item.id,()=>pauseAgentProduct(principalUserId,item.id),"Product paused.")}>Pause</button> : <button className={styles.primary} onClick={()=>run(item.id,()=>publishAgentProduct(principalUserId,item.id),"Product published.")}>Publish</button>}
            {item.status!=="PUBLISHED" && <button className={styles.danger} onClick={()=>run(item.id,()=>deleteAgentProduct(principalUserId,item.id),"Product deleted.")}>Delete</button>}
          </div></div>
        </article>)}
      </>}
    </section>}

    {has("CONTENT_MANAGE") && <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}><span>04</span><div><strong>Content</strong><p>CONTENT_MANAGE works for any Client principal; it does not grant HUSTLER.</p></div></div>
      <form className={styles.card} onSubmit={submitPost}>
        <div className={styles.cardHead}><strong>{postId ? "Edit post" : "New post"}</strong>{postId && <button type="button" className={styles.secondary} onClick={()=>loadPost()}>New draft</button>}</div>
        <label className={styles.field}><span>Caption</span><textarea rows={5} value={postForm.caption} onChange={(e)=>setPostForm({...postForm,caption:e.target.value})}/></label>
        <label className={styles.field}><span>Category</span><input value={postForm.category} onChange={(e)=>setPostForm({...postForm,category:e.target.value})}/></label>
        <label className={styles.field}><span>Location</span><input value={postForm.location} onChange={(e)=>setPostForm({...postForm,location:e.target.value})}/></label>
        <label className={styles.field}><span>Tags — comma separated</span><input value={postForm.tags} onChange={(e)=>setPostForm({...postForm,tags:e.target.value})}/></label>
        <button className={styles.primary} disabled={busy!==null}>{postId ? "Save post" : "Create post draft"}</button>

        {postId && <div className={styles.boundary}>
          <strong>Add public media URL</strong>
          <div className={styles.scopeGrid}>
            <label className={styles.field}><span>Media type</span><select value={postForm.mediaType} onChange={(e)=>setPostForm({...postForm,mediaType:e.target.value as PostMediaType})}><option>IMAGE</option><option>VIDEO</option></select></label>
            <label className={styles.field}><span>Media URL</span><input value={postForm.mediaUrl} onChange={(e)=>setPostForm({...postForm,mediaUrl:e.target.value})}/></label>
          </div>
          <button type="button" className={styles.secondary} disabled={!postForm.mediaUrl || busy!==null} onClick={()=>run("post-media",()=>addAgentPostMedia(principalUserId,postId,{type:postForm.mediaType,mediaUrl:postForm.mediaUrl}),"Media attached.")}>Attach media</button>
        </div>}
      </form>

      {posts.map((item)=><article className={styles.card} key={item.id}>
        <div className={styles.cardHead}><div className={styles.party}><strong>{item.caption?.slice(0,70) || "Untitled post"}</strong><span>{item.status} · {item.media.length} media</span></div><button className={styles.secondary} onClick={()=>loadPost(item)}>Edit</button></div>
        {item.media.length>0 && <div className={styles.history}>{item.media.map((media)=><div key={media.id}><span>{media.type} · {media.mediaUrl ?? "Private media"}</span><button className={styles.danger} onClick={()=>run(media.id,()=>removeAgentPostMedia(principalUserId,item.id,media.id),"Media removed.")}>Remove</button></div>)}</div>}
        <div className={styles.actions}><span>Owned by @{overview.principal.username ?? "principal"}</span><div>
          {item.status!=="PUBLISHED" && <button className={styles.primary} onClick={()=>run(item.id,()=>publishAgentPost(principalUserId,item.id),"Post published.")}>Publish</button>}
          {item.status!=="ARCHIVED" && <button className={styles.secondary} onClick={()=>run(item.id,()=>archiveAgentPost(principalUserId,item.id),"Post archived.")}>Archive</button>}
        </div></div>
      </article>)}
    </section>}

    <section className={styles.boundary}>
      <strong>Still prohibited.</strong>
      <p>
        This workspace does not expose Bookings, Client Messages, wallet, ledger, escrow,
        payouts, Reviews, reputation, login ownership or identity ownership.
      </p>
    </section>
  </main>;
}
