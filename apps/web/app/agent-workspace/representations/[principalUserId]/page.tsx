"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ExperienceState } from "../../../../components/experience/experience-state";
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
import {
  acceptAgentBooking,
  cancelAgentBooking,
  declineAgentBooking,
  listAgentBookings,
  listAgentConversationMessages,
  listAgentConversations,
  sendAgentMessage,
  startAgentBooking,
  type AgentBookingRecord,
  type AgentConversationSummary
} from "../../../../lib/agent-client-operations";
import { formatBookingPrice } from "../../../../lib/booking";
import type { MessagingMessage } from "../../../../lib/messaging";
import styles from "../../../agents/page.module.css";

const businessScopes: AgentPermissionScope[] = [
  "PROFILE_MANAGE",
  "SERVICE_MANAGE",
  "PRODUCT_MANAGE",
  "CONTENT_MANAGE",
  "BOOKING_MANAGE",
  "CLIENT_MESSAGE_MANAGE"
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

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AgentRepresentationBusinessPage() {
  const params = useParams<{ principalUserId: string }>();
  const principalUserId = params.principalUserId;
  const refreshVersion = useRef(0);

  const [overview, setOverview] = useState<AgentRelationship | null>(null);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [bookings, setBookings] = useState<AgentBookingRecord[]>([]);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<MessagingMessage[]>([]);
  const [messageText, setMessageText] = useState("");
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

  useEffect(() => {
    // Fail closed on principal navigation until this principal has been authorized by the API.
    setOverview(null); setProfile(null); setServices([]); setProducts([]); setPosts([]); setBookings([]); setConversations([]);
    setSelectedConversationId(null); setConversationMessages([]);
    void refresh();
  }, [principalUserId]);

  async function refresh() {
    const version = ++refreshVersion.current;
    setError(null);
    try {
      const nextOverview = await getAgentBusinessOverview(principalUserId);
      if (version !== refreshVersion.current) return;
      const nextScopes = nextOverview.permissions.filter((item) => item.active).map((item) => item.scope);

      const nextIsHustler = nextOverview.principal.capabilities?.some(
        (item) => item.capability === "HUSTLER" && item.status === "ACTIVE"
      ) ?? false;

      const [nextProfile, nextServices, nextProducts, nextPosts, nextBookings, nextConversations] = await Promise.all([
        nextScopes.includes("PROFILE_MANAGE") && nextIsHustler
          ? getAgentBusinessProfile(principalUserId)
          : Promise.resolve(null),
        nextScopes.includes("SERVICE_MANAGE") && nextIsHustler
          ? listAgentServices(principalUserId)
          : Promise.resolve([]),
        nextScopes.includes("PRODUCT_MANAGE") && nextIsHustler
          ? listAgentProducts(principalUserId)
          : Promise.resolve([]),
        nextScopes.includes("CONTENT_MANAGE")
          ? listAgentPosts(principalUserId)
          : Promise.resolve([]),
        nextScopes.includes("BOOKING_MANAGE") && nextIsHustler
          ? listAgentBookings(principalUserId).then((page) => page.items)
          : Promise.resolve([]),
        nextScopes.includes("CLIENT_MESSAGE_MANAGE")
          ? listAgentConversations(principalUserId).then((page) => page.items)
          : Promise.resolve([])
      ]);

      if (version !== refreshVersion.current) return;
      setOverview(nextOverview);
      setProfile(nextProfile);
      setServices(nextServices);
      setProducts(nextProducts);
      setPosts(nextPosts);
      setBookings(nextBookings);
      setConversations(nextConversations);
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
      if (version !== refreshVersion.current) return;
      setOverview(null); setProfile(null); setServices([]); setProducts([]); setPosts([]); setBookings([]); setConversations([]);
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

  async function openConversation(conversationId: string) {
    setBusy(`conversation-${conversationId}`);
    setError(null);
    try {
      const page = await listAgentConversationMessages(
        principalUserId,
        conversationId,
        { limit: 50 }
      );
      setSelectedConversationId(conversationId);
      setConversationMessages(page.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load represented conversation");
    } finally {
      setBusy(null);
    }
  }

  async function submitAgentMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedConversationId || !messageText.trim()) return;
    setBusy("message-send");
    setError(null);
    setNotice(null);
    try {
      const sent = await sendAgentMessage(
        principalUserId,
        selectedConversationId,
        messageText
      );
      setConversationMessages((current) => [...current, sent]);
      setMessageText("");
      setNotice("Message sent on behalf of the represented account with Agent attribution.");
      const next = await listAgentConversations(principalUserId);
      setConversations(next.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send delegated message");
    } finally {
      setBusy(null);
    }
  }

  if (!overview || overview.principalUserId !== principalUserId) {
    return <main className={styles.shell}>
      <ExperienceState kind={error ? "error" : "loading"} title={error ? "Represented workspace unavailable." : "Checking represented account access…"} description={error ?? undefined} action={error ? { label: "Back to Agent workspace", href: "/agent-workspace" } : undefined} />
    </main>;
  }

  const professionalBlocked = !isHustler;

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <a href="/agent-workspace">← Agent workspace</a>
      <span>DELEGATED OPERATIONS · OWNER-CONTROLLED</span>
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

    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}

    <section className={styles.boundary}>
      <strong>Granted authority</strong>
      <div className={styles.chips}>
        {scopes.filter((scope) => businessScopes.includes(scope)).map((scope) => <span key={scope}>{scope.replaceAll("_", " ")}</span>)}
      </div>
      <p>
        {professionalBlocked
          ? "This principal is CLIENT-only. Content and explicitly granted message assistance can operate, but Profile/Services/Products/Bookings remain unavailable until HUSTLER is ACTIVE."
          : "This principal has ACTIVE HUSTLER capability. Professional and customer-operation scopes can operate within their exact grants."}
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

    {has("BOOKING_MANAGE") && <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}><span>05</span><div><strong>Client bookings</strong><p>Operational booking help only. Payment, refund, completion and settlement authority are excluded.</p></div></div>
      {professionalBlocked ? <div className={styles.empty}><strong>HUSTLER required for booking management.</strong></div> : bookings.length === 0
        ? <div className={styles.empty}><strong>No bookings for this represented Hustler yet.</strong></div>
        : bookings.map((booking) => <article className={styles.card} key={booking.id}>
          <div className={styles.cardHead}>
            <div className={styles.party}>
              <strong>{booking.serviceTitleSnapshot}</strong>
              <span>{booking.status} · Client: {booking.client.displayName ?? booking.client.username ?? "Hustle user"}</span>
            </div>
            <b className={styles.status}>{booking.status}</b>
          </div>
          <div className={styles.history}>
            <div><span>Requested</span><b>{formatDate(booking.requestedStartAt)}</b></div>
            <div><span>Confirmed</span><b>{formatDate(booking.confirmedStartAt)}</b></div>
            <div><span>Price</span><b>{formatBookingPrice(booking)}</b></div>
            <div><span>Requirements</span><b>{booking.requirements}</b></div>
          </div>
          {booking.paymentBoundary.message && <p className={styles.notice}>{booking.paymentBoundary.message}</p>}
          <div className={styles.actions}>
            <span>{booking.nextAction ?? "No delegated booking action available."}</span>
            <div>
              <a className={styles.secondary} href={`/agent-workspace/representations/${encodeURIComponent(principalUserId)}/bookings/${encodeURIComponent(booking.id)}`}>Review full request →</a>
              {booking.agentAllowedActions.includes("ACCEPT") && <button className={styles.primary} disabled={busy!==null} onClick={()=>run(`booking-${booking.id}`,()=>acceptAgentBooking(principalUserId,booking.id),"Booking accepted on the Hustler's behalf.")}>Accept requested time</button>}
              {booking.agentAllowedActions.includes("DECLINE") && <button className={styles.secondary} disabled={busy!==null} onClick={()=>run(`booking-${booking.id}`,()=>declineAgentBooking(principalUserId,booking.id),"Booking declined on the Hustler's behalf.")}>Decline</button>}
              {booking.agentAllowedActions.includes("CANCEL") && <button className={styles.danger} disabled={busy!==null} onClick={()=>run(`booking-${booking.id}`,()=>cancelAgentBooking(principalUserId,booking.id),"Booking cancelled before funded work.")}>Cancel</button>}
              {booking.agentAllowedActions.includes("START") && <button className={styles.primary} disabled={busy!==null} onClick={()=>run(`booking-${booking.id}`,()=>startAgentBooking(principalUserId,booking.id),"Work marked started by delegated Agent action.")}>Start work</button>}
            </div>
          </div>
          {booking.status === "IN_PROGRESS" && <div className={styles.boundary}><strong>Completion stays with the Hustler.</strong><p>The Agent can see active work but cannot mark it complete or trigger settlement/review eligibility.</p></div>}
        </article>)}
    </section>}

    {has("CLIENT_MESSAGE_MANAGE") && <section className={styles.workspaceSection}>
      <div className={styles.sectionHeading}><span>06</span><div><strong>Client messages</strong><p>Read existing direct threads and send text replies with visible Agent attribution.</p></div></div>
      {conversations.length === 0 ? <div className={styles.empty}><strong>No represented conversations yet.</strong></div> : <div className={styles.panelGrid}>
        <div className={styles.relationshipPanel}>
          {conversations.map((conversation) => <button
            key={conversation.id}
            type="button"
            className={selectedConversationId===conversation.id ? styles.scopeActive : styles.scopeButton}
            onClick={()=>void openConversation(conversation.id)}
          >
            <strong>{conversation.otherParticipant?.displayName ?? conversation.otherParticipant?.username ?? "Hustle user"}</strong>
            <span>{conversation.lastMessage?.text ?? (conversation.lastMessage ? "Attachment or shared context" : "No messages yet")}</span>
          </button>)}
        </div>

        <div className={styles.invitePanel}>
          {!selectedConversationId ? <div className={styles.empty}><strong>Select a conversation.</strong><p>Agent reads do not silently clear the account owner's unread state.</p></div> : <>
            <p className={styles.panelLabel}>REPRESENTED THREAD</p>
            <div className={styles.history}>
              {conversationMessages.map((message) => <div key={message.id} style={{display:"grid",gap:4}}>
                <strong>{message.senderId===principalUserId ? (message.delegatedByAgent ? "Principal · via Agent" : "Principal") : (message.sender.displayName ?? message.sender.username ?? "Client")}</strong>
                <span>{message.text ?? "Attachment or shared context"}</span>
                {message.delegatedByAgent && <small>Sent by {message.delegatedByAgent.displayName ?? `@${message.delegatedByAgent.username ?? "agent"}`} on behalf of the principal.</small>}
              </div>)}
            </div>
            <form onSubmit={submitAgentMessage} className={styles.card}>
              <label className={styles.field}><span>Reply as represented account · Agent attribution will be visible</span><textarea rows={4} maxLength={4000} value={messageText} onChange={(e)=>setMessageText(e.target.value)} placeholder="Type a client reply…"/></label>
              <button className={styles.primary} disabled={!messageText.trim() || busy!==null}>{busy==="message-send"?"Sending…":"Send with Agent attribution"}</button>
            </form>
            <p style={{fontSize:12,lineHeight:1.6,opacity:.72}}>This first delegated messaging slice sends text only. It does not expose typing impersonation, private attachment upload, read-receipt control or conversation deletion.</p>
          </>}
        </div>
      </div>}
    </section>}

    <section className={styles.boundary}>
      <strong>Financial and identity authority remains prohibited.</strong>
      <p>
        Agents still cannot complete a Booking, fund or refund transactions, release or redirect
        escrow, access wallet/ledger/payout controls, create Reviews, alter reputation, own login
        credentials or take ownership of the represented identity.
      </p>
    </section>
  </main>;
}
