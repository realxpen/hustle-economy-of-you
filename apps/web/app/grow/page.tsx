"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getCreatorActivation, type CreatorActivationSnapshot } from "../../lib/creator-activation";
import styles from "./page.module.css";

type LoadState = { status: "loading" | "error" | "ready"; data: CreatorActivationSnapshot | null; error: string | null };

const actions = {
  post: { href: "/posts/new", label: "Create a post" },
  posts: { href: "/posts/manage", label: "Manage your posts" },
  application: { href: "/hustler-application", label: "Apply to become a Hustler" },
  professional: { href: "/professional-profile", label: "Build your professional profile" },
  service: { href: "/services/new", label: "Create a service" },
  services: { href: "/services/manage", label: "Manage your services" }
};

function Step({ number, complete, title, description, href, action }: {
  number: string; complete: boolean; title: string; description: string;
  href: string; action: string;
}) {
  return <article className={styles.step}>
    <div className={styles.stepIndex} aria-hidden="true">{complete ? "✓" : number}</div>
    <div className={styles.stepBody}>
      <div className={styles.stepTitle}><h3>{title}</h3><span>{complete ? "Ready" : "Next action"}</span></div>
      <p>{description}</p>
      <Link href={href} className={styles.stepLink}>{action} <span aria-hidden="true">↗</span></Link>
    </div>
  </article>;
}

export default function GrowPage() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: null });
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", data: null, error: null });
    getCreatorActivation()
      .then(data => { if (active) setState({ status: "ready", data, error: null }); })
      .catch(reason => {
        if (active) setState({
          status: "error", data: null,
          error: reason instanceof Error ? reason.message : "Unable to load your creative progress"
        });
      });
    return () => { active = false; };
  }, [version]);

  const data = state.data;
  const hustler = data?.identity.hustlerActive ?? false;
  const hasProof = (data?.counts.publishedPosts ?? 0) > 0;
  const hasOffer = ((data?.counts.publishedServices ?? 0) + (data?.counts.publishedProducts ?? 0)) > 0;
  const hasOpportunityLink = (data?.counts.linkedPublishedPosts ?? 0) > 0;

  return <main className={styles.page}>
    <div className={styles.toolbar}>
      <Link href="/account">← Your account</Link>
      <button type="button" onClick={refresh} disabled={state.status === "loading"}>
        {state.status === "loading" ? "Checking…" : "Refresh progress"}
      </button>
    </div>
    <header className={styles.hero}>
      <p className={styles.overline}>HUSTLE · CREATE → DISCOVER → GROW</p>
      <h1>Make your work <em>findable.</em></h1>
      <p>Share your experience, show what you can do, and connect it to real opportunity. Everything here comes from your Hustle account—no separate creator identity.</p>
    </header>

    {state.status === "loading" && <section className={styles.state} role="status">Reading your posts and opportunities from Hustle…</section>}
    {state.status === "error" && <section className={styles.state} role="alert">
      <h2>We couldn't read your progress.</h2><p>{state.error}</p>
      <button type="button" onClick={refresh}>Try again</button>
      <p>If you aren't signed in, <Link href="/auth?next=%2Fgrow">sign in</Link> to continue.</p>
    </section>}
    {data && <div className={styles.content}>
      <section className={styles.snapshot} aria-label="Your real Hustle activity">
        <div><strong>{data.counts.publishedPosts}</strong><span>Published posts</span></div>
        <div><strong>{data.counts.linkedPublishedPosts}</strong><span>Posts linking to published offers</span></div>
        <div><strong>{data.counts.publishedServices + data.counts.publishedProducts}</strong><span>Your published offers</span></div>
        <div><strong>{data.counts.completedBookings}</strong><span>Completed bookings as Hustler</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><p className={styles.overline}>YOUR NEXT MOVES</p><h2>From capability to opportunity.</h2></div><span>{data.identity.username ? "One Hustle identity" : "Complete your identity"}</span></div>
        <div className={styles.steps}>
          <Step number="01" complete={Boolean(data.identity.username)} title="Make your identity recognizable"
            description={data.identity.username ? `Your public handle is @${data.identity.username}.` : "Choose a public username so people can find and recognize your work."}
            href="/onboarding" action={data.identity.username ? "Edit your identity" : "Choose a username"} />
          <Step number="02" complete={hasProof} title="Publish proof of your work or experience"
            description={hasProof
              ? `You have ${data.counts.publishedPosts} published ${data.counts.publishedPosts === 1 ? "post" : "posts"}. Others can discover published work; your own For You feed may exclude your posts.`
              : "A Client can post too. Create an image, carousel, or video post with a caption and category. Staging currently uses public HTTPS media links, not direct phone uploads."}
            href={hasProof ? actions.posts.href : actions.post.href} action={hasProof ? actions.posts.label : actions.post.label} />
          <Step number="03" complete={hustler && data.identity.professionalProfilePublished}
            title="Unlock your professional storefront"
            description={hustler
              ? data.identity.professionalProfilePublished
                ? "Your professional profile is published and can represent the services or products you sell."
                : "You're an active Hustler. Publish your professional profile so customers can assess your skills."
              : "Posting is open to every account. Selling services or products requires approved Hustler capability on this same account."}
            href={hustler ? actions.professional.href : actions.application.href}
            action={hustler ? actions.professional.label : actions.application.label} />
          {hustler && <>
            <Step number="04" complete={hasOffer} title="Make a service or product bookable"
              description={hasOffer
                ? `You have ${data.counts.publishedServices} published services and ${data.counts.publishedProducts} published products.`
                : "Offer an actual published service or product, with price and details. Only eligible listings are public."}
              href={hasOffer ? actions.services.href : actions.service.href}
              action={hasOffer ? actions.services.label : actions.service.label} />
            <Step number="05" complete={hasOpportunityLink} title="Connect a post to a useful offer"
              description={hasOpportunityLink
                ? `${data.counts.linkedPublishedPosts} of your published posts reference at least one currently published offer.`
                : "Use the post editor to attach a published Service or Product. References always keep the original seller's identity; they are not verified reviews."}
              href={hasProof ? actions.posts.href : actions.post.href}
              action={hasProof ? actions.posts.label : actions.post.label} />
          </>}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><p className={styles.overline}>YOUR PROOF</p><h2>Recent posts</h2></div><Link href="/posts/manage">All posts ↗</Link></div>
        {data.recentPosts.length === 0
          ? <div className={styles.empty}><p>Your first public proof starts with one genuine post.</p><Link href="/posts/new">Create your first post ↗</Link></div>
          : <div className={styles.postList}>{data.recentPosts.map(post => <article className={styles.post} key={post.id}>
            <div><span className={styles.postStatus}>{post.status.replaceAll("_", " ")}</span>
              <h3>{post.caption || "Untitled post"}</h3>
              <small>{post.mediaCount} media · {post.publishedOfferReferences} currently published offer references</small>
            </div>
            <Link href={post.status === "PUBLISHED" ? `/posts/${post.id}` : `/posts/${post.id}/edit`}>
              {post.status === "PUBLISHED" ? "View public post ↗" : "Continue editing ↗"}
            </Link>
          </article>)}</div>}
      </section>

      <footer className={styles.footer}>
        <p>This workspace only reads your progress. Post publishing, Services, Bookings and reviews remain controlled by their existing permission and approval systems.</p>
        <Link href="/home">Explore other Hustlers →</Link>
      </footer>
    </div>}
  </main>;
}
