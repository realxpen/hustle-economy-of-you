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
const xpenResultKinds=[
  {kind:"person",id:"qa-hustler",url:"/u/qa-hustler",person:owner,
    ranking:{score:95,reasons:["username"]}},
  {kind:"post",id:"qa-post-001",url:"/posts/qa-post-001",post:fixturePost.post,
    owner,engagement:fixturePost.engagement,ranking:{score:88,reasons:["username"]}},
  searchItem,
  {kind:"product",id:"qa-product",url:"/products/qa-product",product,owner,
    ranking:{score:85,reasons:["username"]}}
];
const queryPage=(tab,q)=>({mode:"search",tab,query:q||"barber",filters:{},
  items:q==="xp"?xpenResultKinds:[searchItem],
  nextCursor:null,hasMore:false,zeroResults:false});
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
       if(/\/api\/v1\/guest\/marketplace$/.test(u.pathname)) {
         return respond({mode:"marketplace",tab:"all",query:null,
           filters:{location:"Lagos"},items:[searchItem],nextCursor:null,
           hasMore:false,zeroResults:false});
       }
       if(/\/api\/v1\/guest\/search(?:\/services)?$/.test(u.pathname)) {
         return respond(queryPage(u.pathname.endsWith("/services")?"services":"top",u.searchParams.get("q")));
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
     // Fast failure; avoid hiding a broken CTA behind repeated 30s waits.
     page.setDefaultTimeout(9000);
     try {
       await page.goto(root+"/home",{waitUntil:"domcontentloaded",timeout:25000});
       await page.getByText(fixturePost.post.caption,{exact:true}).waitFor({timeout:18000});
       // Figma 02 Home should show one brand/search row and a second
       // LIVE / For You / Nearby row. The canonical dock has five targets.
       if(size.width<=760){
         const nav=page.getByRole("navigation",{name:"Hustle mobile application"});
         await nav.waitFor({state:"visible"});
         assert.equal(await nav.getByRole("link").count(),5,
           "Mobile should render exactly five Figma navigation targets");
         assert.equal(await page.getByRole("navigation",{name:"Hustle main navigation",includeHidden:true}).isVisible(),false);
         await page.getByRole("link",{name:"Search Hustlers, skills and work"}).waitFor({state:"visible"});
         const top=page.getByRole("navigation",{name:"Discovery feed tabs"});
         assert.equal(await top.getByRole("button",{name:"For You"}).isVisible(),true);
         assert.equal(await top.getByRole("button",{name:"Nearby"}).isVisible(),true);
         assert.equal(await top.getByRole("link",{name:"LIVE"}).isVisible(),true);
         assert.equal(await page.locator('main h1').count(),0,"Mobile Feed must not show marketing header");
       }
       if(size.width<=760){
         // Screenshot-based bug report: a legacy compact-actions card retained
         // glass padding, border and blur, hiding the work underneath.
         const rail=page.locator('[aria-label="Post actions"]').first();
         const railStyle=await rail.evaluate(el=>{
           const style=getComputedStyle(el);
           return {background:style.backgroundColor,border:style.borderTopWidth,
             radius:style.borderTopLeftRadius,
             blur:style.getPropertyValue("backdrop-filter").trim(),
             // Chromium may not expose style.webkitBackdropFilter at all;
             // querying the CSS property returns an empty string when unsupported.
             webkitBlur:style.getPropertyValue("-webkit-backdrop-filter").trim()};
         });
         assert.ok(["transparent","rgba(0, 0, 0, 0)"].includes(railStyle.background),
           "Post action controls must have a transparent canvas");
         assert.equal(railStyle.border,"0px","Action rail cannot be a glass-bordered pill");
         assert.equal(railStyle.radius,"0px","Action rail cannot have a pill radius");
         assert.ok(["none",""].includes(railStyle.blur),"Action rail must not blur work");
         assert.ok(["none",""].includes(railStyle.webkitBlur),
           `Safari rail must not blur work (computed: ${railStyle.webkitBlur})`);
         const summary=page.locator('summary[aria-label="More feed views"]');
         await summary.click();
         const details=page.locator('details').filter({has:summary});
         assert.equal(await details.getAttribute("open"),"",
           "Additional feed choices must open only when requested");
         await page.getByRole("navigation",{name:"Discovery feed tabs"})
           .getByRole("button",{name:"For You"}).click();
         assert.equal(await details.getAttribute("open"),null,
           "Additional feed choices must close after choosing a feed tab");
       }
       await page.screenshot({path:path.join(out,size.label+"__feed-figma-v1.png"),
         animations:"disabled",caret:"hide"});
       const toggle=page.getByRole("button",{name:/2 linked marketplace offers/});
       if(size.width<=760 && size.height>500){
         const offerRect=await toggle.boundingBox();
         const shareRect=await page.getByRole("button",{name:"Share post"}).boundingBox();
         assert.ok(offerRect && shareRect &&
           offerRect.x+offerRect.width<=shareRect.x-2,
           "Figma offer action must NEVER overlap Share rail or be hidden under controls");
       }
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
       // A screenshot audit revealed the floating bottom nav rendered ABOVE
       // the cream sheet. A portal-backed modal must obscure that dock.
       const modalAboveDock=await dialog.evaluate(el=>{
         const nav=document.querySelector('nav[aria-label="Hustle mobile application"]');
         if(!nav) return true;
         const rect=nav.getBoundingClientRect(), css=getComputedStyle(nav);
         if(rect.width<1 || rect.height<1 || css.display==="none" || css.visibility==="hidden") return true;
         const x=Math.min(innerWidth-8,Math.max(8,rect.x+rect.width/2));
         const y=Math.min(innerHeight-8,Math.max(8,rect.y+rect.height/2));
         const front=document.elementFromPoint(x,y);
         return !!front && !!el.parentElement?.contains(front);
       });
       assert.equal(modalAboveDock,true,
         "Offer sheet must paint above floating nav, not behind it");
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
       // UX019: real Figma Explore landing, area filtering and autocomplete.
       await page.goto(root+"/search",{waitUntil:"domcontentloaded"});
       if(size.width<=760) {
         await page.getByRole("heading",{name:"Explore",exact:true}).waitFor();
         const exploreHeading=await page.getByRole("heading",{name:"Explore",exact:true}).boundingBox();
         assert.ok(exploreHeading && exploreHeading.x>=10 && exploreHeading.x<=28,
           "Figma Explore title must align to 20-24px mobile gutters, not old shell padding");
         await page.getByRole("heading",{name:"Explore nearby"}).waitFor();
         await page.getByRole("heading",{name:"Featured Hustlers"}).waitFor();
         await page.getByRole("link",{name:/QA Hustler/}).waitFor({timeout:12000});
         assert.equal(await page.getByText("No published Hustlers found").count(),0);
         const area=page.getByRole("textbox",{name:"Area for published local work"});
         assert.equal(await area.inputValue(),"Lagos");
         await page.screenshot({path:path.join(out,size.label+"__figma-explore-landing.png"),
           animations:"disabled",caret:"hide"});
         const search=page.getByRole("searchbox",{name:"Search Hustle"});
         await search.fill("a");
         await page.getByRole("button",{name:/Artist/}).waitFor();
         await search.fill("ba");
         await page.getByRole("link",{name:/QA Barber Session/}).waitFor({timeout:15000});
         await page.screenshot({path:path.join(out,size.label+"__figma-explore-suggestions.png"),
           animations:"disabled",caret:"hide"});
         await page.keyboard.press("Escape");
         await page.getByRole("region",{name:"Search suggestions"}).waitFor({state:"detached",timeout:4000});
         // UX020: typing a handle must preview all four published result types,
         // with canonical links and no invented profile/product URLs.
         await search.fill("xp");
         const panel=page.getByRole("region",{name:"Search suggestions"});
         for(const [label,href] of [
           ["QA Hustler","/u/qa-hustler"],["A synthetic barber project","/posts/qa-post-001"],
           ["QA Barber Session","/services/qa-service"],["QA Hair Care Kit","/products/qa-product"]
         ]){
           const result=panel.getByRole("link",{name:new RegExp(label)});
           await result.waitFor({state:"visible",timeout:12000});
           assert.equal(await result.getAttribute("href"),href);
         }
         await page.screenshot({path:path.join(out,size.label+"__explore-four-type-suggestions.png"),
           animations:"disabled",caret:"hide"});
         await page.keyboard.press("Escape");
         await panel.waitFor({state:"detached",timeout:4000});
       }
       // UX021: category grouping is rendered from the existing real-shaped
       // four-type fixture. Each card keeps the canonical URL and no internal
       // relevance score is shown to the end user.
       await page.goto(root+"/search?q=xp",{waitUntil:"domcontentloaded"});
       for(const heading of ["People","Posts","Services","Products"]){
         await page.getByRole("region",{name:heading+" search results"}).waitFor({state:"visible",timeout:15000});
       }
       // UX022: a single post fills the mobile content width; larger sets
       // remain in the regular 2-column media grid. No empty synthetic tiles.
       if(size.width<=760){
         const postSection=page.getByRole("region",{name:"Posts search results"});
         const postCard=postSection.getByRole("link",{name:/A synthetic barber project/}).first();
         const sectionBox=await postSection.boundingBox();
         const cardBox=await postCard.boundingBox();
         assert.ok(sectionBox && cardBox,"Visible mobile post and group are required");
         assert.ok(cardBox.width >= sectionBox.width*.94,
           "One actual post should occupy the mobile search results width");
         const wrapPadding=await page.locator("section[class*='resultsWrap']").first()
           .evaluate(el=>parseFloat(getComputedStyle(el).paddingBottom));
         assert.ok(wrapPadding<=55,"Mobile search must not double-reserve dock space");
       }
       for(const [name,href] of [
         ["QA Hustler","/u/qa-hustler"],["A synthetic barber project","/posts/qa-post-001"],
         ["QA Barber Session","/services/qa-service"],["QA Hair Care Kit","/products/qa-product"]
       ]){
         const link=page.getByRole("link",{name:new RegExp(name)}).first();
         assert.equal(await link.getAttribute("href"),href);
       }
       assert.equal(await page.getByText(/RELEVANCE/i).count(),0,
         "UX021 must not expose internal search scores");
       await page.screenshot({path:path.join(out,size.label+"__ux021-grouped-results.png"),
         animations:"disabled",caret:"hide"});
       results.push({size:size.label,step:"UX021 four-type search visual groups and canonical links",
         result:"PASS"});
       await page.goto(root+"/search?q=barber",{waitUntil:"domcontentloaded"});
       await page.getByRole("heading",{name:service.title}).waitFor({timeout:15000});
       if(size.width<=760) {
         const refine=page.getByRole("button",{name:/Refine results/});
         await refine.waitFor({state:"visible"});
         assert.equal(await refine.getAttribute("aria-expanded"),"false");
         const filters=page.getByRole("region",{name:"Search filters"});
         assert.equal(await filters.isVisible(),false,"Mobile filters should default collapsed");
         await refine.click();
         assert.equal(await filters.isVisible(),true,"Advanced filters must open");
         await refine.click();
         assert.equal(await filters.isVisible(),false,"Advanced filters must close");
       }
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
