// Hustle isolated test account bridge. This Worker never proxies arbitrary APIs.
const API="https://hustle-isolated-staging-api.vercel.app";
const paths=new Map([
 ["POST /api/preview/auth/sign-in","/api/auth/sign-in/email"],
 ["POST /api/preview/auth/sign-up","/api/auth/sign-up/email"],
 ["POST /api/preview/auth/sign-out","/api/auth/sign-out"],
 ["POST /api/preview/account/sync","/api/v1/auth/sync"],
 ["GET /api/preview/account","/api/v1/auth/me"],
 ["PATCH /api/preview/account","/api/v1/auth/profile"]
]);
const baseHeaders={"content-type":"application/json; charset=utf-8","cache-control":"private, no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const send=(object,status=200)=>new Response(JSON.stringify(object),{status,headers:baseHeaders});
function cookies(req){
 return (req.headers.get("cookie")||"").split(";").map(s=>s.trim())
  .filter(s=>/^(?:__Secure-|__Host-)?hustle-staging\.[A-Za-z0-9_.-]+=/.test(s)).join("; ");
}
function copySetCookies(from,to){
 for(const raw of from.getSetCookie?.()||[]){
  if(!/^(?:__Secure-|__Host-)?hustle-staging\.[A-Za-z0-9_.-]+=/.test(raw)||/[\r\n]/.test(raw))continue;
  const safe=raw.replace(/;\s*Domain=[^;]*/ig,"").replace(/;\s*Path=[^;]*/ig,"");
  to.append("set-cookie",safe+"; Path=/; HttpOnly; Secure; SameSite=Lax");
 }
}
async function upstream(path,{method="GET",cookie="",body,token}={}){
 const headers=new Headers({accept:"application/json",origin:API});
 if(cookie)headers.set("cookie",cookie);
 if(token)headers.set("authorization","Bearer "+token);
 if(body!==undefined)headers.set("content-type","application/json");
 let response;
 try{response=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),
   redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(10000)});}
 catch{return {status:503,error:"Isolated test server unavailable"};}
 if(response.status>=300&&response.status<400)return {status:502,error:"Unexpected staging redirect"};
 if(!(response.headers.get("content-type")||"").includes("application/json"))return {status:502,error:"Invalid staging response"};
 const raw=await response.text();
 if(raw.length>65536)return {status:502,error:"Staging response too large"};
 try{return {status:response.status,data:JSON.parse(raw),headers:response.headers};}
 catch{return {status:502,error:"Invalid JSON from staging"};}
}
async function session(req){
 const cookie=cookies(req);if(!cookie)return null;
 const v=await upstream("/api/auth/get-session",{cookie});
 if(v.status!==200||!v.data?.session?.token||!v.data?.user?.id)return null;
 if(new Date(v.data.session.expiresAt).getTime()<=Date.now())return null;
 return {token:v.data.session.token,user:v.data.user};
}
async function bodyOf(req){
 if(!req.headers.get("content-type")?.startsWith("application/json")||
   Number(req.headers.get("content-length")||0)>6000)return null;
 try{const raw=await req.text();if(raw.length>6000)return null;const v=JSON.parse(raw);return v&&typeof v==="object"&&!Array.isArray(v)?v:null;}catch{return null;}
}
function text(v,min,max){return typeof v==="string"&&v.trim().length>=min&&v.trim().length<=max;}
export default {async fetch(req,env){
 const url=new URL(req.url),route=req.method+" "+url.pathname;
 if(!url.pathname.startsWith("/api/preview/"))return env.ASSETS.fetch(req);
 if(env.HUSTLE_PREVIEW_AUTH_GATE!=="isolated-staging")return send({message:"Preview backend disabled"},404);
 if(route!=="GET /api/preview/auth/session"&&!paths.has(route))return send({message:"Route not available"},404);
 if(req.method!=="GET"&&req.headers.get("origin")!==url.origin)return send({message:"Cross-origin writes blocked"},403);
 if(route==="GET /api/preview/auth/session"){
  const current=await session(req);
  return send(current?{authenticated:true,user:{id:current.user.id,email:current.user.email??null}}:{authenticated:false,user:null});
 }
 if(route.startsWith("POST /api/preview/auth/")){
  const data=await bodyOf(req);if(!data)return send({message:"Invalid request"},400);
  const login=route.endsWith("sign-in")||route.endsWith("sign-up");
  if(login&&(!text(data.email,5,256)||!/^\S+@\S+\.\S+$/.test(data.email)||!text(data.password,12,128)))
   return send({message:"Invited email and 12+ character test password required"},400);
  const input=login?{email:data.email.trim().toLowerCase(),password:data.password,
    ...(route.endsWith("sign-up")?{name:"Hustle preview tester"}:{})}:{};
  const result=await upstream(paths.get(route),{method:"POST",cookie:cookies(req),body:input});
  if(result.error)return send({message:result.error},result.status);
  if(result.status<200||result.status>=300)
   return send({message:"Unable to confirm test identity. Check invitation and credentials."},result.status===403?403:401);
  const headers=new Headers(baseHeaders);copySetCookies(result.headers,headers);
  return new Response(JSON.stringify({ok:true}),{status:200,headers});
 }
 const identity=await session(req);
 if(!identity)return send({message:"Sign in to your test account"},401);
 let body;
 if(route==="PATCH /api/preview/account"){
  const input=await bodyOf(req);
  if(!input||!text(input.displayName,1,80)||!text(input.username,3,30)||
    !/^[a-z0-9._]{3,30}$/.test(input.username.toLowerCase())||
    (input.bio!==undefined&&typeof input.bio!=="string")||
    (input.location!==undefined&&typeof input.location!=="string")||
    (input.bio?.length||0)>300||(input.location?.length||0)>120)
   return send({message:"Name and a valid username are required"},400);
  body={displayName:input.displayName.trim(),username:input.username.trim().toLowerCase(),
    location:(input.location||"").trim(),bio:(input.bio||"").trim()};
 }
 const result=await upstream(paths.get(route),{method:req.method,cookie:cookies(req),token:identity.token,body});
 if(result.error)return send({message:result.error},result.status);
 if(result.status>=400){
  const msg=result.status===400?String(result.data?.message||"Check your profile information"):"Account request unsuccessful";
  return send({message:msg.slice(0,180)},result.status);
 }
 return send(result.data);
}};
