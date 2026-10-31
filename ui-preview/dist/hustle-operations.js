(function hustleOperations(){
"use strict";
const phone=document.getElementById("phone");if(!phone)return;
const money=n=>"₦"+Number(n||0).toLocaleString("en-NG");
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const dateNow=()=>new Date().toLocaleString("en-NG",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
const store={
 wallet:18500,earnings:7200,pending:3500,
 escrow:[
  {id:"HES-2401",client:"You",creator:"Tobi Adeyemi",service:"Premium grooming package",value:32000,created:"24 Oct",status:"Held",milestones:[{id:1,title:"Style plan & consultation",amount:12000,status:"Held"},{id:2,title:"Service completion",amount:20000,status:"Held"}],log:["Example escrow funded"]},
  {id:"HES-2402",client:"You",creator:"Zara Okafor",service:"Custom outfit",value:15000,created:"22 Oct",status:"Disputed",milestones:[{id:1,title:"Final fitting",amount:15000,status:"Held"}],log:["Example dispute raised","Funds held pending resolution"]},
  {id:"HES-2399",client:"You",creator:"Chef Amara",service:"Meal delivery",value:8000,created:"18 Oct",status:"Completed",milestones:[{id:1,title:"Delivery confirmed",amount:8000,status:"Released"}],log:["Example escrow released"]}
 ],
 history:[
  {title:"Example wallet funding",detail:"Sample balance · 24 Oct",amount:25000,type:"credit",kind:"Funding"},
  {title:"Example escrow funded",detail:"HES-2401 · 24 Oct",amount:32000,type:"debit",kind:"Escrow"},
  {title:"Example payout completed",detail:"Demo earnings · 20 Oct",amount:5000,type:"debit",kind:"Payout"}
 ],
 bookings:[
  {id:"HB-301",person:"Ayo Williams",service:"Signature haircut",day:"Monday · 11:30 AM",state:"Consultation requested",price:8000},
  {id:"HB-302",person:"Dami Ade",service:"Private styling",day:"Thursday · 2:00 PM",state:"Awaiting quote",price:18000},
  {id:"HB-303",person:"Teni Bello",service:"Grooming package",day:"Friday · 10:00 AM",state:"In progress",price:32000}
 ],
 talent:[
  {id:"AG-01",name:"Tobi Adeyemi",skill:"Barbering",city:"Lekki",status:"Active",earnings:41500,avatar:"💈"},
  {id:"AG-02",name:"Zara Okafor",skill:"Fashion design",city:"Yaba",status:"Pending invite",earnings:18200,avatar:"🧵"},
  {id:"AG-03",name:"Flora Studio",skill:"Floral styling",city:"Yaba",status:"Active",earnings:12600,avatar:"💐"}
 ],
 moderation:[
  {id:"MOD-31",type:"Reported post",person:"Sample creator",description:"Potential misleading service claim",state:"Pending"},
  {id:"MOD-32",type:"Listing review",person:"Sample storefront",description:"Product image ownership review",state:"Pending"},
  {id:"MOD-33",type:"Identity check",person:"Sample professional",description:"Verification materials require review",state:"Pending"}
 ],
 agents:[{id:"APP-20",name:"Sample agent",category:"Talent management",state:"Pending"}],
 audit:[{date:"Sample",action:"Sandbox initialized",context:"No production data"}]
};
const state={page:"Wallet",previous:[],walletTab:"Overview",hustlerTab:"Overview",agentTab:"Overview",adminTab:"Dashboard",activityTab:"All",escrowId:"HES-2401",milestoneId:1,confirmAction:null,fundingMethod:"Card",agentPreview:false,adminPreview:false,adminInspect:false,agentApplied:false,hustlerAvailable:true,modal:"",formDraft:{}};
let root=document.getElementById("hustleOpsLayer");if(!root){root=document.createElement("section");root.id="hustleOpsLayer";root.className="ho-root";root.hidden=true;phone.appendChild(root)}
function audit(action,context){store.audit.unshift({date:dateNow(),action,context});}
const escrow=id=>store.escrow.find(x=>x.id===id);
const held=x=>x.milestones.filter(m=>m.status==="Held").reduce((n,m)=>n+m.amount,0);
const totalHeld=()=>store.escrow.reduce((n,e)=>n+held(e),0);
const tone=(s)=>s==="Held"?"held":s==="Completed"||s==="Released"||s==="Approved"?"success":s==="Disputed"?"danger":s==="Pending"?"pending":"neutral";
function badge(s){return `<span class="ho-badge ho-${tone(s)}">${esc(s)}</span>`}
function btn(label,op,variant="solid",id=""){return `<button type="button" class="ho-btn ho-${variant}" data-op="${op}" ${id?`data-id="${esc(id)}"`:""}>${label}</button>`}
function header(title,subtitle,back=true,actions=""){return `<header class="ho-header"><div class="ho-head-row">${back?`<button class="ho-back" data-op="back" aria-label="Go back">←</button>`:""}<div><small>HUSTLE · DEMO</small><h1>${title}</h1><p>${subtitle||""}</p></div>${actions}</div></header>`}
function banner(title,text,mode="notice"){return `<div class="ho-banner ho-${mode}"><b>${title}</b><p>${text}</p></div>`}
function section(title,action=""){return `<div class="ho-section"><h2>${title}</h2>${action}</div>`}
function tabs(items,active,op){return `<div class="ho-tabs" role="tablist">${items.map(x=>`<button role="tab" aria-selected="${active===x}" class="${active===x?"active":""}" data-op="${op}" data-value="${esc(x)}">${esc(x)}</button>`).join("")}</div>`}
function stat(name,value,desc){return `<div class="ho-stat"><small>${name}</small><strong>${value}</strong><span>${desc}</span></div>`}
function line(icon,title,sub,trailing,op="",id=""){return `<${op?"button":"div"} class="ho-line" ${op?`data-op="${op}" data-id="${esc(id)}"`:""}><span class="ho-line-icon">${icon}</span><span class="ho-line-copy"><b>${title}</b><small>${sub}</small></span><span class="ho-line-trail">${trailing}</span></${op?"button":"div"}>`}
function visibleStatus(){return `<p class="ho-demo-label">SIMULATED DATA · No real customer funds or financial actions</p>`}
function nav(page){if(page===state.page)return;state.previous.push(state.page);state.page=page;state.modal="";render()}
function back(){if(state.modal){state.modal="";render();return}if(state.previous.length){state.page=state.previous.pop();render()}else close()}
function close(){root.hidden=true;root.innerHTML="";state.previous=[];state.modal="";phone.classList.remove("ho-open")}
function open(page="Wallet"){
 state.previous=[];state.page=page;state.modal="";state.adminPreview=false;state.adminInspect=false;
 if(page==="Agent"&&!state.agentPreview)state.page="AgentIntro";
 if(page==="Admin")state.page="AdminGate";
 root.hidden=false;phone.classList.add("ho-open");render()
}
function walletOverview(){
 return `${visibleStatus()}<div class="ho-balance"><div class="ho-balance-top"><span>Available demo balance</span><span class="ho-wallet-mark">₦</span></div><strong>${money(store.wallet)}</strong><small>Sample funds only · Not linked to a payment account</small>
 <div class="ho-actions">${btn("＋ Add money","deposit","lime")}${btn("↗ Withdraw","withdraw","glass")}</div></div>
 <div class="ho-stats-two">${stat("In escrow",money(totalHeld()),"Protected service payments")}${stat("Creator earnings",money(store.earnings),"Payout eligibility unverified")}</div>
 ${section("Manage your money",`<button class="ho-text-action" data-op="wallet-tab" data-value="Activity">See activity →</button>`)}
 <div class="ho-quick-grid">
 <button data-op="wallet-tab" data-value="Escrows"><span>🔒</span><b>Escrow manager</b><small>Milestones & disputes</small></button>
 <button data-op="wallet-tab" data-value="Activity"><span>▤</span><b>Transactions</b><small>Funding & releases</small></button>
 <button data-op="withdraw"><span>🏦</span><b>Payouts</b><small>Bank & verification</small></button>
 <button data-op="Hustler"><span>✳</span><b>Hustler Studio</b><small>Earnings & bookings</small></button>
 </div>
 ${section("Active escrows",`<button class="ho-text-action" data-op="wallet-tab" data-value="Escrows">View all →</button>`)}
 ${store.escrow.filter(e=>held(e)>0).slice(0,2).map(e=>line("🔒",esc(e.service),`${esc(e.creator)} · ${e.id}`,`${badge(e.status)}<b>${money(held(e))}</b>`,"escrow",e.id)).join("")}
 ${section("Recent activity")}
 ${store.history.slice(0,3).map(t=>line(t.type==="credit"?"↙":"↗",esc(t.title),esc(t.detail),`<b class="${t.type==="credit"?"ho-positive":""}">${t.type==="credit"?"+":"−"}${money(t.amount)}</b>`)).join("")}
 ${banner("Direct checkout remains available","Customers should be able to pay a seller or protected service payment without pre-funding a wallet.","quiet")}`;
}
function walletEscrows(){
 return `${visibleStatus()}<div class="ho-escrow-total"><span>Demo funds held across escrows</span><strong>${money(totalHeld())}</strong><small>Funds are represented by simulated ledger entries only.</small></div>
 <div class="ho-actions">${btn("＋ New escrow demo","newEscrow","lime")}${btn("How it works","escrowHelp","outline")}</div>
 ${section("Service escrows")}
 ${store.escrow.map(e=>`<button class="ho-escrow-card" data-op="escrow" data-id="${e.id}"><div class="ho-escrow-top"><span>${esc(e.id)}</span>${badge(e.status)}</div><h3>${esc(e.service)}</h3><p>${esc(e.creator)} · ${esc(e.created)}</p><div class="ho-escrow-values"><div><small>Amount agreed</small><b>${money(e.value)}</b></div><div><small>Still held</small><b>${money(held(e))}</b></div><strong>→</strong></div><div class="ho-meter"><span style="width:${Math.round(100*(e.value-held(e))/e.value)}%"></span></div></button>`).join("")}
 ${banner("Release and dispute control","Only the client should authorize release of agreed milestones. If disputed, payouts remain on hold pending review.","quiet")}`;
}
function walletActivity(){
 const kinds=["All","Funding","Escrow","Payout"],records=store.history.filter(t=>state.activityTab==="All"||t.kind===state.activityTab);
 return `${visibleStatus()}${tabs(kinds,state.activityTab,"activity-tab")}${section("Transactions",`<small>${records.length} sample events</small>`)}
 ${records.length?records.map(t=>line(t.type==="credit"?"↙":"↗",esc(t.title),esc(t.detail),`<b class="${t.type==="credit"?"ho-positive":""}">${t.type==="credit"?"+":"−"}${money(t.amount)}</b>`)).join(""):banner("No transactions here","Nothing in this category yet.","quiet")}
 ${banner("Financial records","Real transaction history must be produced from authenticated, reconciled provider events—not from browser state.","quiet")}`;
}
function walletFunding(){
 return `${visibleStatus()}${section("Funding options")}
 <button class="ho-funding-method" data-op="deposit"><span>💳</span><div><b>Debit card</b><small>Funding form and payment confirmation preview</small></div><strong>→</strong></button>
 <button class="ho-funding-method" data-op="deposit-bank"><span>🏦</span><div><b>Bank transfer</b><small>Preview payment instructions; no real virtual account</small></div><strong>→</strong></button>
 ${section("Withdrawals")}
 <button class="ho-funding-method" data-op="withdraw"><span>↗</span><div><b>Withdraw earnings</b><small>Requires verified payout account and eligible balance</small></div><strong>→</strong></button>
 ${banner("Wallet is optional for shoppers","The eventual wallet would need a licensed issuing/custody partner and reconciled ledger. Checkout and escrow can be provider-managed without requiring a stored-value wallet.","quiet")}`;
}
function renderWallet(){
 const entries=["Overview","Escrows","Activity","Funding"];
 const content=state.walletTab==="Overview"?walletOverview():state.walletTab==="Escrows"?walletEscrows():state.walletTab==="Activity"?walletActivity():walletFunding();
 return header("Wallet & escrow","Payments, protected work and earnings",true,`<button class="ho-head-icon" data-op="Hustler" aria-label="Hustler Studio">✳</button>`)+`<div class="ho-screen">${tabs(entries,state.walletTab,"wallet-tab")}${content}</div>`;
}
function renderEscrow(){
 const e=escrow(state.escrowId);if(!e)return banner("Escrow missing","Return to the list");
 const readOnly=state.adminInspect;
 return header("Escrow details",e.id)+`<div class="ho-screen">${visibleStatus()}<div class="ho-detail-hero"><div class="ho-escrow-top">${badge(e.status)}<span>${esc(e.created)}</span></div><h2>${esc(e.service)}</h2><p>Client: ${esc(e.client)} · Professional: ${esc(e.creator)}</p><div class="ho-detail-total">${money(e.value)} <small>agreed demo amount</small></div>
 <div class="ho-detail-breakdown"><span>Held now <b>${money(held(e))}</b></span><span>Already released <b>${money(e.value-held(e))}</b></span></div></div>
 ${section("Milestone payments")}
 ${e.milestones.map(m=>`<div class="ho-milestone"><div class="ho-milestone-mark">${m.status==="Released"?"✓":m.status==="Refunded"?"↩":"🔒"}</div><div><b>${esc(m.title)}</b><small>${money(m.amount)} · ${m.status}</small></div>${!readOnly&&m.status==="Held"&&e.status==="Held"?`<button class="ho-small-lime" data-op="confirm-release" data-id="${e.id}" data-mid="${m.id}">Release</button>`:badge(m.status)}</div>`).join("")}
 <div class="ho-actions">${readOnly?btn("Inspect history","escrowHistory","outline",e.id):e.status==="Held"?btn("Raise a dispute","dispute","outline",e.id):btn("View dispute status","disputeInfo","outline",e.id)}${!readOnly?btn("Escrow history","escrowHistory","outline",e.id):""}</div>
 ${banner("Important","Release is the client's decision after accepting work. Disputed funds should be frozen and reviewed. This prototype cannot move or lock money.","quiet")}</div>`;
}
function renderDeposit(){
 return header("Add money","Wallet funding · demonstration")+`<div class="ho-screen">${visibleStatus()}<div class="ho-amount-intro"><span>Available now (demo)</span><strong>${money(store.wallet)}</strong></div>
 <form data-ho-form="deposit" class="ho-form"><label for="hoAmount">Amount (NGN)</label><input id="hoAmount" name="amount" type="number" inputmode="numeric" min="100" max="1000000" step="100" placeholder="e.g. 10000" required value="10000">
 <div class="ho-presets">${[2000,5000,10000,25000].map(n=>`<button type="button" data-op="set-amount" data-id="${n}">${money(n)}</button>`).join("")}</div>
 <label for="hoMethod">Funding method</label><select id="hoMethod" name="method"><option value="Card" ${state.fundingMethod==="Card"?"selected":""}>Card (demo)</option><option value="Bank transfer" ${state.fundingMethod==="Bank transfer"?"selected":""}>Bank transfer (demo)</option></select>
 ${banner("No real payment details","No card fields or bank account numbers are collected. Confirm only creates an in-memory demo transaction.","quiet")}
 <button class="ho-btn ho-lime ho-full" type="submit">Simulate adding funds →</button></form></div>`;
}
function renderWithdraw(){
 return header("Withdraw earnings","Payout request preview")+`<div class="ho-screen">${visibleStatus()}<div class="ho-amount-intro"><span>Demo eligible earnings</span><strong>${money(store.earnings)}</strong></div>
 <form data-ho-form="withdraw" class="ho-form"><label for="hoWithdrawAmount">Withdrawal amount (NGN)</label><input id="hoWithdrawAmount" name="amount" type="number" inputmode="numeric" min="100" step="100" max="${store.earnings}" placeholder="e.g. 2000" required>
 <label for="hoBank">Payout account</label><select id="hoBank" name="account"><option value="demo">Demo payout account · Not verified</option></select>
 ${banner("Verification required in production","KYC, bank ownership, fraud checks and provider approval are required. Agent-managed accounts also require the hustler's own face confirmation.","quiet")}
 <button class="ho-btn ho-lime ho-full" type="submit">Simulate payout request →</button></form></div>`;
}
function renderNewEscrow(){
 return header("New protected payment","Create demo milestones")+`<div class="ho-screen">${visibleStatus()}
 <form class="ho-form" data-ho-form="escrow"><label for="hoEscrowService">Service / agreement</label><select id="hoEscrowService" name="service"><option value="Signature haircut">Signature haircut · Tobi Adeyemi</option><option value="Custom outfit">Custom outfit · Zara Okafor</option><option value="Floral styling">Floral styling · Flora Studio</option></select>
 <label for="hoEscrowAmount">Agreed total (NGN)</label><input id="hoEscrowAmount" type="number" min="1000" max="250000" inputmode="numeric" name="amount" placeholder="e.g. 8000" required>
 <p>For demonstration, payments are split into 40% planning and 60% completion milestones.</p>
 ${banner("Demo only","The sample amount will be deducted from your simulated balance. Real escrow can only be created against an authorized booking/quote and licensed payment-provider flow.","quiet")}
 <button type="submit" class="ho-btn ho-lime ho-full">Create simulated escrow →</button></form></div>`;
}
function renderDecision(){
 const a=state.confirmAction;if(!a)return "";
 const e=escrow(a.escrow),m=e?.milestones.find(x=>x.id===a.mid);
 return `<div class="ho-modal-scrim"><div class="ho-modal"><span class="ho-modal-icon">🔒</span><h2>${a.type==="release"?"Confirm milestone release":"Raise a dispute"}</h2>
 <p>${a.type==="release"?`Release <b>${money(m?.amount)}</b> for <b>${esc(m?.title)}</b>? In a real transaction this may transfer funds irrevocably.`:`Place <b>${money(held(e))}</b> on dispute hold and request internal review?`}</p>
 <div class="ho-actions">${btn("Cancel","cancel-decision","outline")}${btn(a.type==="release"?"Simulate release":"Simulate dispute","decide","lime")}</div></div></div>`;
}
function renderActivityHistory(){
 const e=escrow(state.escrowId);
 return header("Escrow timeline",e?.id||"Demo")+`<div class="ho-screen">${visibleStatus()}${section("Timeline")}${(e?.log||[]).map((x,i)=>line("✦",esc(x),i===0?esc(e.created):"Demo event","✓")).join("")}</div>`;
}
function renderHustler(){
 const tabsArr=["Overview","Bookings","Listings","Insights","Earnings"];
 let content="";
 if(state.hustlerTab==="Overview"){
  content=`<div class="ho-studio-hero"><span>YOUR PROFESSIONAL SPACE · DEMO</span><h2>Your skills. Your business.</h2><p>Manage consultations, availability, listings, payments and customer relationships in one place.</p></div>
   <div class="ho-stats-two">${stat("New enquiries","6","Example this week")}${stat("Completed jobs","24","Example this month")}${stat("Average rating","4.9","Sample reviews")}${stat("Earnings",money(store.earnings),"Demo amount")}</div>
   ${section("Quick actions")}<div class="ho-quick-grid"><button data-op="studio-tab" data-value="Bookings"><span>▤</span><b>Bookings</b><small>Jobs & consultations</small></button><button data-op="create-service"><span>＋</span><b>Create listing</b><small>Service or product</small></button><button data-op="Wallet"><span>₦</span><b>Wallet</b><small>Escrows & earnings</small></button><button data-op="studio-tab" data-value="Insights"><span>↗</span><b>Insights</b><small>Your performance</small></button></div>
   ${section("Upcoming work",`<button class="ho-text-action" data-op="studio-tab" data-value="Bookings">See all →</button>`)}
   ${store.bookings.slice(0,2).map(b=>line("✳",esc(b.service),`${esc(b.person)} · ${esc(b.day)}`,badge(b.state),"booking",b.id)).join("")}
   <div class="ho-availability"><div><b>Accepting new enquiries</b><small>Your preview availability status</small></div><button class="ho-switch ${state.hustlerAvailable?"on":""}" data-op="availability" role="switch" aria-checked="${state.hustlerAvailable}" aria-label="Toggle availability"><span></span></button></div>`;
 }else if(state.hustlerTab==="Bookings"){
  content=`${section("Bookings & consultations")}${store.bookings.map(b=>line("◷",esc(b.service),`${esc(b.person)} · ${esc(b.day)}`,badge(b.state),"booking",b.id)).join("")}
  ${banner("Quotes & milestones","Each booking progresses through consultation → quote → client-approved milestones → protected payment → completion and release. Only clients authorize escrow release.","quiet")}`;
 }else if(state.hustlerTab==="Listings"){
  content=`${section("Your listings",btn("+ New listing","create-service","outline"))}
  ${[["Signature haircut","Service · from ₦8,000","💈"],["Grooming workshop","Training · from ₦30,000","🎓"],["Finishing kit","Product · sample","🛍️"]].map(([a,b,i])=>line(i,a,b,badge("Active"))).join("")}
  ${banner("Listing tools","Production studio will support stock, photos, pricing, availability, variants, offers and publishing moderation.","quiet")}`;
 }else if(state.hustlerTab==="Insights"){
  content=`${section("Audience insights")}${banner("Example analytics","These numbers are illustrations. Real analytics require tracked and consented events.","quiet")}
  <div class="ho-stats-two">${stat("Profile visits","1,284","Example +12%")}${stat("Post views","8,920","Example +24%")}${stat("Hire inquiries","38","Example +7%")}${stat("Conversion","3.0%","Illustrative")}</div>
  ${section("How people discover you")}${[["For You",68],["Explore",22],["Map",10]].map(([label,num])=>`<div class="ho-chart-bar"><span>${label}</span><div><i style="width:${num}%"></i></div><b>${num}%</b></div>`).join("")}
  ${section("Improve your business")}<p class="ho-copy">Publish useful work, keep listings accurate, answer consultations promptly and maintain clear payment milestones.</p>`;
 }else{
  content=`${section("Your earnings")}${stat("Eligible demo earnings",money(store.earnings),"No connected payout provider")}
   <div class="ho-stats-two">${stat("Protected payments",money(totalHeld()),"Client-owned escrows · sample")}${stat("Pending payout",money(store.pending),"Sample processing")}</div>
   <div class="ho-actions">${btn("Wallet & escrow","Wallet","lime")}${btn("Withdraw","withdraw","outline")}</div>
   ${section("Latest financial events")}${store.history.slice(0,4).map(h=>line("₦",esc(h.title),esc(h.detail),money(h.amount))).join("")}`;
 }
 return header("Hustler Studio","Manage your creative business")+`<div class="ho-screen">${tabs(tabsArr,state.hustlerTab,"studio-tab")}${content}</div>`;
}
function renderBooking(){
 const b=store.bookings.find(x=>x.id===state.formDraft.booking);
 return header("Booking workspace",b?.id||"Demo booking")+`<div class="ho-screen">${visibleStatus()}<div class="ho-detail-hero"><h2>${esc(b?.service)}</h2><p>${esc(b?.person)} · ${esc(b?.day)}</p>${badge(b?.state||"Pending")}</div>
 ${section("Next steps")}
 <div class="ho-payment-step"><span>1</span><div><b>Consult with customer</b><small>Clarify scope, references, availability and price.</small></div></div>
 <div class="ho-payment-step"><span>2</span><div><b>Prepare a quote</b><small>Invoice terms and agreed service milestones.</small></div></div>
 <div class="ho-payment-step"><span>3</span><div><b>Complete work</b><small>Client confirms agreed completion before payment release.</small></div></div>
 <div class="ho-actions">${btn("Mark as quoted","booking-progress","lime")}${btn("View escrow","Wallet","outline")}</div>
 ${banner("No real customer action","Changing this booking stage affects only the sample studio.","quiet")}</div>`;
}
function renderAgentIntro(){
 return header("Agent Studio","Manage professionals with permission")+`<div class="ho-screen"><div class="ho-studio-hero"><span>AGENT ROLE · APPLICATION REQUIRED</span><h2>Build a network of talented professionals.</h2><p>Help hustlers manage enquiries, bookings, schedules and client relationships—without owning their funds.</p></div>
 ${section("What an approved agent can do")}
 ${[["Manage multiple professionals","Operate permitted calendars and listings"],["Track enquiries and bookings","Support work, consultations and customer communication"],["See commission reporting","Transparent agency agreements and fee records"],["Request withdrawal approval","Hustler must personally verify withdrawals"]].map(([a,b],i)=>line(["👥","▤","₦","🔐"][i],a,b,"✓")).join("")}
 ${state.agentApplied?banner("Application pending","Your sample application is in review. This does not make your account an approved agent. You may separately preview the dashboard.","quiet"):""}${banner("Access is permission-based","Agent status requires application, review and each professional's explicit authorization. This prototype can simulate the approved dashboard.","quiet")}
 <div class="ho-actions">${btn("Apply (demo)","agent-apply","lime")}${btn("Preview approved studio","agent-preview","outline")}</div></div>`;
}
function renderAgent(){
 const tabsArr=["Overview","Talent","Bookings","Commissions","Approvals"];
 let content="";
 if(state.agentTab==="Overview"){
  content=`<div class="ho-studio-hero"><span>APPROVED AGENT · SAMPLE ACCESS</span><h2>Your talent, organized.</h2><p>Example agency tools, client requests and upcoming work.</p></div>
  <div class="ho-stats-two">${stat("Managed hustlers","3","Two active · one pending")}${stat("Open requests","8","Illustrative")}${stat("Agency commission",money(8600),"Example only")}${stat("Approvals","2","Require action")}</div>
  ${section("Your professionals",`<button class="ho-text-action" data-op="agent-tab" data-value="Talent">Manage →</button>`)}
  ${store.talent.slice(0,2).map(x=>line(x.avatar,esc(x.name),`${esc(x.skill)} · ${esc(x.city)}`,badge(x.status),"talent",x.id)).join("")}`;
 }else if(state.agentTab==="Talent"){
  content=`${section("Managed hustlers",btn("+ Invite talent","agent-invite","outline"))}
  ${store.talent.map(x=>line(x.avatar,esc(x.name),`${esc(x.skill)} · ${esc(x.city)}`,badge(x.status),"talent",x.id)).join("")}
  ${banner("Permission required","An agent can only access accounts after the hustler accepts an invitation and grants scoped permissions.","quiet")}`;
 }else if(state.agentTab==="Bookings"){
  content=`${section("Assigned work")}
  ${store.bookings.map(x=>line("◷",esc(x.service),`${esc(x.person)} · ${esc(x.day)}`,badge(x.state),"booking",x.id)).join("")}`;
 }else if(state.agentTab==="Commissions"){
  content=`${section("Agency earnings")}
  <div class="ho-stats-two">${stat("Estimated commissions",money(8600),"Simulated monthly amount")}${stat("Pending settlement",money(3400),"Sample only")}</div>
  ${store.talent.map(x=>line(x.avatar,esc(x.name),esc(x.skill),`${money(Math.round(x.earnings*0.12))} demo`)).join("")}
  ${banner("Contract-based commissions","Actual commission schedules, fee allocations and payouts require contracts, consent, and a reconciled payment provider.","quiet")}`;
 }else{
  content=`${section("Permissions & withdrawals")}
  ${line("🔐","Withdrawal confirmation","Tobi Adeyemi · hustler identity/face check required",badge("Pending"),"agent-verify","AG-01")}
  ${line("✉","Talent invitation","Zara Okafor · awaiting acceptance",badge("Pending"),"talent","AG-02")}
  ${banner("Agent cannot withdraw for a hustler","The professional must personally authorize and complete the required identity/face verification with the trusted provider. This button does not trigger biometric capture.","quiet")}`;
 }
 return header("Agent Studio","Demo approved agent · scoped permissions")+`<div class="ho-screen">${tabs(tabsArr,state.agentTab,"agent-tab")}${content}</div>`;
}
function renderTalent(){
 const t=store.talent.find(x=>x.id===state.formDraft.talent);
 return header("Managed professional","Permission-limited demo")+`<div class="ho-screen"><div class="ho-detail-hero"><h2>${esc(t?.name)}</h2><p>${esc(t?.skill)} · ${esc(t?.city)}</p>${badge(t?.status||"Pending")}</div>
 ${section("Agent actions")}
 ${line("▤","Bookings & enquiries","View delegated work and schedules","→","agent-tab-target","Bookings")}
 ${line("₦","Commission reporting","View contract-based example payouts","→","agent-tab-target","Commissions")}
 ${line("🔐","Withdrawal approval","Requires this hustler's face verification",badge("Pending"),"agent-verify",t?.id)}
 ${banner("Not a shared wallet","Agent access never transfers ownership of the professional's wallet or releases their escrow.","quiet")}</div>`;
}
function renderAdminGate(){
 return header("Internal Admin","Restricted operational preview")+`<div class="ho-screen"><div class="ho-admin-guard"><span>🔐</span><h2>Admin access is invite-only.</h2><p>This console is not part of the public Hustle experience. Production access requires server-verified admin privileges, MFA, audit logging and least-privilege permissions.</p></div>
 ${banner("Sandbox console","For design testing, you may enter a locally simulated admin role. This is NOT authentication and grants access to no real customer data.","quiet")}
 ${btn("Enter internal sandbox preview","admin-enter","lime")}</div>`;
}
function renderAdmin(){
 if(!state.adminPreview)return renderAdminGate();
 const tabsArr=["Dashboard","Moderation","Escrows","Users","Finance","Audit"];
 let content="";
 if(state.adminTab==="Dashboard"){
  content=`<div class="ho-admin-hero"><small>INTERNAL DEMONSTRATION</small><h2>Operations overview</h2><p>Monitor trust, growth and service fulfillment.</p></div>
  <div class="ho-stats-two">${stat("Demo users","1,248","Example only")}${stat("Active listings","286","Example only")}${stat("Escrows held",money(totalHeld()),"Simulated ledger")}${stat("Open reports",String(store.moderation.filter(x=>x.state==="Pending").length),"Moderation samples")}</div>
  ${section("Needs attention")}
  ${line("⚑","Flagged content",`${store.moderation.filter(x=>x.state==="Pending").length} moderation items`,badge("Pending"),"admin-tab-target","Moderation")}
  ${line("🔒","Disputed escrow",`${store.escrow.filter(x=>x.status==="Disputed").length} needs review`,badge("Disputed"),"admin-tab-target","Escrows")}
  ${line("✉","Agent applications",`${store.agents.length} sample application`,badge("Pending"),"admin-tab-target","Users")}`;
 }else if(state.adminTab==="Moderation"){
  content=`${section("Content and identity review")}
  ${store.moderation.map(m=>`<div class="ho-queue"><div><small>${esc(m.id)} · ${esc(m.type)}</small>${badge(m.state)}</div><h3>${esc(m.person)}</h3><p>${esc(m.description)}</p>${m.state==="Pending"?`<div class="ho-actions">${btn("Approve","moderate-approve","outline",m.id)}${btn("Flag for review","moderate-flag","lime",m.id)}</div>`:""}</div>`).join("")}`;
 }else if(state.adminTab==="Escrows"){
  content=`${section("Disputes and settlements")}
  ${store.escrow.map(e=>`<div class="ho-queue"><div><small>${e.id} · ${esc(e.service)}</small>${badge(e.status)}</div><h3>${money(held(e))} held</h3><p>${esc(e.creator)} · client ${esc(e.client)}</p>${e.status==="Disputed"?`<div class="ho-actions">${btn("Refund client (demo)","admin-refund","outline",e.id)}${btn("Release on review (demo)","admin-release","lime",e.id)}</div>`:`<button class="ho-text-action" data-op="escrow" data-id="${e.id}">Inspect →</button>`}</div>`).join("")}
  ${banner("Never automate fund releases from browser UI","Real dispute resolutions require role authorization, evidence review, dual control and auditable provider instructions.","quiet")}`;
 }else if(state.adminTab==="Users"){
  content=`${section("Accounts & roles")}
  ${[["Creator verification","Example identity check","Pending"],["Agent application",store.agents[0]?.name||"None",store.agents[0]?.state||"Pending"],["Admin invitations","Invitation-only membership","Restricted"]].map(([a,b,c])=>line("♙",a,b,badge(c))).join("")}
  ${banner("Roles cannot be assigned here","Admin invitations, role changes and KYC approvals are disabled outside the real authenticated backend.","quiet")}`;
 }else if(state.adminTab==="Finance"){
  content=`${section("Financial oversight")}
  <div class="ho-stats-two">${stat("Sample deposits",money(store.history.filter(h=>h.kind==="Funding"&&h.type==="credit").reduce((n,h)=>n+h.amount,0)),"Not real payment volume")}${stat("Funds held",money(totalHeld()),"Demo escrow ledger")}${stat("Payouts pending",money(store.pending),"Sample only")}${stat("Disputes",String(store.escrow.filter(e=>e.status==="Disputed").length),"Example cases")}</div>
  ${section("Reconciliation checks")}
  ${line("✓","Provider webhooks","Requires signature verification","Not connected")}
  ${line("✓","Double-entry ledger","Required for real funds","Not connected")}
  ${line("✓","Settlement matching","Daily exception review","Not connected")}`;
 }else{
  content=`${section("Administrative audit trail")}
  ${store.audit.map(e=>line("◷",esc(e.action),esc(e.context),`<small>${esc(e.date)}</small>`)).join("")}
  ${banner("Sample audit only","Production operations require immutable server-side logs with actor, timestamp, IP, action, reason and approval chain.","quiet")}`;
 }
 return header("Admin Console","Internal-only sandbox · No live account access")+`<div class="ho-screen">${tabs(tabsArr,state.adminTab,"admin-tab")}${content}<p class="ho-demo-foot">All values and admin decisions above are local simulations; real admin functions need server-side authorization.</p></div>`;
}
function renderModal(){
 if(state.confirmAction)return renderDecision();
 if(state.modal==="escrowHelp")return `<div class="ho-modal-scrim"><div class="ho-modal"><span class="ho-modal-icon">🔒</span><h2>Protected service payments</h2><p>A service consultation leads to a quote, milestones and client funding. The provider holds funds; completion and client confirmation precede release. Disputes pause release until review.</p>${btn("Got it","modal-close","lime")}</div></div>`;
 if(state.modal==="disputeInfo")return `<div class="ho-modal-scrim"><div class="ho-modal"><h2>Dispute status</h2><p>Funds stay held in the simulated escrow. The case is waiting for an internal resolution. Neither agent nor hustler can release it.</p>${btn("Close","modal-close","lime")}</div></div>`;
 if(state.modal==="invite")return `<div class="ho-modal-scrim"><form class="ho-modal ho-form" data-ho-form="invite"><h2>Invite a professional</h2><p>Send a sample invitation that requires the hustler to accept before access is granted.</p><label for="hoInviteName">Name</label><input id="hoInviteName" name="name" maxlength="60" required placeholder="Professional's name"><label for="hoInviteSkill">Skill</label><input id="hoInviteSkill" name="skill" maxlength="60" required placeholder="e.g. Tailoring">${btn("Cancel","modal-close","outline")}<button type="submit" class="ho-btn ho-lime">Add demo invitation →</button></form></div>`;
 if(state.modal==="adminConfirm"){
  return `<div class="ho-modal-scrim"><div class="ho-modal"><h2>${state.formDraft.action==="admin-refund"?"Refund client?":"Release funds after review?"}</h2><p>Confirm this <strong>local demo decision only</strong>. No customer record or payment provider will be updated.</p><div class="ho-actions">${btn("Cancel","modal-close","outline")}${btn("Confirm demo resolution","admin-decide","lime")}</div></div></div>`;
 }
 return "";
}
function render(){
 if(root.hidden)return;
 const content=state.page==="Wallet"?renderWallet():state.page==="Escrow"?renderEscrow():state.page==="Deposit"?renderDeposit():state.page==="Withdraw"?renderWithdraw():state.page==="NewEscrow"?renderNewEscrow():state.page==="EscrowHistory"?renderActivityHistory():state.page==="Hustler"?renderHustler():state.page==="Booking"?renderBooking():state.page==="AgentIntro"?renderAgentIntro():state.page==="Agent"?renderAgent():state.page==="Talent"?renderTalent():state.page==="AdminGate"?renderAdminGate():state.page==="Admin"?renderAdmin():renderWallet();
 root.innerHTML=content+renderModal();root.scrollTop=0;
}
function toast(msg){const t=root.querySelector(".ho-toast");if(t)t.remove();const tip=document.createElement("div");tip.className="ho-toast";tip.textContent=msg;root.appendChild(tip);if(typeof setTimeout==="function")setTimeout(()=>{tip.remove?.()},3000)}
function addTransaction(title,detail,amount,type,kind){store.history.unshift({title,detail,amount,type,kind})}
function submitFunding(form){
 const f=new FormData(form),n=Number(f.get("amount")),method=String(f.get("method")||"Card");
 if(!Number.isSafeInteger(n)||n<100||n>1000000){toast("Enter a demo amount between ₦100 and ₦1,000,000");return}
 store.wallet+=n;addTransaction("Demo wallet funding",method+" · "+dateNow(),n,"credit","Funding");audit("Demo funding",money(n)+" · "+method);
 state.page="Wallet";state.walletTab="Overview";render();toast("Simulated funding added · No real payment");
}
function submitWithdraw(form){
 const f=new FormData(form),n=Number(f.get("amount"));
 if(!Number.isSafeInteger(n)||n<100||n>store.earnings){toast("Amount exceeds eligible demo earnings");return}
 store.earnings-=n;store.pending+=n;addTransaction("Sample payout requested","No bank transfer sent · "+dateNow(),n,"debit","Payout");audit("Simulated payout request",money(n));
 state.page="Wallet";state.walletTab="Activity";render();toast("Demo payout marked pending · No transfer initiated");
}
function submitEscrow(form){
 const f=new FormData(form),amount=Number(f.get("amount")),service=String(f.get("service")||"Service");
 if(!Number.isSafeInteger(amount)||amount<1000||amount>250000){toast("Enter a valid demo escrow amount");return}
 if(amount>store.wallet){toast("Not enough simulated funds. Add demo money first.");return}
 const creator=service.includes("haircut")?"Tobi Adeyemi":service.includes("outfit")?"Zara Okafor":"Flora Studio";
 const part=Math.round(amount*.4),e={id:"HES-"+String(Date.now()).slice(-6),client:"You",creator,service,value:amount,created:dateNow(),status:"Held",milestones:[{id:1,title:"Planning & consultation",amount:part,status:"Held"},{id:2,title:"Agreed completion",amount:amount-part,status:"Held"}],log:["Demo escrow funded"]};
 store.wallet-=amount;store.escrow.unshift(e);addTransaction("Demo escrow created",e.id+" · "+service,amount,"debit","Escrow");audit("Escrow created",e.id);state.escrowId=e.id;state.page="Escrow";render();toast("Escrow created in demo only");
}
function processDecision(){
 if(state.adminInspect){state.confirmAction=null;render();return}
 const a=state.confirmAction;if(!a)return;const e=escrow(a.escrow);
 if(a.type==="release"&&e?.status==="Held"){const m=e.milestones.find(m=>m.id===a.mid&&m.status==="Held");if(!m){state.confirmAction=null;render();return}m.status="Released";e.log.unshift(`Milestone ${m.id} released (demo)`);if(held(e)===0)e.status="Completed";addTransaction("Demo escrow release",e.id+" · "+m.title,m.amount,"debit","Escrow");audit("Client released milestone",e.id+" · "+money(m.amount))}
 if(a.type==="dispute"&&e?.status==="Held"){e.status="Disputed";e.log.unshift("Client raised dispute (demo)");audit("Dispute raised",e.id)}
 state.confirmAction=null;render();toast("Demo escrow status updated; no funds moved");
}
function adminResolution(){
 if(!state.adminPreview){toast("Internal demo access required");return}
 const {action,id}=state.formDraft,e=escrow(id);
 if(!e||e.status!=="Disputed"){state.modal="";render();return}
 if(action==="admin-refund"){const value=held(e);store.wallet+=value;for(const m of e.milestones)if(m.status==="Held")m.status="Refunded";e.status="Refunded";addTransaction("Demo escrow refund",e.id+" · admin sandbox",value,"credit","Escrow");audit("Admin sandbox refunded",e.id+" · "+money(value))}
 if(action==="admin-release"){for(const m of e.milestones)if(m.status==="Held")m.status="Released";e.status="Completed";audit("Admin sandbox released escrow",e.id)}
 e.log.unshift("Simulated admin resolution · no real money moved");state.modal="";render();toast("Demo case resolved and audited");
}
function handle(op,id,value,node){
 switch(op){
  case "close":close();break;
  case "back":back();break;
  case "Wallet":case "Hustler":nav(op);break;
  case "Agent":nav(state.agentPreview?"Agent":"AgentIntro");break;
  case "Admin":state.adminPreview=false;nav("AdminGate");break;
  case "wallet-tab":state.walletTab=value;render();break;
  case "studio-tab":state.hustlerTab=value;render();break;
  case "agent-tab":state.agentTab=value;render();break;
  case "admin-tab":if(state.adminPreview){state.adminTab=value;render()}break;
  case "activity-tab":state.activityTab=value;render();break;
  case "escrow":state.adminInspect=state.page==="Admin";state.escrowId=id;nav("Escrow");break;
  case "deposit":state.fundingMethod="Card";nav("Deposit");break;
  case "deposit-bank":state.fundingMethod="Bank transfer";nav("Deposit");break;
  case "withdraw":nav("Withdraw");break;
  case "newEscrow":nav("NewEscrow");break;
  case "escrowHelp":state.modal="escrowHelp";render();break;
  case "escrowHistory":state.escrowId=id;nav("EscrowHistory");break;
  case "set-amount":{const el=root.querySelector("#hoAmount");if(el)el.value=id;break}
  case "confirm-release":if(!state.adminInspect){state.confirmAction={type:"release",escrow:id,mid:Number(node.dataset.mid)};render()}break;
  case "dispute":if(!state.adminInspect){state.confirmAction={type:"dispute",escrow:id};render()}break;
  case "disputeInfo":state.modal="disputeInfo";render();break;
  case "cancel-decision":state.confirmAction=null;render();break;
  case "decide":processDecision();break;
  case "modal-close":state.modal="";render();break;
  case "availability":state.hustlerAvailable=!state.hustlerAvailable;audit("Availability toggled",state.hustlerAvailable?"Accepting enquiries":"Paused");render();break;
  case "booking":state.formDraft.booking=id;nav("Booking");break;
  case "booking-progress":{const b=store.bookings.find(x=>x.id===state.formDraft.booking);if(b){b.state="Awaiting customer approval";audit("Sample quote stage updated",b.id);render();toast("Demo booking updated")};break}
  case "create-service":{close();window.HustleFlowsPreview?.open("Create",{draftType:"Service"});break}
  case "agent-apply":state.agentApplied=true;state.agentPreview=false;audit("Sample agent application","Awaiting approval · simulated");state.page="AgentIntro";render();toast("Application submitted in demo · Still awaiting review");break;
  case "agent-preview":state.agentPreview=true;state.page="Agent";render();break;
  case "agent-tab-target":state.agentTab=id;state.page="Agent";render();break;
  case "agent-invite":state.modal="invite";render();break;
  case "talent":state.formDraft.talent=id;nav("Talent");break;
  case "agent-verify":toast("Blocked: hustler must personally complete face verification in the real app");break;
  case "admin-enter":state.adminPreview=true;state.page="Admin";audit("Entered internal design sandbox","No production credentials");render();break;
  case "admin-tab-target":if(state.adminPreview){state.adminTab=id;state.page="Admin";render()}break;
  case "moderate-approve":case "moderate-flag":if(state.adminPreview){const m=store.moderation.find(x=>x.id===id);if(m){m.state=op==="moderate-approve"?"Approved":"Flagged";audit("Admin sample content decision",id+" · "+m.state);render()}}break;
  case "admin-refund":case "admin-release":if(state.adminPreview){state.formDraft={action:op,id};state.modal="adminConfirm";render()}break;
  case "admin-decide":adminResolution();break;
 }
}
root.addEventListener("click",e=>{
 const node=e.target.closest("[data-op]");if(!node||!root.contains(node))return;
 if(node.closest("form")&&node.type==="submit")return;
 e.preventDefault();handle(node.dataset.op,node.dataset.id,node.dataset.value,node);
});
root.addEventListener("submit",e=>{
 const form=e.target;const type=form.dataset.hoForm;if(!type)return;
 e.preventDefault();
 if(type==="deposit")submitFunding(form);
 if(type==="withdraw")submitWithdraw(form);
 if(type==="escrow")submitEscrow(form);
 if(type==="invite"){const f=new FormData(form),name=String(f.get("name")||"").trim(),skill=String(f.get("skill")||"").trim();if(!name||!skill)return;store.talent.push({id:"AG-"+Date.now().toString().slice(-5),name,skill,city:"Not set",status:"Pending invite",earnings:0,avatar:"✳"});state.modal="";state.agentTab="Talent";render();toast("Demo invitation created · Not sent");}
});
window.HustleOperations={open,close,getState:()=>({screen:state.page,wallet:store.wallet,earnings:store.earnings,escrows:store.escrow.map(x=>({id:x.id,status:x.status,held:held(x)})),agentPreview:state.agentPreview,adminPreview:state.adminPreview}),_testing:{store,state,handle,render}};
})();
