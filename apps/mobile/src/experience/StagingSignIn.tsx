import { useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { getStagingAuth, validateExpoStagingConfiguration } from "../lib/staging-auth";
import { MobileExperience } from "./MobileExperience";

export function StagingSignIn() {
  try { validateExpoStagingConfiguration(); }
  catch { return <SafeAreaView><Text>The isolated test login is not configured.</Text></SafeAreaView>; }
  return <ConfiguredSignIn />;
}

function ConfiguredSignIn() {
  const auth = getStagingAuth();
  const { data, isPending, error: sessionError } = auth.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [exitRequested, setExitRequested] = useState(false);

  async function authenticate() {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = creating
        ? await auth.signUp.email({ email: email.trim(), password, name: "Hustle tester" })
        : await auth.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error("Sign-in failed. Check your invited test email and password.");
      setPassword("");
      setExitRequested(false);
      await auth.getSession({ query: { disableCookieCache: true } });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Test sign-in is unavailable. Try again.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    setExitRequested(true);
    setSigningOut(true);
    try {
      const result = await auth.signOut();
      if (result.error) throw new Error("Sign-out could not be confirmed. Please retry.");
      setPassword("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Please retry sign-out.");
    } finally { setSigningOut(false); }
  }

  if (data && !sessionError && !isPending && !signingOut && !exitRequested) {
    return <MobileExperience key={data.user.id} session={{ access_token: data.session.token, user: { id: data.user.id, email: data.user.email } }} onSignOut={signOut} />;
  }
  return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Text style={styles.brand}>HUSTLE</Text><Text style={styles.label}>PRIVATE TEST</Text>
    <Text style={styles.title}>{creating ? "Create your test account." : "Enter your Hustle."}</Text>
    <Text style={styles.body}>Use your invited test email. This preview has separate accounts.</Text>
    <TextInput accessibilityLabel="Test email" style={styles.input} placeholder="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <TextInput accessibilityLabel="Test password" style={styles.input} placeholder="Password (at least 12 characters)" secureTextEntry value={password} onChangeText={setPassword} />
    {message && <Text accessibilityRole="alert">{message}</Text>}
    {sessionError && <Text>Could not confirm your session. Sign in again or retry when connected.</Text>}
    {exitRequested && data && <TouchableOpacity accessibilityRole="button" disabled={signingOut} onPress={signOut}><Text style={styles.switch}>Retry sign-out</Text></TouchableOpacity>}
    <TouchableOpacity accessibilityRole="button" style={styles.action} disabled={busy || isPending || signingOut} onPress={authenticate}><Text style={styles.actionText}>{busy || isPending || signingOut ? "Working…" : creating ? "Create test account" : "Sign in"}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setCreating(!creating); setMessage(null); }}><Text style={styles.switch}>{creating ? "Already registered? Sign in" : "Create invited test account"}</Text></TouchableOpacity>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#efede6" }, content: { flex: 1, justifyContent: "center", padding: 24 }, brand: { fontSize: 18, fontWeight: "900", marginBottom: 24 }, label: { color: "#646159", fontSize: 12, letterSpacing: 2 }, title: { fontSize: 42, fontWeight: "800", marginVertical: 18, color: "#111" }, body: { fontSize: 16, lineHeight: 24, marginBottom: 20, color: "#4d4a43" }, input: { borderWidth: 1, borderColor: "#b9b5ab", borderRadius: 16, padding: 16, marginBottom: 12, color: "#111", backgroundColor: "#faf8f2" }, action: { backgroundColor: "#ff5a1f", borderRadius: 28, padding: 18, marginTop: 12 }, actionText: { textAlign: "center", color: "white", fontWeight: "800" }, switch: { textAlign: "center", padding: 18, color: "#4d4a43" } });
