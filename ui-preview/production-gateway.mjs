/**
 * Hustle V1 production connection — same-origin Cloudflare BFF to AWS NestJS.
 * Production sessions are Supabase Auth, never isolated Better Auth sessions.
 * This source is INACTIVE until separately configured and released.
 */
const PREFIX="/api/preview/";
const COOKIE_AT="__Host-hustle_prod_at";
const COOKIE_RT="__Host-hustle_prod_rt";
const jsonHeaders={"content-type":"application/json; charset=utf-8","cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const respond=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...jsonHeaders,...extra}});
const safe=(value)=>typeof value==="string"&&/^[A-Za-z0-9_.-]{12,4090}$/.test(value);
function credentials(env,origin){
 const config={
  ui:"https://hustle-economy-of-you.realxpens.workers.dev",
  supabase:"https://pfgarmyygybmhiiuopym.supabase.co",
  aws:env.HUSTLE_PRODUCTION_API_ORIGIN,
  key:env.HUSTLE_SUPABASE_PUBLISHABLE_KEY
 };
 if(origin!==config.ui)throw Error("Wrong production frontend");
 if(typeof config.aws!=="string"||
    !/^https:\/\/[a-z0-9]{10,64}\.lambda-url\.eu-west-2\.on\.aws$/.test(config.aws))
  throw Error("Verified AWS production API origin not configured");
 if(typeof config.key!=="string"||!(config.key.startsWith("sb_publishable_")||config.key.split(".").length===3))
  throw Error("Production publishable auth key not configured");
 return config;
}
function cookie(req,name){
 const raw=(req.headers.get("cookie")||"").split(";")
  .map(x=>x.trim()).find(x=>x.startsWith(name+"="));
 const value=raw?.slice(name.length+1)||"";
 return safe(value)?value:null;
}
function setCookie(headers,name,value,ttl){
 if(!safe(value))throw Error("Invalid session token shape");
 headers.append("set-cookie",name+"="+value+"; Path=/; Max-Age="+ttl+"; HttpOnly; Secure; SameSite=Lax");
}
function clearCookies(headers){
 for(const name of [COOKIE_AT,COOKIE_RT])
  headers.append("set-cookie",name+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
}
async function upstream(url,{method="GET",headers={},body,timeout=10000}={}){
 let res;try{
  res=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
   redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(timeout)});
 }catch{return {status:503,error:"Connection to a production service failed"};}
 if(res.status>=300&&res.status<400)return {status:502,error:"Unexpected provider redirect"};
 if(!(res.headers.get("content-type")||"").includes("application/json"))
  return {status:502,error:"Invalid backend response"};
 const text=await res.text();
 if(text.length>65536)return {status:502,error:"Backend response too large"};
 try{return {status:res.status,data:JSON.parse(text)};}
 catch{return {status:502,error:"Invalid backend JSON"};}
}
function authHeaders(c,access){
 return {"apikey":c.key,"authorization":access?"Bearer "+access:"Bearer "+c.key,
   "accept":"application/json","content-type":"application/json"};
}
function sessionHeaders(result){
 const headers=new Headers(jsonHeaders);
 if(safe(result?.access_token)&&safe(result?.refresh_token)){
  const expires=Number(result.expires_in);
  setCookie(headers,COOKIE_AT,result.access_token,Number.isFinite(expires)?Math.min(Math.max(1,Math.floor(expires)),3600):3600);
  setCookie(headers,COOKIE_RT,result.refresh_token,60*60*24*30);
 }
 return headers;
}
async function session(req,c){
 let access=cookie(req,COOKIE_AT);
 const refresh=cookie(req,COOKIE_RT);
 const userUrl=c.supabase+"/auth/v1/user";
 if(access){
  const user=await upstream(userUrl,{headers:authHeaders(c,access)});
  if(user.status===200&&user.data?.id)return {access,user:user.data};
  if(user.status!==401&&user.status!==403)return {error:user.error||"Authentication provider temporarily unavailable",status:503};
 }
 if(!refresh)return null;
 const next=await upstream(c.supabase+"/auth/v1/token?grant_type=refresh_token",
   {method:"POST",headers:authHeaders(c),body:{refresh_token:refresh}});
 if(next.status!==200||!safe(next.data?.access_token)||!safe(next.data?.refresh_token))return null;
 access=next.data.access_token;
 const user=await upstream(userUrl,{headers:authHeaders(c,access)});
 if(user.status!==200||!user.data?.id)return null;
 return {access,user:user.data,cookies:sessionHeaders(next.data)};
}
async function bodyOf(req,max=6000){
 if(!(req.headers.get("content-type")||"").startsWith("application/json")||
    Number(req.headers.get("content-length")||0)>max)return null;
 try{const raw=await req.text();if(raw.length>max)return null;
  const body=JSON.parse(raw);return body&&typeof body==="object"&&!Array.isArray(body)?body:null;
 }catch{return null}
}
function allowedProfile(body){
 const text=x=>typeof x==="string";
 if(!body||!text(body.displayName)||body.displayName.trim().length<1||
    body.displayName.length>80||!text(body.username)||!(/^[a-z0-9._]{3,30}$/.test(body.username.toLowerCase()))||
    body.username.startsWith(".")||body.username.endsWith(".")||body.username.includes("..")||
    (body.location!==undefined&&(!text(body.location)||body.location.length>120))||
    (body.bio!==undefined&&(!text(body.bio)||body.bio.length>300))||
    (body.primarySkill!==undefined&&(!text(body.primarySkill)||body.primarySkill.length>80))||
    (body.interests!==undefined&&(!Array.isArray(body.interests)||body.interests.length>10||
      body.interests.some(x=>!text(x)||x.trim().length<2||x.length>50)||
      new Set(body.interests.map(x=>x.trim().toLowerCase())).size!==body.interests.length)))return null;
 return {displayName:body.displayName.trim(),username:body.username.trim().toLowerCase(),
  ...(body.location!==undefined?{location:body.location.trim()}:{}),
  ...(body.bio!==undefined?{bio:body.bio.trim()}:{}),
  ...(body.primarySkill!==undefined?{primarySkill:body.primarySkill.trim()}:{}),
  ...(body.interests!==undefined?{interests:body.interests.map(x=>x.trim())}:{})};
}
export async function handleProductionApi(req,env){
 const url=new URL(req.url),route=req.method+" "+url.pathname;
 let c;
 try{c=credentials(env,url.origin);}catch{return respond({message:"Production connection not enabled"},503);}
 const routes=new Map([
  ["POST "+PREFIX+"account/sync",["POST","/api/v1/auth/sync"]],
  ["GET "+PREFIX+"account",["GET","/api/v1/auth/me"]],
  ["PATCH "+PREFIX+"account",["PATCH","/api/v1/auth/profile"]],
  ["GET "+PREFIX+"account/username",["GET","/api/v1/auth/username-availability"]]
 ]);
 const isSignIn=route==="POST "+PREFIX+"auth/sign-in";
 const isSignUp=route==="POST "+PREFIX+"auth/sign-up";
 const isSignOut=route==="POST "+PREFIX+"auth/sign-out";
 const isSession=route==="GET "+PREFIX+"auth/session";
 if(!isSession&&!isSignIn&&!isSignUp&&!isSignOut&&!routes.has(route))
  return respond({message:"Unavailable API route"},404);
 if(req.method!=="GET"&&req.headers.get("origin")!==url.origin)
  return respond({message:"Cross-origin request blocked"},403);
 if(isSignIn||isSignUp){
  const body=await bodyOf(req);
  if(!body||typeof body.email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||
     body.email.length>256||typeof body.password!=="string"||body.password.length<12||body.password.length>128)
   return respond({message:"Use a valid email and password (12+ characters)"},400);
  const path=isSignIn?"/auth/v1/token?grant_type=password":"/auth/v1/signup";
  const data=await upstream(c.supabase+path,{method:"POST",headers:authHeaders(c),
    body:{email:body.email.trim().toLowerCase(),password:body.password}});
  if(data.status===503)return respond({message:"Authentication service unavailable"},503);
  if(data.status>=400)return respond({message:"Unable to complete authentication. Check your details or email verification."},data.status===429?429:401);
  if(!safe(data.data?.access_token)||!safe(data.data?.refresh_token)){
   if(isSignUp&&data.data?.user?.id)
    return respond({ok:true,requiresEmailVerification:true});
   return respond({message:"No authenticated session returned"},401);
  }
  return new Response(JSON.stringify({ok:true}),{status:200,headers:sessionHeaders(data.data)});
 }
 if(isSignOut){
  const access=cookie(req,COOKIE_AT);
  if(access)await upstream(c.supabase+"/auth/v1/logout",{method:"POST",headers:authHeaders(c,access)});
  const headers=new Headers(jsonHeaders);clearCookies(headers);
  return new Response(JSON.stringify({ok:true}),{status:200,headers});
 }
 const auth=await session(req,c);
 if(isSession){
  if(auth?.error)return respond({message:auth.error},auth.status||503);
  const headers=new Headers(jsonHeaders);
  if(auth?.cookies)for(const v of auth.cookies.getSetCookie())headers.append("set-cookie",v);
  if(!auth){clearCookies(headers);}
  return new Response(JSON.stringify(auth?{authenticated:true,user:{id:auth.user.id,email:auth.user.email??null}}:
    {authenticated:false,user:null}),{headers});
 }
 if(!auth||auth.error)return respond({message:"Sign in to your Hustle account"},401);
 const endpoint=routes.get(route);
 let body;
 if(route==="PATCH "+PREFIX+"account"){
  body=allowedProfile(await bodyOf(req));
  if(!body)return respond({message:"Check your name, username and preferences"},400);
 }
 let suffix=endpoint[1];
 if(route==="GET "+PREFIX+"account/username"){
  const name=url.searchParams.get("username")||"";
  if(name.length<3||name.length>30||!/^[a-z0-9._]+$/.test(name))return respond({message:"Invalid username"},400);
  suffix+="?username="+encodeURIComponent(name);
 }
 const data=await upstream(c.aws+suffix,{method:endpoint[0],
   headers:{accept:"application/json",authorization:"Bearer "+auth.access,
     ...(body!==undefined?{"content-type":"application/json"}:{})},body});
 if(data.error)return respond({message:data.error},data.status);
 if(data.status>=400)return respond({message:data.status===409?"Username unavailable":
  data.status===400?"Invalid profile data":"Hustle API request failed"},data.status);
 const headers=new Headers(jsonHeaders);
 if(auth.cookies)for(const value of auth.cookies.getSetCookie())headers.append("set-cookie",value);
 return new Response(JSON.stringify(data.data),{status:data.status,headers});
}
