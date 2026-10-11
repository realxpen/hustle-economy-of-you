#!/usr/bin/env node
/**
 * Read-only Chromium smoke against this commit's LOCAL Next.js build.
 * No login, backend write, form submission, API mocking, or production target.
 * Checks document delivery, hydration-level shell, viewport overflow and nav.
 * Authenticated flows and real Safari are intentionally OUT OF SCOPE.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const base=process.env.HUSTLE_LOCAL_WEB_URL || "http://127.0.0.1:3001";
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) {
  throw Error("Local UI smoke can run ONLY against 127.0.0.1 (never production)");
}
const routes=["/","/auth","/home","/search","/marketplace","/live","/stories","/stories/create","/live/create"];
const viewports=[
  {width:320,height:640},
  {width:390,height:844},
  {width:768,height:1024},
  {width:1440,height:900}
];
(async()=>{
  const browser=await chromium.launch({headless:true});
  const failures=[],passed=[];
  try {
    const context=await browser.newContext({reducedMotion:"reduce",colorScheme:"light"});
    for(const viewport of viewports) {
      for(const route of routes) {
        const page=await context.newPage({viewport});
        try {
          await page.setViewportSize(viewport);
          const response=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:25000});
          await page.waitForTimeout(220);
          const result=await page.evaluate(()=>{
            const main=document.querySelector("main");
            const docWidth=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
            return {
              url:location.pathname,
              mainPresent:Boolean(main),
              bodyText:document.body.innerText.trim().length,
              overflow:docWidth-innerWidth,
              hasBrand:document.body.innerText.toLowerCase().includes("hustle")
            };
          });
          const status=response?.status()??null;
          if(!status || status>=400 || !result.mainPresent || result.bodyText<10 || result.overflow>3 || !result.hasBrand) {
            failures.push({viewport,route,status,result});
          } else passed.push({viewport,route,status});
        }catch(error){
          failures.push({viewport,route,error:String(error.message||error).slice(0,300)});
        } finally {
          await page.close();
        }
      }
    }
    await context.close();
  } finally { await browser.close(); }
  const report={result:failures.length?"FAIL":"PASS",description:"local Chromium shell-only; not authenticated UX, iOS Safari or backend acceptance",base,checked:passed.length+failures.length,passed:passed.length,failed:failures.length,failures};
  const json=JSON.stringify(report,null,2);
  console.log(json);
  if(process.env.HUSTLE_SMOKE_REPORT_PATH) fs.writeFileSync(process.env.HUSTLE_SMOKE_REPORT_PATH,json+"\n");
  if(failures.length)process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1});
