"use client";

import { createContext, type FormEvent, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { getOperationsOverview } from "../lib/admin-api";
import { getAdminSupabaseClient } from "../lib/supabase-client";

type AuthStatus = "loading" | "signed-out" | "authorized" | "forbidden" | "error";
type AdminAuth = {
  token: string;
  status: AuthStatus;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AdminAuth | null>(null);

export function useAdminAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Admin authentication provider is missing");
  return value;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const latestCheck = useRef(0);
  const verifiedToken = useRef("");

  async function validateSession(accessToken: string) {
    const check = ++latestCheck.current;
    if (verifiedToken.current !== accessToken) {
      setToken("");
      setStatus("loading");
    }
    setError(null);
    try {
      // The API's AuthGuard and AdminGuard, not the browser, determine authorization.
      await getOperationsOverview(accessToken);
      if (check !== latestCheck.current) return;
      verifiedToken.current = accessToken;
      setToken(accessToken);
      setStatus("authorized");
    } catch (reason) {
      if (check !== latestCheck.current) return;
      verifiedToken.current = "";
      setToken("");
      const message = reason instanceof Error ? reason.message : "Could not verify Admin access";
      if (/403|admin access required|not synchronized/i.test(message)) {
        setStatus("forbidden");
        setError("This Hustle account is not authorized for Admin operations.");
      } else {
        setStatus("error");
        setError(message);
      }
    }
  }

  function reset() {
    ++latestCheck.current;
    verifiedToken.current = "";
    setToken("");
    setStatus("signed-out");
    setError(null);
  }

  useEffect(() => {
    let live = true;
    try {
      const auth = getAdminSupabaseClient().auth;
      const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
        if (!live) return;
        if (!session) return reset();
        if (verifiedToken.current === session.access_token) return;
        // Defer verification out of the Supabase auth callback to avoid auth-lock deadlocks.
        void validateSession(session.access_token);
      });
      void auth.getSession().then(({ data, error: sessionError }) => {
        if (!live) return;
        if (sessionError) {
          setStatus("error");
          setError(sessionError.message);
        } else if (!data.session) {
          reset();
        } else if (verifiedToken.current !== data.session.access_token) {
          void validateSession(data.session.access_token);
        }
      }).catch((reason: unknown) => {
        if (!live) return;
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Could not restore Admin session");
      });
      return () => { live = false; ++latestCheck.current; subscription.unsubscribe(); };
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Admin authentication unavailable");
    }
  }, []);

  async function signIn(email: string, password: string) {
    const { error: authError } = await getAdminSupabaseClient().auth.signInWithPassword({ email, password });
    if (authError) throw authError;
  }

  async function signOut() {
    const { error: authError } = await getAdminSupabaseClient().auth.signOut();
    if (authError) throw authError;
    reset();
  }

  async function retry() {
    const { data, error: authError } = await getAdminSupabaseClient().auth.getSession();
    if (authError) throw authError;
    if (data.session) await validateSession(data.session.access_token);
    else reset();
  }

  return <AuthContext.Provider value={{ token, status, error, signIn, signOut, retry }}>
    {children}
  </AuthContext.Provider>;
}

export function AdminAccessGate({ children }: { children: ReactNode }) {
  const { status, error, signIn, signOut, retry } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await signIn(email.trim(), password);
      setPassword("");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  if (status === "authorized") return <>{children}</>;
  return <main className="admin-shell auth-shell">
    <section className="auth-card">
      <p className="eyebrow">HUSTLE / SECURE ADMIN</p>
      <h1>{status === "loading" ? "Checking your access." : status === "signed-out" ? "Welcome back." : "Admin access."}</h1>
      {status === "loading" ? <p>Restoring your Hustle session and verifying your permissions…</p> : <>
        <p>Sign in with your existing Hustle account. Only approved Admins can access marketplace operations.</p>
        {error && <div className="banner error" role="alert">{error}</div>}
        {formError && <div className="banner error" role="alert">{formError}</div>}
        {status === "signed-out" && <form onSubmit={(e) => void submit(e)}>
          <label className="field">
            <span>EMAIL</span>
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>PASSWORD</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to Hustle Admin"}</button>
        </form>}
        {(status === "error" || status === "forbidden") && <div className="moderation-actions">
          <button className="secondary" type="button" onClick={() => void retry()}>Retry verification</button>
          <button className="danger" type="button" onClick={() => void signOut()}>Sign out</button>
        </div>}
      </>}
    </section>
  </main>;
}
