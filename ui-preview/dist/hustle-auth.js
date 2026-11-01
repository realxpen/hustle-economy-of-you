(function hustleConnectedIdentity(){
"use strict";
// All credentials travel only over first-party HTTPS to the isolated Worker.
// The Worker owns the HttpOnly cookie and exchanges its staging token server-side.
let account=null;
async function request(path,{method="GET",body}={}){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch("/api/preview/"+path,{
   method,credentials:"same-origin",cache:"no-store",signal:controller.signal,
   headers:{accept:"application/json",...(method==="GET"?{}:{"content-type":"application/json"})},
   ...(method==="GET"?{}:{body:JSON.stringify(body??{})})
  });
  const result=await res.json().catch(()=>null);
  if(!res.ok)throw new Error(res.status===401?"Sign in to your test account":
   result?.message||"The test server is unavailable.");
  return result;
 }catch(error){
  if(error?.name==="AbortError")throw new Error("Connection timed out. Check your internet and retry.");
  throw error;
 }finally{clearTimeout(timeout)}
}
function announce(){window.dispatchEvent(new CustomEvent("hustle:auth-changed",{detail:{account}}));}
async function current(){
 const status=await request("auth/session");
 if(!status.authenticated){account=null;announce();return null}
 try{account=await request("account");announce();return account;}
 catch(e){if(/Sign in/.test(e.message)){account=null;announce();return null}throw e;}
}
async function enter(email,password,create){
 const answer=await request("auth/"+(create?"sign-up":"sign-in"),{method:"POST",body:{email,password}});
 if(answer?.requiresEmailVerification)return {requiresEmailVerification:true};
 try{
  await request("account/sync",{method:"POST"});
  return await current();
 }catch(e){account=null;announce();throw e}
}
async function update(input){
 const updated=await request("account",{method:"PATCH",body:input});
 // Older hosted APIs can silently ignore newly introduced profile fields.
 // Do not claim onboarding preferences persisted until the server echoes them.
 if(Object.prototype.hasOwnProperty.call(input,"interests")){
  if(!Array.isArray(updated.interests)||
     JSON.stringify(updated.interests)!==JSON.stringify(input.interests))
    throw new Error("Skills and interests are not active on this test server yet. Nothing was confirmed saved.");
 }
 if(Object.prototype.hasOwnProperty.call(input,"primarySkill")){
  if((updated.primarySkill||"")!==(input.primarySkill||""))
    throw new Error("Your primary skill was not confirmed by the test server. Try again after staging is updated.");
 }
 account=updated;announce();return account;
}
async function usernameAvailability(username){
 const normalized=String(username||"").trim().toLowerCase();
 if(!window.HustleAccountSetup?.valid(normalized))return {username:normalized,available:false,reason:"invalid"};
 const response=await request("account/username?username="+encodeURIComponent(normalized));
 if(response?.username!==normalized||typeof response.available!=="boolean")
  throw new Error("Username availability could not be verified.");
 return response;
}
async function uploadAvatar(file){
 if(!account)throw new Error("Sign in before uploading your photo.");
 const blob=await window.HustleAccountSetup.compress(file);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const response=await fetch("/api/preview/account/avatar",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"content-type":"image/webp",accept:"application/json"},
   body:blob,signal:controller.signal
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.message||"Profile photos are not configured in this isolated preview.");
  if(typeof data?.avatarUrl!=="string"||!data.avatarUrl.startsWith(location.origin+"/api/preview/avatar/"))
   throw new Error("Photo could not be confirmed on your account.");
  account=data;announce();return account;
 }catch(error){
  if(error?.name==="AbortError")throw new Error("Photo upload timed out. Try again.");
  throw error;
 }finally{clearTimeout(timeout)}
}
async function exit(){
 await request("auth/sign-out",{method:"POST"});
 account=null;announce();
}
window.HustleAuth={
 current,enter,update,exit,usernameAvailability,uploadAvatar,
 getAccount:()=>account,
 isSignedIn:()=>Boolean(account),
};
})();