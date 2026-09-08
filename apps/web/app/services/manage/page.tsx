"use client";

import { useEffect, useState } from "react";
import type { Service } from "@hustle/types";
import { deleteService, formatServicePrice, getMyServices, pauseService } from "../../../lib/service";
import styles from "./page.module.css";

export default function ManageServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setServices(await getMyServices());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function pause(service: Service) {
    setBusyId(service.id);
    try {
      const next = await pauseService(service.id);
      setServices((current) => current.map((item) => item.id === next.id ? next : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not pause service");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(service: Service) {
    if (!window.confirm("Delete this service?")) return;
    setBusyId(service.id);
    try {
      await deleteService(service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete service");
    } finally {
      setBusyId(null);
    }
  }

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/account">← Your identity</a><span>PHASE 5 · SERVICES</span></header>
    <section className={styles.hero}>
      <div><p>HUSTLER · OFFERS</p><h1>Services turn skill into <em>something buyable.</em></h1><span>Define clear offers now. Booking, payments and escrow attach in their later phases.</span></div>
      <a className={styles.create} href="/services/new">Create service ↗</a>
    </section>
    {error && <p className={styles.error}>{error}</p>}
    {loading ? <p className={styles.loading}>Loading your offers…</p> : services.length === 0 ? <section className={styles.empty}><h2>No services yet.</h2><p>Your professional identity is public. Now create the first concrete offer attached to it.</p><a href="/services/new">Create your first service ↗</a></section> : <section className={styles.grid}>{services.map((service) => <article key={service.id} className={styles.card}>
      <div className={styles.top}><span>{service.status}</span><small>{service.category ?? "Uncategorized"}</small></div>
      <h2>{service.title ?? "Untitled service"}</h2>
      <strong>{formatServicePrice(service)}</strong>
      <p>{service.description ?? "No description yet."}</p>
      <div className={styles.meta}><span>{service.deliveryMode}</span><span>{service.deliveryTime ?? "Delivery time not set"}</span></div>
      <div className={styles.actions}><a href={`/services/${service.id}/edit`}>Edit</a>{service.status === "PUBLISHED" && <><a href={`/services/${service.id}`} target="_blank" rel="noreferrer">Open ↗</a><button disabled={busyId === service.id} onClick={() => pause(service)}>Pause</button></>}{service.status !== "PUBLISHED" && <button disabled={busyId === service.id} onClick={() => remove(service)}>Delete</button>}</div>
    </article>)}</section>}
  </main>;
}
