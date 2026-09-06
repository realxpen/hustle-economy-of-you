"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../../lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    if (!isSupabaseConfigured()) { setError("Hustle authentication is not configured yet."); return; }
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else setMessage("Password updated. You can continue to your Hustle account.");
  }

  return <main className="simpleAuthPage"><section className="simpleCard"><a className="brandMark" href="/">HUSTLE<span>↗</span></a><p className="kicker">ACCOUNT RECOVERY</p><h1>Choose a new password.</h1><form onSubmit={submit} className="authForm"><label><span>New password</span><input type="password" minLength={8} required value={password} onChange={(e)=>setPassword(e.target.value)} /></label>{error&&<p className="formNotice errorNotice">{error}</p>}{message&&<p className="formNotice">{message}</p>}<button className="primaryAction" type="submit"><span>Update password</span><b>↗</b></button></form></section></main>;
}
