"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicService } from "@hustle/types";

import { formatProductPrice, getPublicProduct, type PublicProduct } from "../../lib/product";
import { formatServicePrice, getPublicService } from "../../lib/service";
import styles from "./offer-quick-view.module.css";

export type OfferQuickViewType = "SERVICE" | "PRODUCT";

type LoadedOffer =
  | { type: "SERVICE"; payload: PublicService }
  | { type: "PRODUCT"; payload: PublicProduct };

const offerCache = new Map<string, Promise<LoadedOffer>>();

function cacheKey(type: OfferQuickViewType, id: string) {
  return type + ":" + id;
}

function loadOffer(type: OfferQuickViewType, id: string) {
  const key = cacheKey(type, id);
  const existing = offerCache.get(key);
  if (existing) return existing;

  const request: Promise<LoadedOffer> = type === "SERVICE"
    ? getPublicService(id).then((payload) => ({ type: "SERVICE" as const, payload }))
    : getPublicProduct(id).then((payload) => ({ type: "PRODUCT" as const, payload }));

  offerCache.set(key, request);
  request.catch(() => offerCache.delete(key));
  return request;
}

function isVideo(url: string) {
  const clean = url.split("?")[0]?.toLowerCase() ?? "";
  return [".mp4", ".webm", ".mov", ".m4v"].some((extension) => clean.endsWith(extension))
    || url.startsWith("data:video/");
}

export function OfferQuickView({
  type,
  id,
  label = "Quick view",
  className,
  sourceLabel,
  onOpen
}: {
  type: OfferQuickViewType;
  id: string;
  label?: string;
  className?: string;
  sourceLabel?: string;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LoadedOffer | null>(null);
  const [error, setError] = useState<string | null>(null);

  function preload() {
    void loadOffer(type, id).catch(() => undefined);
  }

  function show() {
    setOpen(true);
    setError(null);
    onOpen?.();
  }

  useEffect(() => {
    if (!open) return;

    let active = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    loadOffer(type, id)
      .then((next) => {
        if (active) setData(next);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load this offer.");
      });

    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [id, open, type]);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [id, type]);

  const model = useMemo(() => {
    if (!data) return null;

    if (data.type === "SERVICE") {
      const { service, owner } = data.payload;
      return {
        typeLabel: "SERVICE",
        title: service.title ?? "Hustle Service",
        description: service.description,
        price: formatServicePrice(service),
        mediaUrl: service.mediaUrls[0] ?? null,
        href: "/services/" + service.id,
        owner,
        facts: [
          service.deliveryMode ? service.deliveryMode.replaceAll("_", " ") : null,
          service.deliveryTime,
          service.location,
          service.availabilityNote
        ].filter(Boolean) as string[],
        action: "View service details →"
      };
    }

    const { product, owner } = data.payload;
    return {
      typeLabel: "PRODUCT",
      title: product.title ?? "Hustle Product",
      description: product.description,
      price: formatProductPrice(product),
      mediaUrl: product.mediaUrls[0] ?? null,
      href: "/products/" + product.id,
      owner,
      facts: [
        product.type === "DIGITAL" ? "Digital product" : "Physical product",
        product.inStock ? "In stock" : "Currently unavailable",
        product.deliveryInformation
      ].filter(Boolean) as string[],
      action: "View product details →"
    };
  }, [data]);

  return <>
    <button
      type="button"
      className={className}
      onClick={show}
      onPointerEnter={preload}
      onFocus={preload}
      aria-haspopup="dialog"
    >
      {label}
    </button>

    {open && <div className={styles.backdrop} role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={(type === "SERVICE" ? "Service" : "Product") + " quick view"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.topline}>
          <span>{sourceLabel ? "QUICK VIEW · " + sourceLabel : "QUICK VIEW"}</span>
          <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="Close quick view">×</button>
        </div>

        {!model && !error && <div className={styles.loading}>
          <strong>Loading offer…</strong>
          <span>Getting the latest canonical Hustle details.</span>
        </div>}

        {error && <div className={styles.error}>
          <strong>Offer unavailable</strong>
          <span>{error}</span>
          <button type="button" onClick={() => {
            offerCache.delete(cacheKey(type, id));
            setError(null);
            void loadOffer(type, id).then(setData).catch((reason) => {
              setError(reason instanceof Error ? reason.message : "Could not load this offer.");
            });
          }}>Try again</button>
        </div>}

        {model && <div className={styles.content}>
          {model.mediaUrl && <div className={styles.media}>
            {isVideo(model.mediaUrl)
              ? <video src={model.mediaUrl} controls playsInline preload="metadata" />
              : <img src={model.mediaUrl} alt="" />}
          </div>}

          <div className={styles.copy}>
            <div className={styles.offerType}>{model.typeLabel}</div>
            <h2>{model.title}</h2>
            <strong className={styles.price}>{model.price}</strong>
            {model.description && <p>{model.description}</p>}

            {model.facts.length > 0 && <div className={styles.facts}>
              {model.facts.slice(0, 4).map((fact) => <span key={fact}>{fact}</span>)}
            </div>}

            <div className={styles.provider}>
              <div className={styles.avatar}>
                {model.owner.avatarUrl
                  ? <img src={model.owner.avatarUrl} alt="" />
                  : (model.owner.displayName ?? model.owner.username ?? "H").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <small>OFFERED BY</small>
                <strong>{model.owner.displayName ?? model.owner.username ?? "Hustler"}</strong>
                <span>@{model.owner.username ?? "hustler"}{model.owner.verified ? " · Verified" : ""}</span>
              </div>
            </div>

            <div className={styles.actions}>
              <Link className={styles.primary} href={model.href} onClick={() => setOpen(false)}>
                {model.action}
              </Link>
              {model.owner.username && <Link
                className={styles.secondary}
                href={"/u/" + model.owner.username}
                onClick={() => setOpen(false)}
              >
                View Hustler
              </Link>}
            </div>
          </div>
        </div>}
      </section>
    </div>}
  </>;
}
