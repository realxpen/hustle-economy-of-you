#!/usr/bin/env node
"use strict";
/**
 * UX013: synthetic, guest-only end-to-end Feed -> linked offer -> consultation
 * intent and Explore results on a locally built Hustle Web/PWA.
 *
 * Does NOT sign in, contact real API providers, write bookings or checkouts,
 * test physical devices, or assert Figma pixel parity.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require("playwright");
const root = process.env.HUSTLE_LOCAL_WEB_URL || "http://127.0.0.1:3001";
assert.match(root, /^http:\/\/127\.0\.0\.1:\d+$/, "QA may run only against 127.0.0.1");
const out = process.env.HUSTLE_UX013_ARTIFACT_DIR ||
  path.join(os.tmpdir(), "hustle-ux013-journey-qa");
assert.ok(path.isAbsolute(out), "Artifact path must be absolute");
const origin = new URL(root).origin;
const professionalProfile = { id:"qa-profile", headline:"Barber", primarySkill:"Barber",
  secondarySkills:[], category:"Beauty", professionalSummary:"Synthetic professional",
  yearsExperience:2 };
const owner = {id:"qa-hustler", displayName:"QA Hustler", username:"qa-hustler",
  avatarUrl:null, bio:null, location:"Lagos, Nigeria", verified:false, professionalProfile};
const service={id:"qa-service",title:"QA Barber Session",category:"Beauty",description:
  "Synthetic appointment service. No real provider or transaction.",
  mediaUrls:[],priceMinor:45000,pricingType:"FIXED",currency:"NGN",
  deliveryMode:"IN_PERSON",deliveryTime:"One hour",availabilityNote:"By appointment",
  location:"Lagos, Nigeria"};
const product={id:"qa-product",title:"QA Hair Care Kit",description:
  "Synthetic product. Never a live listing.",
  priceMinor:250000,currency:"NGN",mediaUrls:[],inStock:true,
  type:"PHYSICAL",category:"Beauty",deliveryInformation:"Local delivery"};
const fixturePost = {
  post:{id:"qa-post-001",caption:"A synthetic barber project for safe UI testing",
    category:"Beauty",location:"Lagos",tags:["barber"],
    publishedAt:"2026-10-27T09:00:00Z",media:[]},
  creator:owner,engagement:{likes:3,saves:1,comments:0},
  viewer:{liked:false,saved:false,commented:false,following:false},
  services:[service],products:[product],ranking:{score:88,reasons:["Relevant skill"]}
};
const fixtureFeed={tab:"for-you",items:[fixturePost],nextCursor:null,hasMore:false,
  viewerLocation:null,coldStart:false,guest:true,reason:null};
const searchItem={kind:"service",id:"qa-service",url:"/services/qa-service",
  service,owner,ranking:{score:98,reasons:["Beauty","Barber"]}};
const queryPage=(tab)=>({mode:"search",tab,query:"barber",filters:{},
  items:[searchItem],nextCursor:null,hasMore:false,zeroResults:false});
const sizes=[
  {width:320,height:640,label:"compact-320"},
  {width:390,height:844,label:"figma-390"},
  {width:390,height:475,label:"short-390"},
  {width:768,height:1024,label:"tablet-768"}
];
function localOnly(url) {
  return url.protocol==="data:" || url.protocol==="blob:" || url.origin===origin;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const results=[],faults=[];
 let unexpectedWrites=0,unmockedRemote=0;
 try {
   for(const size of sizes){
     const ctx=await browser.newContext({
       viewport:{width:size.width,height:size.height},reducedMotion:"reduce",
       serviceWorkers:"block",colorScheme:"light",hasTouch:true
     });
     let failProduct=true;
     await ctx.route("**/*",async route=>{
       const req=route.request();
       let u;
       try {u=new URL(req.url())} catch {return route.abort()}
       // No POST, PATCH, DELETE or other mutation reaches any backend.
       if(req.method()!=="GET" && req.method()!=="HEAD"){
         unexpectedWrites++;
         return route.abort();
       }
       const respond=(body,status=200)=>route.fulfill({
         status,contentType:"application/json",
         headers:{"access-control-allow-origin":"*"},
         body:JSON.stringify(body)
       });
       if(u.pathname==="/api/isolated/auth/get-session") return respond({session:null,user:null});
       if(/\/api\/v1\/guest\/feed\/for-you$/.test(u.pathname)) return respond(fixtureFeed);
       if(/\/api\/v1\/guest\/search(?:\/services)?$/.test(u.pathname)) {
         return respond(queryPage(u.pathname.endsWith("/services")?"services":"top"));
       }
       if(/\/api\/v1\/services\/qa-service$/.test(u.pathname)) {
         return respond({service,owner});
       }
       if(/\/api\/v1\/products\/qa-product$/.test(u.pathname)) {
         return failProduct ? respond({message:"Synthetic unavailable"},503)
           : respond({product,owner});
       }
       if(!localOnly(u)){unmockedRemote++;return route.abort()}
       return route.continue();
     });
     const page=await ctx.newPage();
     try {
       await page.goto(root+"/home",{waitUntil:"domcontentloaded",timeout:25000});
       await page.getByText(fixturePost.post.caption,{exact:true}).waitFor({timeout:18000});
       const toggle=page.getByRole("button",{name:/linked marketplace 2 offers/});
       await toggle.click();
       const serviceTrigger=page.getByRole("button",{name:"View provider’s service ↗"});
       await serviceTrigger.click();
       const dialog=page.getByRole("dialog",{name:"Service quick view"});
       await dialog.waitFor({timeout:10000});
       await dialog.getByRole("heading",{name:service.title}).waitFor();
       const close=dialog.getByRole("button",{name:"Close quick view"});
       let rect=await close.boundingBox();
       assert.ok(rect && rect.width>=44 && rect.height>=44,
         "Close quick view must have a 44px or larger target");
       const metrics=await dialog.evaluate(el=>{
         const r=el.getBoundingClientRect();
         return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,
           overflowY:getComputedStyle(el).overflowY,
           scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
       });
       assert.ok(metrics.x>=-2 && metrics.right<=size.width+2,
         "Popup must fit horizontally");
       assert.ok(metrics.top>=-2 && metrics.bottom<=size.height+2,
         "Popup must fit available viewport height");
       assert.equal(await page.evaluate(()=>document.body.style.overflow),"hidden",
         "Open popup must prevent scrolling underlying Feed");
       await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight});
       const next=dialog.getByRole("link",{name:/Request a booking/});
       assert.match(await next.getAttribute("href"),
         /^\/bookings\/new\/qa-service\?sourcePost=qa-post-001$/);
       assert.ok(await next.isVisible(),"Booking CTA should remain visible");
       const last=dialog.getByRole("link",{name:/Return to post/});
       await last.focus();
       await page.keyboard.press("Tab");
       assert.equal(await close.evaluate(el=>document.activeElement===el),true,
         "Focus should wrap from last control to close");
       await page.keyboard.press("Shift+Tab");
       assert.equal(await last.evaluate(el=>document.activeElement===el),true,
         "Focus should wrap backward to last control");
       await page.screenshot({path:path.join(out,size.label+"__service-sheet.png"),
         animations:"disabled",caret:"hide"});
       await page.keyboard.press("Escape");
       await dialog.waitFor({state:"detached",timeout:5000});
       await page.waitForFunction(()=>document.body.style.overflow!=="hidden");
       assert.equal(await serviceTrigger.evaluate(el=>document.activeElement===el),true,
         "Closing must return focus to originating post");
       results.push({size:size.label,step:"Feed → real-data-shaped service sheet → booking intent",
         result:"PASS",metrics,bookingHref:await next.getAttribute("href").catch(()=>"/bookings/new/qa-service?sourcePost=qa-post-001")});
       // Exercise the PRODUCT error state and its real Try again control.
       const productTrigger=page.getByRole("button",{name:"View seller’s product ↗"});
       await productTrigger.click();
       const productDialog=page.getByRole("dialog",{name:"Product quick view"});
       await productDialog.getByText("Offer unavailable").waitFor({timeout:10000});
       failProduct=false;
       await productDialog.getByRole("button",{name:"Try again"}).click();
       await productDialog.getByRole("heading",{name:product.title}).waitFor({timeout:10000});
       assert.match(await productDialog.getByRole("link",{name:/Choose options/}).getAttribute("href"),
         /^\/products\/qa-product\?sourcePost=qa-post-001#add-to-cart$/);
       await page.screenshot({path:path.join(out,size.label+"__product-sheet.png"),
         animations:"disabled",caret:"hide"});
       await productDialog.getByRole("button",{name:"Close quick view"}).click();
       await productDialog.waitFor({state:"detached"});
       results.push({size:size.label,step:"Feed → product unavailable → Retry → cart intent",
         result:"PASS"});
       // Explore discovery is a separate real page, with a fake GET-only result.
       await page.goto(root+"/search?q=barber",{waitUntil:"domcontentloaded"});
       await page.getByRole("heading",{name:service.title}).waitFor({timeout:15000});
       await page.getByRole("button",{name:"Services",exact:true}).click();
       await page.getByRole("heading",{name:service.title}).waitFor({timeout:10000});
       const serviceResult=page.getByRole("link",{name:/QA Barber Session/});
       assert.equal(await serviceResult.getAttribute("href"),"/services/qa-service");
       await page.screenshot({path:path.join(out,size.label+"__explore-services.png"),
         animations:"disabled",caret:"hide"});
       const over=await page.evaluate(()=>
         Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
       assert.ok(over<=3,"Explore should not scroll horizontally");
       results.push({size:size.label,step:"Explore → Services results → canonical service",
         result:"PASS",overflowPx:over});
     }catch(error){
       faults.push({size:size.label,message:String(error?.message||error).slice(0,1300)});
     }finally{await page.close();await ctx.close()}
   }
 }finally{await browser.close()}
 const report={
  scope:"UX013 localhost guest fixtures; no real users, money or backend changes",
  target:"Feed attachment popup, product retry, Explore to service",
  actualSignedInTest:"PENDING",nativeDeviceTest:"PENDING",figmaPixelParity:"PENDING",
  sizes:sizes.map(x=>x.label),checks:results,failures:faults,
  unmockedRemoteRequests:unmockedRemote,blockedWrites:unexpectedWrites
 };
 fs.writeFileSync(path.join(out,"ux013-journey-results.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({result:faults.length||unexpectedWrites||unmockedRemote?"FAIL":"PASS",
   checks:results.length,failures:faults,blockedWrites:unexpectedWrites,
   unmockedRemoteRequests:unmockedRemote},null,2));
 if(faults.length||unexpectedWrites||unmockedRemote)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
