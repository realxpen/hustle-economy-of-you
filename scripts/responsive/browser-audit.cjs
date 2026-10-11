#!/usr/bin/env node
/* Read-only Web viewport smoke audit. Does not submit forms, write data or log in.
   If a protected route redirects to /auth, it is UNVERIFIED (not a pass).
   Optional HUSTLE_STORAGE_STATE points to an external local Playwright state
   file: never commit a private session/cookie file to this repo.
   Run: node scripts/responsive/browser-audit.cjs https://example.com */
const { chromium } = require("playwright");
const fs = require("node:fs");
const base = process.argv[2] || process.env.HUSTLE_BASE_URL;
if (!base || !/^https:\/\/[^/]+\/?$/.test(base)) {
  console.error("Usage: node scripts/responsive/browser-audit.cjs https://your-hustle-web-host");
  process.exit(2);
}
const widths = [320,360,390,430,600,768,1024,1440];
const screens = [...widths.map((width) => ({width,height:width<=430?740:width<=768?820:900})),
  {width:390,height:590}, {width:390,height:475}, {width:844,height:390}];
const routes = ["/","/auth","/home","/search","/marketplace","/messages","/notifications","/wallet","/bookings","/orders","/cart","/checkout","/live","/stories","/agent-application","/agent-workspace","/posts/manage"];
const extra=(process.env.HUSTLE_EXTRA_ROUTES||"").split(",").map(s=>s.trim()).filter(s=>/^\/[a-z0-9/_.%-]+$/i.test(s));
const paths=[...new Set([...routes,...extra])];
(async()=>{
  const browser=await chromium.launch({headless:true});
  const options={viewport:screens[0],reducedMotion:"reduce",colorScheme:"light"};
  if(process.env.HUSTLE_STORAGE_STATE) {
    if(!fs.existsSync(process.env.HUSTLE_STORAGE_STATE))throw Error("Storage state file not found");
    options.storageState=process.env.HUSTLE_STORAGE_STATE;
  }
  const context=await browser.newContext(options);
  const failures=[],unverified=[];
  for(const screen of screens){
    for(const route of paths){
      const page=await context.newPage();
      await page.setViewportSize(screen);
      try{
        const response=await page.goto(new URL(route,base).toString(),{waitUntil:"domcontentloaded",timeout:20000});
        await page.waitForTimeout(350);
        const current=new URL(page.url()).pathname;
        if(route!=="/auth" && current.startsWith("/auth") && current!==route){
          unverified.push({route,width:screen.width,reason:"auth redirect"});
          continue;
        }
        const result=await page.evaluate(()=>{
          const w=window.innerWidth;
          const documentWidth=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
          const fixed=[...document.querySelectorAll("nav,header,[role='navigation']")]
            .filter(el=>{const s=getComputedStyle(el);return s.position==="fixed"&&s.display!=="none"})
            .map(el=>({label:el.getAttribute("aria-label")||el.tagName,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
          const clippedFixed=fixed.filter(e=>e.left < -3 || e.right > w+3);
          const fields=[...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]),textarea,select")]
            .filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&r.width>0})
            .filter(el=>parseFloat(getComputedStyle(el).fontSize)<16)
            .map(el=>({type:el.tagName,name:el.getAttribute("name"),px:getComputedStyle(el).fontSize}));
          const rail=document.querySelector('[aria-label="Post actions"]');
          const offer=document.querySelector('section[aria-label="Services and products attached to this post"] > button');
          const dock=document.querySelector('nav[aria-label="Hustle main navigation"]');
          const railVisible=rail && getComputedStyle(rail).display!=="none";
          const incorrectPortraitRail=Boolean(railVisible && matchMedia("(orientation: portrait)").matches && getComputedStyle(rail).flexDirection!=="column");
          const offerBottom=offer?.getBoundingClientRect().bottom;
          const dockTop=dock?.getBoundingClientRect().top;
          const offerBehindDock=Boolean(offer && dock && offerBottom > dockTop+3);
          return {width:w,documentWidth,overflow:documentWidth-w,clippedFixed,smallFields:fields.slice(0,5),
            hasPost:!!rail,incorrectPortraitRail,offerBehindDock};
        });
        if(result.overflow>3||result.clippedFixed.length||(screen.width<=760&&result.smallFields.length)||result.incorrectPortraitRail||result.offerBehindDock){
          failures.push({route,width:screen.width,result,status:response?.status()});
        }
      }catch(error){failures.push({route,width:screen.width,error:String(error.message).slice(0,180)});}
      finally{await page.close();}
    }
  }
  await browser.close();
  console.log(JSON.stringify({base,screens,routeCount:paths.length,failures,unverifiedCount:unverified.length,unverified:unverified.slice(0,40)},null,2));
  if(failures.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
