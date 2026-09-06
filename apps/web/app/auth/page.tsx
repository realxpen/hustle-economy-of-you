"use client";

import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase/client";
import { syncHustleAccount } from "../../lib/auth/hustle-account";

type Mode = "signin" | "signup" | "phone" | "forgot";

function authErrorMessage(reason: unknown) {
  if (reason instanceof Error) {
    if (/load failed|failed to fetch|network request failed|networkerror/i.test(reason.message)) {
      return "Could not reach Supabase Auth. Check NEXT_PUBLIC_SUPABASE_URL and your network connection, then try again.";
    }
    return reason.message;
  }
  return "Authentication failed";
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function finishAuth() {
    const account = await syncHustleAccount();
    window.location.assign(account.onboardingCompleted ? "/account" : "/onboarding");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null); setMessage(null);
    if (!configured) { setError("Connect a dedicated Hustle Supabase project to activate authentication."); return; }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signin") {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        await finishAuth();
      } else if (mode === "signup") {
        const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
        if (result.error) throw result.error;
        if (result.data.session) await finishAuth();
        else setMessage("Check your email to verify your address, then come back to Hustle.");
      } else if (mode === "forgot") {
        const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/update-password` });
        if (result.error) throw result.error;
        setMessage("Password reset instructions are on the way.");
      } else if (!otpSent) {
        const result = await supabase.auth.signInWithOtp({ phone });
        if (result.error) throw result.error;
        setOtpSent(true);
        setMessage("Enter the verification code sent to your phone.");
      } else {
        const result = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
        if (result.error) throw result.error;
        await finishAuth();
      }
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally { setLoading(false); }
  }

  return (
    <main className="authShell">
      <section className="authStory">
        <a className="brandMark" href="/">HUSTLE<span>↗</span></a>
        <div className="storyStack">
          <p className="kicker">ONE IDENTITY / MANY POSSIBILITIES</p>
          <h1>Your work deserves to be <em>seen.</em></h1>
          <p>Start as a Client. Build one reputation. Unlock Hustler and Agent capabilities as your journey grows—without switching accounts.</p>
        </div>
        <div className="storyLoop"><span>Discover</span><span>Trust</span><span>Hire</span><span>Grow</span></div>
      </section>

      <section className="authPanel">
        <div className="authCard">
          <div className="authHeading">
            <span>{mode === "signin" ? "Welcome back" : mode === "signup" ? "Join the economy" : mode === "phone" ? "Continue by phone" : "Reset access"}</span>
            <h2>{mode === "signin" ? "Sign in to Hustle." : mode === "signup" ? "Create your Hustle identity." : mode === "phone" ? "Your number is enough." : "Find your way back."}</h2>
          </div>

          <div className="modeRow" aria-label="Authentication method">
            <button className={mode === "signin" || mode === "forgot" ? "active" : ""} onClick={() => {setMode("signin");setOtpSent(false);}} type="button">Email</button>
            <button className={mode === "phone" ? "active" : ""} onClick={() => {setMode("phone");setOtpSent(false);}} type="button">Phone</button>
          </div>

          <form onSubmit={submit} className="authForm">
            {mode === "phone" ? (
              <>
                <label><span>Phone number</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 801 234 5678" autoComplete="tel" required /></label>
                {otpSent && <label><span>Verification code</span><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" inputMode="numeric" required /></label>}
              </>
            ) : (
              <>
                <label><span>Email address</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required /></label>
                {mode !== "forgot" && <label><span>Password</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 8 characters" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>}
              </>
            )}

            {error && <p className="formNotice errorNotice">{error}</p>}
            {message && <p className="formNotice">{message}</p>}
            {!configured && <p className="setupNotice">Preview mode — Supabase credentials are not connected yet.</p>}

            <button className="primaryAction" disabled={loading} type="submit">
              <span>{loading ? "Working…" : mode === "signin" ? "Enter Hustle" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : otpSent ? "Verify & continue" : "Send code"}</span><b>↗</b>
            </button>
          </form>

          <div className="authFooterActions">
            {mode === "signin" && <><button type="button" onClick={() => setMode("forgot")}>Forgot password?</button><button type="button" onClick={() => setMode("signup")}>New here? Create account</button></>}
            {mode === "signup" && <button type="button" onClick={() => setMode("signin")}>Already have an account? Sign in</button>}
            {mode === "forgot" && <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>}
          </div>
        </div>
        <p className="authPrinciple">One account. One reputation. No role switching.</p>
      </section>
    </main>
  );
}
