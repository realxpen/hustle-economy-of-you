import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isMobileAuthConfigured } from "./src/lib/supabase";
import { syncMobileAccount } from "./src/lib/account";

export default function App() {
  const configured = isMobileAuthConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"signin"|"signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, [configured]);

  async function authenticate() {
    setLoading(true); setMessage(null);
    try {
      if (!configured) throw new Error("Connect the dedicated Hustle Supabase project first.");
      const supabase = getSupabase();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) await syncMobileAccount(result.data.session.access_token);
      else setMessage("Check your email to verify your address.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Authentication failed"); }
    finally { setLoading(false); }
  }

  async function signOut() { await getSupabase().auth.signOut(); }

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <View style={styles.brandRow}><Text style={styles.brand}>HUSTLE</Text><View style={styles.brandDot}><Text style={styles.arrow}>↗</Text></View></View>
    {session ? <View style={styles.content}><Text style={styles.eyebrow}>ONE IDENTITY / ACTIVE</Text><Text style={styles.title}>Your economy starts here.</Text><Text style={styles.body}>You are signed in. Your Client capability belongs to this identity automatically; future capabilities will accumulate here.</Text><View style={styles.capability}><Text style={styles.capLabel}>CAPABILITY</Text><Text style={styles.capValue}>CLIENT</Text><Text style={styles.capState}>ACTIVE</Text></View><TouchableOpacity style={styles.action} onPress={signOut}><Text style={styles.actionText}>Sign out</Text><Text style={styles.actionArrow}>↗</Text></TouchableOpacity></View> : <View style={styles.content}><Text style={styles.eyebrow}>PHASE 2 / UNIFIED IDENTITY</Text><Text style={styles.title}>{mode === "signin" ? "Enter your Hustle." : "Build your identity."}</Text><View style={styles.toggle}><TouchableOpacity style={[styles.toggleButton,mode==="signin"&&styles.toggleActive]} onPress={()=>setMode("signin")}><Text style={mode==="signin"?styles.toggleActiveText:styles.toggleText}>Sign in</Text></TouchableOpacity><TouchableOpacity style={[styles.toggleButton,mode==="signup"&&styles.toggleActive]} onPress={()=>setMode("signup")}><Text style={mode==="signup"?styles.toggleActiveText:styles.toggleText}>Create</Text></TouchableOpacity></View><TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#807d74" value={email} onChangeText={setEmail}/><TextInput style={styles.input} secureTextEntry placeholder="Password" placeholderTextColor="#807d74" value={password} onChangeText={setPassword}/>{message&&<Text style={styles.message}>{message}</Text>}{!configured&&<Text style={styles.preview}>Preview mode · Supabase not connected</Text>}<TouchableOpacity style={styles.action} disabled={loading} onPress={authenticate}><Text style={styles.actionText}>{loading?"Working…":mode==="signin"?"Enter Hustle":"Create account"}</Text><Text style={styles.actionArrow}>↗</Text></TouchableOpacity><Text style={styles.rule}>One account · One reputation · No role switching</Text></View>}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:"#efede6"},container:{flex:1,padding:24},brandRow:{flexDirection:"row",alignItems:"center",gap:7},brand:{fontWeight:"900",fontSize:16,color:"#111"},brandDot:{width:25,height:25,borderRadius:13,backgroundColor:"#ff5a1f",alignItems:"center",justifyContent:"center"},arrow:{color:"white",fontWeight:"900"},content:{flex:1,justifyContent:"center"},eyebrow:{fontSize:11,letterSpacing:2,fontWeight:"800",color:"#646159",marginBottom:18},title:{fontSize:58,lineHeight:52,fontWeight:"800",letterSpacing:-3.5,color:"#111",marginBottom:24},body:{fontSize:18,lineHeight:27,color:"#4d4a43",marginBottom:26},toggle:{alignSelf:"flex-start",flexDirection:"row",backgroundColor:"#dcd9d0",borderRadius:24,padding:4,marginBottom:18},toggleButton:{paddingVertical:9,paddingHorizontal:16,borderRadius:20},toggleActive:{backgroundColor:"#111"},toggleText:{fontWeight:"700",color:"#4e4b44"},toggleActiveText:{fontWeight:"700",color:"white"},input:{borderWidth:1,borderColor:"#b9b5ab",backgroundColor:"#faf8f2",borderRadius:16,padding:16,fontSize:16,color:"#111",marginBottom:12},action:{minHeight:56,borderRadius:28,backgroundColor:"#ff5a1f",paddingLeft:22,paddingRight:8,flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:16},actionText:{color:"white",fontWeight:"800",fontSize:16},actionArrow:{width:40,height:40,borderRadius:20,backgroundColor:"#111",color:"white",textAlign:"center",lineHeight:40,fontWeight:"900"},message:{backgroundColor:"#dedbd2",padding:12,borderRadius:12,color:"#3f3d38"},preview:{backgroundColor:"#fff0bd",padding:10,borderRadius:10,color:"#5a4a12",fontSize:12},rule:{marginTop:18,textAlign:"center",fontSize:11,color:"#77736a"},capability:{backgroundColor:"#111",borderRadius:26,padding:24,marginVertical:20},capLabel:{fontSize:10,letterSpacing:2,color:"#aaa79e"},capValue:{fontSize:48,fontWeight:"800",color:"white",marginTop:18},capState:{color:"#a7df8b",fontWeight:"700"},capState2:{color:"#a7df8b"}});
