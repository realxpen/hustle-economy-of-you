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
 await request("auth/"+(create?"sign-up":"sign-in"),{method:"POST",body:{email,password}});
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
async function exit(){
 await request("auth/sign-out",{method:"POST"});
 account=null;announce();
}
window.HustleAuth={
 current,enter,update,exit,
 getAccount:()=>account,
 isSignedIn:()=>Boolean(account),
};
})();