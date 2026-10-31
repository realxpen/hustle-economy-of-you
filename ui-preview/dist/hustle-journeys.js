(function hustleJourneys(){
"use strict";
const phone=document.getElementById("phone");if(!phone)return;
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const money=n=>"₦"+Number(n||0).toLocaleString("en-NG");
const uid=p=>p+"-"+Date.now().toString(36).slice(-5);
const root=document.createElement("section");root.id="hustleJourneysLayer";root.className="hj-root";root.hidden=true;phone.appendChild(root);
const defaults=[
{id:"n1",type:"Booking",title:"Consultation request received",detail:"A sample barbering consultation is awaiting confirmation.",time:"Just now",read:false,route:"BookingJourney"},
{id:"n2",type:"Money",title:"Milestone held securely · demo",detail:"View your example escrow and release conditions.",time:"15 min",read:false,route:"Escrow"},
{id:"n3",type:"Activity",title:"New work from Flora Studio",detail:"See a sample creator post.",time:"1 hr",read:false,route:"Explore"},
{id:"n4",type:"Orders",title:"Sample order status updated",detail:"Your demo order is ready to review.",time:"Yesterday",read:true,route:"PaymentJourney"},
{id:"n5",type:"System",title:"Welcome to Hustle",detail:"Discover and connect with skilled people.",time:"Yesterday",read:true,route:"Explore"}];
const data={notifications:defaults,reports:[],agentInvites:[],onboarding:{name:"",handle:"",skill:"",secondary:"",area:"",intent:"both",notifications:false},auth:{method:"phone",contact:"",step:0},booking:{category:"barber",basePrice:8000,consultChoice:false,consultPaid:0,consultCredit:0,venue:"At the shop",people:1,fields:{},mediaName:"",slotReserved:false,customQuote:false,stage:"request",service:"Signature haircut",professional:"Tobi Adeyemi",price:8000,requirements:"",location:"",day:"Tomorrow",time:"11:30 AM",mode:"Video call",quoteAccepted:false,paymentConfirmed:false,escrowRef:null,milestones:[{title:"Consultation & planning",fraction:.4,state:"Held"},{title:"Service delivery",fraction:.6,state:"Held"}],dispute:false,review:0,notes:""},purchase:{item:"Weekend meal box",price:12500,delivery:"Yaba, Lagos",method:"Card",stage:"details",status:"Not placed",reference:""},prefs:{Booking:true,Orders:true,Money:true,Activity:true,System:true}};
const state={screen:"Splash",stack:[],guest:true,signedIn:false,user:null,authStep:"contact",otp:"",onboardStep:0,notificationFilter:"All",reportSubject:"Post",reportId:"Sample post",reportReason:"Misleading or fraudulent",reportText:"",reportFile:null,reportIdActive:null,agentStep:0,agentMode:"Existing",agentSearch:"",agentSelected:"",agentName:"",agentSkill:"",agentArea:"",agentLanguage:"English",agentHandoff:"In-person handover",agentConsent:false,agentTerms:false,agentInviteId:null,modal:"",info:""};
const steps={BookingJourney:["Request","Consultation","Quote","Payment","Work","Completion","Review"],PaymentJourney:["Details","Review","Payment","Result"],AgentAdd:["Choose","Details","Consent","Invite"]};
const visual={Booking:"◷",Money:"₦",Activity:"♥",Orders:"▣",System:"✦"};
function renderToast(msg){const old=root.querySelector(".hj-toast");if(old)old.remove();const t=document.createElement("div");t.className="hj-toast";t.setAttribute("role","status");t.textContent=msg;root.appendChild(t);setTimeout(()=>t.remove(),2200)}
function button(label,action,variant="primary",extra=""){return `<button type="button" class="hj-btn hj-${variant}" data-hj="${action}" ${extra}>${label}</button>`}
function heading(title,kicker,back=true){return `<header class="hj-heading"><div class="hj-heading-row">${back?`<button type="button" class="hj-back" data-hj="back" aria-label="Go back">←</button>`:""}<div><small>${esc(kicker||"HUSTLE · PREVIEW")}</small><h1>${title}</h1></div><button class="hj-close" data-hj="close" aria-label="Close journey">×</button></div></header>`}
function info(message){return `<div class="hj-info" role="note">${message}</div>`}
function progress(keys,index){return `<div class="hj-progress" aria-label="Step ${index+1} of ${keys.length}">${keys.map((v,i)=>`<span class="${i<=index?"on":""}" title="${esc(v)}"></span>`).join("")}</div><p class="hj-progress-label">Step ${index+1} of ${keys.length} · ${esc(keys[index])}</p>`}
function field(name,label,placeholder="",type="text",value="",extra=""){return `<div class="hj-field"><label for="hj-${name}">${esc(label)}</label>${type==="textarea"?`<textarea name="${name}" id="hj-${name}" placeholder="${esc(placeholder)}" rows="3" maxlength="500" ${extra}>${esc(value)}</textarea>`:`<input id="hj-${name}" name="${name}" placeholder="${esc(placeholder)}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`}
function formBody(type,body,submit,back=""){return `<form class="hj-form" data-hj-form="${type}">${body}<div class="hj-action-row">${back?button("← Back",back,"secondary"):""}<button class="hj-btn hj-primary" type="submit">${submit}</button></div></form>`}
const introKey="hustle_preview_intro_seen_v1";
function rememberIntro(){try{window.sessionStorage?.setItem(introKey,"1")}catch(e){}}
function introSeen(){try{return window.sessionStorage?.getItem(introKey)==="1"}catch(e){return false}}
function playSplash(){
 if(root.hidden||state.screen!=="Splash")return;
 setTimeout(()=>{if(!root.hidden&&state.screen==="Splash"){state.screen="Welcome";render()}},1150);
}
function screenContent(){
 switch(state.screen){
 case "Splash":return `<main class="hj-splash"><div class="hj-splash-orb"><span>✦</span></div><div class="hj-splash-word">hustle<span>.</span></div><p>Where skills meet opportunity.</p><span class="hj-splash-progress"></span><button data-hj="guest" class="hj-splash-skip">Skip intro</button></main>`;
 case "Welcome":return `<main class="hj-welcome"><div class="hj-welcome-art"><div class="hj-art-spot hj-art-1">✂</div><div class="hj-art-spot hj-art-2">♢</div><div class="hj-art-spot hj-art-3">🍳</div><span class="hj-welcome-star">✳</span></div>
 <div class="hj-welcome-copy"><span class="hj-eyebrow">WELCOME TO THE ECONOMY OF YOU</span><h1>Your skill.<br>Your people.<br><em>Your opportunity.</em></h1><p>Discover local talent, show your work, hire trusted skills and create your own path.</p>
 ${button("Get started →","auth-start")}${button("Explore as guest","guest","secondary")}
 <small>Browsing doesn't require an account. Sign in when you want to publish, book or manage payments.</small></div></main>`;
 case "Auth":return heading("Welcome back","SIGN IN OR CREATE ACCOUNT")+`<div class="hj-page"><div class="hj-auth-brand">hustle<span>.</span></div><h2>Continue with less hassle.</h2><p class="hj-lead">One account to discover, hire and offer skills. No need to choose between client and creator.</p>
 <div class="hj-segment"><button data-hj="auth-method" data-value="phone" class="${data.auth.method==="phone"?"on":""}">Phone</button><button data-hj="auth-method" data-value="email" class="${data.auth.method==="email"?"on":""}">Email</button></div>
 ${formBody("auth",field("contact",data.auth.method==="phone"?"Phone number":"Email address",data.auth.method==="phone"?"080…":"+you@example.com",data.auth.method==="phone"?"tel":"email",data.auth.contact,'required autocomplete="'+(data.auth.method==="phone"?"tel":"email")+'"'),"Continue →")}
 <div class="hj-auth-alternatives">${button("Continue as guest","guest","outline")}</div>
 ${info("Authentication is simulated: no SMS, email, Apple or Google account is contacted. Never enter a real password here.")}
 </div>`;
 case "Verify":return heading("Verify it's you","DEMO ONE-TIME CODE")+`<div class="hj-page"><div class="hj-otp-icon">✉</div><h2>Enter the 6-digit code</h2><p class="hj-lead">Sent to <strong>${esc(data.auth.contact)}</strong> in a real app. Nothing has been sent in this demo.</p>
 ${formBody("verify",field("otp","Verification code","123456","text","",'required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"'),"Verify & continue →")}
 <p class="hj-inline-hint">Demo code: <strong>123456</strong></p>${button("Change contact","auth-start","outline")}</div>`;
 case "Onboarding":return renderOnboarding();
 case "Notifications":return renderNotifications();
 case "NotificationSettings":return renderNotificationSettings();
 case "Report":return renderReport();
 case "ReportSent":return renderReportSent();
 case "Reports":return renderReports();
 case "BookingJourney":return renderBooking();
 case "PaymentJourney":return renderPayment();
 case "AgentAdd":return renderAgent();
 case "AgentInvite":return renderAgentInvite();
 case "AgentConsent":return renderAgentConsent();
 default:return `<div class="hj-page">Journey unavailable. ${button("Back","back")}</div>`;
 }
}
function renderOnboarding(){
 const i=state.onboardStep,o=data.onboarding;
 let body="";
 if(i===0){body=`<div class="hj-select-cards">${[["both","Discover and share skills","Hire people and offer your own skills","✳"],["hire","I'm here to hire","Find creators and skilled professionals","⌕"],["offer","I'm here to offer a skill","Build a profile and get discovered","✂"]].map(([v,title,subtitle,icon])=>`<button type="button" data-hj="intent" data-value="${v}" class="${o.intent===v?"selected":""}"><span>${icon}</span><div><b>${title}</b><small>${subtitle}</small></div><i>${o.intent===v?"✓":"○"}</i></button>`).join("")}</div>`}
 else if(i===1){body=field("name","What should people call you?","Your display name","text",o.name,'required maxlength="60" autocomplete="name"')+field("handle","Choose a username (optional)","yourhandle","text",o.handle,'maxlength="25"')}
 else if(i===2){body=field("skill","Primary skill or interest","e.g. Barbering, Fashion, Cooking","text",o.skill,'maxlength="60"')+field("area","Area (optional)","e.g. Yaba, Lagos","text",o.area,'maxlength="90"')+info("Skills and location can be changed later. Your precise location is never requested during onboarding.")}
 else{body=`<div class="hj-finish"><span>✦</span><h2>You're ready to explore.</h2><p>Follow inspiring creators, search nearby skills and begin your Hustle journey.</p></div>
 <label class="hj-check"><input name="updates" type="checkbox" ${o.notifications?"checked":""}> <span>Show me notifications about bookings and messages later (optional)</span></label>`}
 return heading("Make it yours","A FEW EASY STEPS")+`<div class="hj-page hj-onboard">${progress(["Goal","About you","Your interests","Ready"],i)}<h2>${["What brings you here?","Let's introduce you.","Find your community.","You're all set."][i]}</h2><p class="hj-lead">${["You can always do both. This just tunes the suggestions.","A name is enough to begin.","Optional now—personalize over time.","Everything can be changed in your profile."][i]}</p>
 ${formBody("onboard",body,i===3?"Enter Hustle →":"Continue →",i>0?"onboard-back":"")}${i<3?button("Skip for now","onboard-skip","link"):""}</div>`;
}
function renderNotifications(){
 const types=["All","Booking","Money","Orders","Activity","System"],all=data.notifications.filter(n=>state.notificationFilter==="All"||n.type===state.notificationFilter);
 const unread=data.notifications.filter(n=>!n.read).length;
 return heading("Notifications",`${unread} UNREAD · DEMO`)+`<div class="hj-page">
 <div class="hj-bar-actions">${button("Mark all read","mark-all","outline")}${button("Preferences ⚙","notification-settings","outline")}</div>
 <div class="hj-pills">${types.map(t=>`<button data-hj="notification-tab" data-value="${t}" class="${state.notificationFilter===t?"on":""}">${t}</button>`).join("")}</div>
 <div class="hj-notif-list">${all.map(n=>`<button class="hj-notification ${n.read?"":"unread"}" data-hj="notification-open" data-id="${n.id}"><span class="hj-notif-icon">${visual[n.type]||"✦"}</span><span><b>${esc(n.title)}</b><small>${esc(n.detail)}</small><em>${esc(n.time)}</em></span>${n.read?"":'<i aria-label="Unread"></i>'}</button>`).join("")||'<div class="hj-empty">No notifications in this category.</div>'}</div>
 ${info("Illustrative notifications only. No push messages, real users or device permissions are connected.")}</div>`;
}
function renderNotificationSettings(){
 return heading("Notification preferences","CONTROL WHAT YOU RECEIVE")+`<div class="hj-page"><p class="hj-lead">Choose which categories you would receive when real notifications are available.</p>
 ${Object.entries(data.prefs).map(([k,v])=>`<label class="hj-preference"><span><b>${k}</b><small>${({Booking:"Consultations and service updates",Orders:"Purchases and delivery",Money:"Escrow, releases and payouts",Activity:"Follows, comments and content",System:"Important account notices"})[k]}</small></span><input type="checkbox" data-hj-pref="${k}" ${v?"checked":""}></label>`).join("")}
 ${button("Done","back")}${info("These toggles only affect this demo session. Production push permissions will be requested at the moment you choose to enable them.")}</div>`;
}
function renderReport(){
 const reasons=["Misleading or fraudulent","Harassment or bullying","Unsafe or illegal activity","Spam or impersonation","Privacy violation","Other"];
 return heading("Report a concern","SAFETY & TRUST")+`<div class="hj-page">${progress(["What happened?","Details","Send"],state.reportText?1:0)}
 <div class="hj-report-context"><span>⚑</span><div><b>${esc(state.reportSubject)}</b><small>${esc(state.reportId)}</small></div></div>
 ${formBody("report",`<div class="hj-field"><label for="hj-reason">What's the issue?</label><select id="hj-reason" name="reason">${reasons.map(v=>`<option ${v===state.reportReason?"selected":""}>${esc(v)}</option>`).join("")}</select></div>
 ${field("reportDetails","Tell us more (optional)","Describe the issue without sharing passwords or private account details.","textarea",state.reportText)}
 <div class="hj-field"><label for="hj-reportFile">Add screenshot (optional)</label><input type="file" id="hj-reportFile" accept="image/*"><small>Local preview only; files are not uploaded.</small></div>`,
 "Review & submit →")}
 <div class="hj-report-safety">${button("Block this creator (demo)","report-block","outline")}${button("View my reports","reports","outline")}</div>
 ${info("Reports involving payment disputes should also use the Escrow dispute flow so protected payments remain on hold.")}</div>`;
}
function renderReportSent(){
 const r=data.reports.find(x=>x.id===state.reportIdActive);
 return heading("Report received","DEMO CASE STATUS")+`<div class="hj-page"><div class="hj-success-icon">✓</div><h2>Thank you for flagging this.</h2><p class="hj-lead">Your sample report was added to this session. No actual moderation team was notified.</p>
 <div class="hj-status-card"><span>Reference</span><b>${esc(r?.id||"Sample")}</b><span>Status</span><b>${esc(r?.status||"Submitted · Awaiting review")}</b><span>Reason</span><b>${esc(r?.reason||"Other")}</b></div>
 ${button("Track my reports","reports")}${button("Return to Hustle","close","secondary")}</div>`;
}
function renderReports(){
 return heading("My reports","CASE HISTORY · DEMO")+`<div class="hj-page">${data.reports.length?data.reports.map(x=>`<article class="hj-history-row"><b>${esc(x.id)} · ${esc(x.subject)}</b><small>${esc(x.reason)}</small><span>● ${esc(x.status||"Submitted · Awaiting review")}</span></article>`).join(""):'<div class="hj-empty">You haven’t submitted any demo reports yet.</div>'}
 ${button("+ Report an issue","report-start","outline")}</div>`;
}
function bookingIndex(){return Math.max(0,steps.BookingJourney.indexOf(({request: "Request",consultation:"Consultation",quote:"Quote",payment:"Payment",work:"Work",completion:"Completion",review:"Review"})[data.booking.stage]||"Request"))}

function policyFor(){return window.HustleBookingRules?.getForService(data.booking.service,data.booking.category)||{id:"generic",label:"Other service",consultation:"optional",consultFee:0,creditConsultation:false,capacity:1,duration:60,approval:"manual",locationModes:["At provider","At my location"],fields:[["style","What do you need?","Describe the work"]],groupQuote:true}}
function payable(){const b=data.booking,p=policyFor();return Math.max(0,b.price-(b.consultPaid&&p.creditConsultation?Math.min(b.price,b.consultPaid):0))}
function renderBooking(){
 const b=data.booking,p=policyFor(),paid=Number(b.consultPaid||0),due=payable(),group=!!b.customQuote;
 const active=["request","consultation","consultPayment","awaiting","quote","payment","work","completion","review"];
 const visible=active.filter(x=>!["consultation","consultPayment"].includes(x)||b.consultChoice).filter(x=>x!=="consultPayment"||p.consultFee>0);
 const idx=Math.max(0,visible.indexOf(b.stage));
 const names={request:"Request",consultation:"Consult",consultPayment:"Consult fee",awaiting:"Approval",quote:"Quote",payment:"Payment",work:"Work",completion:"Done",review:"Review"};
 let body="";
 if(b.stage==="request"){
  const demoCases=window.HustleBookingRules?.samples||[];
  const venues=p.locationModes||[];
  body=`<div class="hj-service-header"><span class="hj-skill-icon">${esc(p.icon||"✳")}</span><div><small>${esc(p.label)} · tailored booking</small><h2>${esc(b.service)}</h2><p>${esc(b.professional)} · From ${money(b.basePrice)}</p></div></div>
  <details class="hj-skill-examples"><summary>Try another skill journey <span>▾</span></summary><div class="hj-chip-grid">${demoCases.map(x=>`<button type="button" data-hj="booking-example" data-value="${x.id}" class="${p.id===x.id?"on":""}">${esc(x.title)}</button>`).join("")}</div></details>
  <p class="hj-lead">Only answer what this service needs. Consultation is ${p.consultation==="off"?"not needed":p.consultation==="required"?"required":"optional"}.</p>
  ${formBody("booking-request",`
   <div class="hj-field"><label for="hj-venue">Service type</label><select id="hj-venue" name="venue">${venues.map(x=>`<option ${b.venue===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
   ${p.fields.map(([key,label,placeholder],i)=>field(key,label,placeholder,i===0?"textarea":"text",b.fields?.[key]||"",i===0?'required minlength="5"':"")).join("")}
   <div class="hj-field"><label for="hj-location">Where will this happen?</label><input name="location" id="hj-location" required value="${esc(b.location)}" placeholder="Area or address (detailed address later)"></div>
   <div class="hj-field"><label for="hj-day">Preferred day</label><select name="day" id="hj-day">${["Tomorrow","This weekend","Next week"].map(x=>`<option ${b.day===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
   <div class="hj-field"><label for="hj-time">Preferred time</label><select name="time" id="hj-time">${["1:00 PM – 2:00 PM","2:00 PM – 3:00 PM","5:00 PM – 6:00 PM"].map(x=>`<option ${b.time===x?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
   <div class="hj-field"><label for="hj-people">How many people? (1 for individual)</label><input type="number" id="hj-people" name="people" min="1" max="50" value="${b.people||1}"></div>
   <div class="hj-capacity-note"><b>${p.capacity} parallel appointment${p.capacity===1?"":"s"} per slot</b><span>Subject to professional approval · example capacity, not live availability.</span><small>Current example slots: ${["1:00 PM – 2:00 PM","2:00 PM – 3:00 PM"].map(t=>`${esc(t)}: ${window.HustleBookingRules?.left(p.id,b.day,t)??p.capacity} left`).join(" · ")}</small></div>
   <div class="hj-field"><label for="hj-bookingMedia">Reference photo or video (optional)</label><input type="file" id="hj-bookingMedia" accept="image/*,video/*"><small>${b.mediaName?`Selected: ${esc(b.mediaName)} · local only`:"Show the hairstyle, outfit, repair or example you want. Local demo only."}</small></div>
   <fieldset class="hj-consult-options"><legend>Consultation</legend>
   ${p.consultation!=="required"?`<label><input type="radio" name="consultChoice" value="direct" ${!b.consultChoice?"checked":""}><span><b>Book without consultation</b><small>Send details now for professional approval</small></span></label>`:""}
   ${p.consultation!=="off"?`<label><input type="radio" name="consultChoice" value="consult" ${b.consultChoice?"checked":""}><span><b>${p.consultFee?`Consult first · ${money(p.consultFee)}`:"Free consultation"}</b><small>${p.consultFee&&p.creditConsultation?"Fee is credited if you later book this service":p.consultFee?"Separate paid consultation, not credited":"Discuss requirements before booking"}</small></span></label>`:""}
   </fieldset>
  `,"Continue →")}`;
 }
 if(b.stage==="consultation")body=`<h2>Choose how to consult</h2><p class="hj-lead">The professional can offer free or paid consultations. The fee and credit terms are shown before payment.</p>
 ${formBody("booking-consult",`<div class="hj-field"><label>Consultation channel</label><select name="mode">${["Video call","Voice call","In person"].map(x=>`<option ${b.mode===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="hj-status-card"><span>Consultation</span><b>${p.consultFee?money(p.consultFee):"Free"}</b><span>Credit towards service</span><b>${p.consultFee&&p.creditConsultation?"Yes, if you book":"No additional credit"}</b></div>` ,p.consultFee?"Review consultation fee →":"Request free consultation →")}`;
 if(b.stage==="consultPayment")body=`<h2>Consultation payment</h2><p class="hj-lead">This is a separate ${money(p.consultFee)} consultation charge.</p><div class="hj-status-card"><span>Consultation fee</span><b>${money(p.consultFee)}</b><span>Applied to later service</span><b>${p.creditConsultation?"Yes, automatically":"No — separately charged"}</b><span>Appointment</span><b>${esc(b.day)}, ${esc(b.time)}</b></div>${renderPaymentChoices(p.consultFee)}
 ${button("Simulate consultation payment →","booking-consult-pay")}${info("No real payment or booking occurs. Cancellation/refund terms must be shown by the professional before a real consultation.")}`;
 if(b.stage==="awaiting")body=`<div class="hj-success-icon">◷</div><h2>Request awaiting professional approval</h2><p class="hj-lead">The professional can accept, propose another time, request details or decline. Your chosen slot isn't confirmed yet.</p><div class="hj-status-card"><span>Service</span><b>${esc(b.service)}</b><span>Time requested</span><b>${esc(b.day)}, ${esc(b.time)}</b><span>Location</span><b>${esc(b.venue)}</b><span>Group</span><b>${b.people} person${b.people===1?"":"s"}</b><span>Consultation paid (demo)</span><b>${money(paid)}</b></div>
 ${info(group?"Group, event and home-service requests need a separate confirmed quote. Availability and travel costs must be reviewed.":`Example remaining single-person spaces for this slot: ${window.HustleBookingRules?.left(p.id,b.day,b.time)??p.capacity}. No time is reserved until approval.`)}
 ${button("Simulate professional acceptance →","booking-provider-accept")}${button("Propose another time","booking-reschedule","secondary")}${button("Cancel request","booking-cancel","secondary")}`;
 if(b.stage==="quote")body=`<h2>${group?"Review your custom event quote":"Review service price"}</h2><div class="hj-quote"><small>${group?"CUSTOM QUOTE EXAMPLE":"SERVICE PRICE EXAMPLE"} · PROFESSIONAL APPROVAL SIMULATED</small><strong>${money(b.price)}</strong><p>${esc(b.service)} · ${esc(b.professional)}</p></div><div class="hj-status-card"><span>Scope</span><b>${esc(b.fields?.style||b.requirements)}</b><span>Mode</span><b>${esc(b.venue)}</b><span>People</span><b>${b.people}</b><span>Service price</span><b>${money(b.price)}</b><span>Consultation already paid</span><b>${money(paid)}</b><span>Consultation credit</span><b>−${money(b.consultCredit||0)}</b><span>Remaining for service</span><b>${money(due)}</b></div>
 ${info("Custom prices, travel fees and timing are subject to the professional's confirmation. No payment has been charged.")}
 ${button("Accept example quote →","booking-accept")}${button("Request a revised quote","booking-revise","secondary")}${button("Cancel","booking-cancel","secondary")}`;
 if(b.stage==="payment")body=`<h2>Pay for your booking</h2><p class="hj-lead">The consultation fee is separated from the service payment, with any promised credit deducted once.</p><div class="hj-status-card"><span>Service price</span><b>${money(b.price)}</b><span>Consultation previously paid</span><b>${money(paid)}</b><span>Service credit</span><b>−${money(b.consultCredit||0)}</b><span>Service payment now due</span><b>${money(due)}</b><span>Total paid across both stages</span><b>${money(paid+due)}</b></div>${renderPaymentChoices(due)}
 ${button("Simulate protected payment →","booking-pay")}${button("Back to quote","booking-back-quote","secondary")}${info("Only the remaining service payment is included in the new demo escrow. Consultation funds are not falsely represented as held again.")}`;
 if(b.stage==="work")body=`<h2>Work in progress</h2><p class="hj-lead">${esc(b.professional)} · ${esc(b.service)}. Confirm work as milestones are completed.</p>
 ${b.milestones.map((m,i)=>`<div class="hj-milestone"><span>${m.state==="Released"?"✓":"🔒"}</span><div><b>${esc(m.title)}</b><small>${money(Math.round(due*m.fraction))} · ${esc(m.state)}</small></div>${m.state==="Held"&&!b.dispute?button("Review release","booking-milestone","outline",`data-id="${i}"`):""}</div>`).join("")}
 ${b.dispute?info("Dispute raised. Remaining demo releases are paused until review."):button("Raise a dispute","booking-dispute","secondary")}
 ${b.milestones.every(x=>x.state==="Released")?button("Continue to completion →","booking-complete"):""}
 ${info("Milestones are local demo records. No provider holds or transfers money.")}`;
 if(b.stage==="completion")body=`<div class="hj-success-icon">✓</div><h2>Service marked completed</h2><p class="hj-lead">The agreed demonstration milestones have been marked released.</p>${button("Leave a review →","booking-review")}${button("View example escrow","open-escrow","secondary")}`;
 if(b.stage==="review")body=`<h2>How was the service?</h2><div class="hj-rating">${[1,2,3,4,5].map(x=>`<button data-hj="rating" data-value="${x}" aria-label="${x} stars" class="${x<=b.review?"on":""}">★</button>`).join("")}</div>${field("reviewText","Comments (optional)","What went well?","textarea",b.notes)}${button("Finish demo journey","booking-finish")}`;
 if(b.stage==="cancelled")body=`<h2>Booking request cancelled</h2><p class="hj-lead">Any reserved demo appointment capacity was restored. Paid consultations and actual refunds must follow clearly disclosed provider terms.</p>${button("Back to explore","close")}`;
 return heading("Book a service","BOOKING ADAPTS TO THE PROFESSIONAL")+`<div class="hj-page">${progress(visible.map(x=>names[x]),idx)}${body}</div>${renderModal()}`;
}
function renderPaymentChoices(amount){
 return `<div class="hj-payment-choice">${[["Card","💳","Pay by card"],["Bank transfer","🏦","Pay by bank transfer"],["Wallet","₦","Use available wallet funds (demo only)"]].map(([v,ico,sub])=>`<button data-hj="payment-method" data-value="${v}" class="${data.purchase.method===v?"on":""}"><span>${ico}</span><div><b>${v}</b><small>${sub}</small></div><strong>${data.purchase.method===v?"✓":"○"}</strong></button>`).join("")}</div>
 <div class="hj-status-card"><span>Amount</span><b>${money(amount)}</b><span>Protection</span><b>Provider-managed escrow concept</b></div>
 ${info("No funds are charged, held, deposited or transferred. Wallet prefunding would remain optional in production.")}`;
}
function renderPayment(){
 const p=data.purchase,i=steps.PaymentJourney.indexOf(p.stage==="details"?"Details":p.stage==="review"?"Review":p.stage==="payment"?"Payment":"Result");
 let body="";
 if(p.stage==="details")body=`<h2>Confirm your delivery details</h2><p class="hj-lead">${esc(p.item)} · Example order only</p>
 ${formBody("order-details",field("delivery","Delivery area","e.g. Yaba, Lagos","text",p.delivery,'required'),"Review order →")}`;
 if(p.stage==="review")body=`<h2>Review before paying</h2><div class="hj-quote"><small>PRODUCT ORDER · DEMO</small><strong>${money(p.price)}</strong><p>${esc(p.item)}</p></div>
 <div class="hj-status-card"><span>Delivery</span><b>${esc(p.delivery)}</b><span>Order status</span><b>Not placed</b></div>
 ${button("Choose payment method →","order-choose")}${button("Edit delivery","order-edit","secondary")}`;
 if(p.stage==="payment")body=`<h2>How would you like to pay?</h2>${renderPaymentChoices(p.price)}${button("Simulate payment →","order-pay")}${button("Back to review","order-edit","secondary")}`;
 if(p.stage==="result")body=`<div class="hj-success-icon">✓</div><h2>Order preview complete</h2><p class="hj-lead">No purchase or transfer occurred, and no merchant was notified.</p><div class="hj-status-card"><span>Demo order reference</span><b>${esc(p.reference)}</b><span>Status</span><b>${esc(p.status)}</b><span>Method</span><b>${esc(p.method)}</b></div>
 ${button("View notifications","notifications")}${button("Browse Marketplace","market","secondary")}`;
 return heading("Checkout journey","PRODUCT COMMERCE · DEMO")+`<div class="hj-page">${progress(steps.PaymentJourney,i)}${body}</div>${renderModal()}`;
}
function renderAgent(){
 const i=state.agentStep,mode=state.agentMode;
 let content="";
 if(i===0)content=`<h2>Who are you onboarding?</h2><p class="hj-lead">Hustle supports existing users and people who need an assisted introduction.</p><div class="hj-select-cards">
 <button data-hj="agent-mode" data-value="Existing" class="${mode==="Existing"?"selected":""}"><span>⌕</span><div><b>Existing Hustle user</b><small>Find their profile and invite them to grant you access.</small></div><i>${mode==="Existing"?"✓":"○"}</i></button>
 <button data-hj="agent-mode" data-value="New" class="${mode==="New"?"selected":""}"><span>♙</span><div><b>New / not tech-savvy professional</b><small>Guide them through a simple introduction, with consent.</small></div><i>${mode==="New"?"✓":"○"}</i></button></div>
 ${button("Continue →","agent-next")}`;
 if(i===1)content=mode==="Existing"?`<h2>Find a professional</h2><p class="hj-lead">Search a demo name, skill or username. Contact details aren't exposed.</p>
 <div class="hj-field"><label for="hj-agentSearch">Search Hustle</label><input id="hj-agentSearch" value="${esc(state.agentSearch)}" placeholder="e.g. Tobi, Zara, Flora"></div>
 <div id="hjAgentResults">${agentSearchResults()}</div>${button("Continue →","agent-next")}`:
 `<h2>Start with the basics</h2><p class="hj-lead">An agent may assist in person, but the professional must control their identity and eventual account.</p>
 ${formBody("agent-details",field("agentName","Professional's name","e.g. Ade Bello","text",state.agentName,'required maxlength="60"')+field("agentSkill","Primary skill","e.g. Bricklaying","text",state.agentSkill,'required maxlength="60"')+field("agentArea","Work area (optional)","e.g. Ikeja, Lagos","text",state.agentArea,'maxlength="100"')+`<div class="hj-field"><label for="hj-agentLanguage">Explain in their preferred language</label><select id="hj-agentLanguage" name="language">${["English","Yoruba","Pidgin","Igbo","Hausa","Other"].map(v=>`<option ${state.agentLanguage===v?"selected":""}>${v}</option>`).join("")}</select></div><div class="hj-field"><label for="hj-agentHandoff">How will they receive the explanation?</label><select id="hj-agentHandoff" name="handoff">${["In-person handover","Voice-assisted handover","Printed instruction card"].map(v=>`<option ${state.agentHandoff===v?"selected":""}>${v}</option>`).join("")}</select></div>`,"Continue →")}`;
 if(i===2)content=`<h2>Permission comes first.</h2><div class="hj-consent-card"><span>🔐</span><b>${mode==="Existing"?"Request access—don't take over":"Help them onboard—don't create a secret account"}</b><p>${mode==="Existing"?"The user receives an invitation and chooses exactly which agent permissions to grant.":"Explain Hustle in their preferred language, show the information being entered, and let them personally accept the invitation and activate their login later."}</p></div>
 <label class="hj-check"><input type="checkbox" id="hjAgentConsent" ${state.agentConsent?"checked":""}><span>I have explained the invitation to the professional and they agreed to receive it (demo).</span></label>
 <label class="hj-check"><input type="checkbox" id="hjAgentTerms" ${state.agentTerms?"checked":""}><span>I understand that I cannot impersonate them, capture their OTP, control their wallet or withdraw on their behalf.</span></label>
 ${button("Review invitation →","agent-next")}`;
 if(i===3)content=`<h2>Review the invitation</h2><div class="hj-status-card"><span>Professional</span><b>${esc(mode==="Existing"?state.agentSelected:state.agentName)}</b><span>Skill</span><b>${esc(mode==="Existing"?"Profile-based invitation":state.agentSkill)}</b>${mode==="New"?`<span>Explanation</span><b>${esc(state.agentLanguage)} · ${esc(state.agentHandoff)}</b>`:""}<span>Access</span><b>Bookings and permitted listings only</b><span>Financial access</span><b>No withdrawals or escrow releases</b></div>
 ${info("No SMS or invitation is sent. Approval and identity verification are simulated and controlled by the professional.")}
 ${button("Create demo invitation →","agent-submit")}${button("Go back","agent-back","secondary")}`;
 return heading("Add a hustler","AGENT-ASSISTED ONBOARDING")+`<div class="hj-page">${progress(steps.AgentAdd,i)}${content}</div>`;
}
function agentSearchResults(){
 const arr=[["Tobi Adeyemi","@tobithebarber · Barbering"],["Zara Okafor","@zara.design · Fashion"],["Flora Studio","@florastudio · Floristry"]];
 const q=state.agentSearch.toLowerCase().trim();
 return arr.filter(x=>x.join(" ").toLowerCase().includes(q)).map(x=>`<button class="hj-search-result ${state.agentSelected===x[0]?"on":""}" data-hj="agent-select" data-value="${esc(x[0])}"><span>✳</span><div><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div><strong>${state.agentSelected===x[0]?"✓":"＋"}</strong></button>`).join("")||'<p class="hj-empty">No demo profile found. Try another name.</p>';
}
function renderAgentInvite(){
 const inv=data.agentInvites.find(x=>x.id===state.agentInviteId);
 return heading("Invitation created","AWAITING PROFESSIONAL CONSENT")+`<div class="hj-page"><div class="hj-success-icon">✓</div><h2>Invitation prepared.</h2>
 <div class="hj-status-card"><span>Reference</span><b>${esc(inv?.id)}</b><span>Professional</span><b>${esc(inv?.name)}</b><span>Status</span><b>${esc(inv?.status)}</b></div>
 <h3>What happens next?</h3><div class="hj-roadmap">${["Share an invitation link, QR or code through a trusted channel (disabled in demo)","Hustler reviews the role, permissions and service terms themselves","Hustler verifies their identity/phone through a provider-managed login","Hustler explicitly accepts or declines agency access"].map((x,i)=>`<p><span>${i+1}</span>${esc(x)}</p>`).join("")}</div>
 ${inv?.status==="Pending acceptance"?button("Show professional confirmation →","agent-handoff"):""}${button("Done","close","secondary")}
 ${info("Even when accepted, an agent cannot access this person's funds or complete their identity checks.")}</div>`;
}
function renderAgentConsent(){
 const invite=data.agentInvites.find(x=>x.id===state.agentInviteId);
 return heading("Professional confirmation","THE HUSTLER DECIDES")+ `<div class="hj-page">
 <div class="hj-consent-card"><span>🔐</span><b>For the professional: ${esc(invite?.name||"Hustler")}</b><p>This separate screen illustrates what the professional must personally review. The agent must not enter their OTP, sign in for them, or approve access on their behalf.</p></div>
 <div class="hj-status-card"><span>Agent request</span><b>Manage permitted bookings & listings</b><span>Can access bank balance?</span><b>No</b><span>Can withdraw earnings?</span><b>No</b><span>Can release client escrow?</span><b>No</b><span>Current status</span><b>${esc(invite?.status||"Pending")}</b></div>
 <label class="hj-check"><input id="hjHustlerAgree" type="checkbox"><span>I am the professional and I understand what this sample agent invitation allows. In the real app, I would verify my own identity before accepting.</span></label>
 ${button("Accept this demo invitation","agent-accept")}${button("Decline invitation","agent-decline","secondary")}
 ${info("A real acceptance requires an authenticated action by the professional, not the agent. No account access or private data is granted here.")}</div>`;
}
function renderModal(){
 if(!state.modal)return "";
 if(state.modal==="release"){const b=data.booking,m=b.milestones[Number(state.info)];return `<div class="hj-modal-scrim"><div class="hj-modal"><span>🔒</span><h2>Release this milestone?</h2><p>Confirm that ${esc(m.title)} is complete. Amount: ${money(Math.round(b.price*m.fraction))}. This is a local demonstration only.</p><div class="hj-action-row">${button("Cancel","modal-close","secondary")}${button("Confirm demo release","release-confirm")}</div></div></div>`}
 if(state.modal==="dispute")return `<div class="hj-modal-scrim"><div class="hj-modal"><span>⚑</span><h2>Open a dispute?</h2><p>This pauses remaining demo milestone releases. In production, evidence and an independent resolution process would be required.</p><div class="hj-action-row">${button("Cancel","modal-close","secondary")}${button("Raise demo dispute","dispute-confirm")}</div></div></div>`;
 if(state.modal==="report-confirm")return `<div class="hj-modal-scrim"><div class="hj-modal"><span>⚑</span><h2>Submit report?</h2><p>Preview report reason: ${esc(state.reportReason)}. No real moderator is contacted.</p><div class="hj-action-row">${button("Edit report","modal-close","secondary")}${button("Submit demo report","report-confirm")}</div></div></div>`;
 return "";
}
function render(){
 if(root.hidden)return;
 root.innerHTML=screenContent()+((state.screen==="Report")?renderModal():"");
 root.scrollTop=0;
 const active=root.querySelector(".hj-page");
 if(active){active.classList.remove("hj-arrive");void active.offsetWidth;active.classList.add("hj-arrive")}
}
function open(screen="Welcome",opts={}){
 if(screen==="Splash")state.guest=true;
 if(screen==="Report"){state.reportSubject=opts.subject||"Content";state.reportId=opts.id||"Sample content";state.reportText="";state.reportReason="Misleading or fraudulent"}
 if(screen==="BookingJourney"){const service=opts.service||data.booking.service,pol=window.HustleBookingRules?.getForService(service,opts.category);const price=Number(opts.price)||pol?.basePrice||8000;data.booking={...data.booking,category:pol?.id||"generic",service,professional:opts.professional||data.booking.professional,basePrice:price,price,stage:"request",fields:{},requirements:"",venue:pol?.locationModes?.[0]||"At provider",people:1,day:"Tomorrow",time:"1:00 PM – 2:00 PM",consultChoice:pol?.consultation==="required",consultPaid:0,consultCredit:0,customQuote:false,mediaName:"",slotReserved:false,quoteAccepted:false,paymentConfirmed:false,escrowRef:null,dispute:false,review:0,milestones:[{title:"Planning & preparation",fraction:.4,state:"Held"},{title:"Work completion",fraction:.6,state:"Held"}]}}
 if(screen==="PaymentJourney"&&opts.item){data.purchase={...data.purchase,item:opts.item,price:Number(opts.price)||data.purchase.price,method:opts.method||data.purchase.method,delivery:opts.delivery||data.purchase.delivery,stage:"details",status:"Not placed"}}
 if(screen==="AgentAdd"){state.agentStep=0;state.agentMode="Existing";state.agentSelected="";state.agentConsent=false;state.agentTerms=false;state.agentLanguage="English";state.agentHandoff="In-person handover"}
 state.stack=[];state.screen=screen;state.modal="";root.hidden=false;phone.classList.add("hj-open");render();if(screen==="Splash")playSplash();
}
function go(screen){state.stack.push(state.screen);state.screen=screen;state.modal="";render()}
function back(){if(state.modal){state.modal="";render();return}if(state.stack.length){state.screen=state.stack.pop();render()}else close()}
function close(){root.hidden=true;root.innerHTML="";phone.classList.remove("hj-open");state.stack=[];state.modal=""}
function addNotice(type,title,detail,route){data.notifications.unshift({id:uid("n"),type,title,detail,time:"Now",read:false,route})}
function onAction(action,value="",id=""){
 switch(action){
 case "close":close();break;case "back":back();break;
 case "guest":state.guest=true;state.signedIn=false;data.auth.contact="";rememberIntro();close();break;
 case "auth-start":data.auth.contact="";data.auth.method="phone";go("Auth");break;
 case "auth-method":data.auth.method=value;render();break;
 case "onboard-back":state.onboardStep=Math.max(0,state.onboardStep-1);render();break;
 case "onboard-skip":state.onboardStep=Math.min(3,state.onboardStep+1);render();break;
 case "intent":data.onboarding.intent=value;render();break;
 case "notification-tab":state.notificationFilter=value;render();break;
 case "notification-settings":go("NotificationSettings");break;
 case "notifications":go("Notifications");break;
 case "mark-all":data.notifications.forEach(n=>n.read=true);render();break;
 case "notification-open":{const n=data.notifications.find(n=>n.id===id);if(!n)return;n.read=true;render();if(n.route==="Escrow"){close();if(data.booking.escrowRef)window.HustleOperations?.openEscrow?.(data.booking.escrowRef);else window.HustleOperations?.open("Wallet")}else if(n.route==="BookingJourney")open("BookingJourney");else if(n.route==="PaymentJourney")open("PaymentJourney");else if(n.route==="Explore"){close();window.HustleFlowsPreview?.open("Explore")}break}
 case "report-start":go("Report");break;case "reports":go("Reports");break;
 case "report-block":renderToast("Demo block applied for this session");break;
 case "modal-close":state.modal="";render();break;
 case "report-confirm":{const r={id:uid("HREP"),subject:state.reportSubject,reference:state.reportId,reason:state.reportReason,details:state.reportText,status:"Submitted"};data.reports.unshift(r);window.HustleOperations?.addDemoReport?.(r);state.reportIdActive=r.id;state.modal="";addNotice("System","Report submitted · demo",r.id,"Explore");go("ReportSent");break}
 case "booking-accept":data.booking.quoteAccepted=true;data.booking.stage="payment";render();break;
 case "booking-revise":data.booking.stage="quote";renderToast("Quote returned to review");render();break;
 case "payment-method":data.purchase.method=value;render();break;
 case "booking-pay":{if(!data.booking.paymentConfirmed){data.booking.escrowRef=window.HustleOperations?.addJourneyEscrow?.({service:data.booking.service,professional:data.booking.professional,amount:data.booking.price})||null}
 data.booking.paymentConfirmed=true;data.booking.stage="work";addNotice("Money","Protected payment preview created · demo",data.booking.service,"Escrow");render();break}
 case "booking-milestone":if(!data.booking.dispute){state.info=id;state.modal="release";render()}else renderToast("Milestone frozen during dispute");break;
 case "release-confirm":{const m=data.booking.milestones[Number(state.info)];if(m&&m.state==="Held"&&!data.booking.dispute){m.state="Released";if(data.booking.escrowRef)window.HustleOperations?.updateJourneyEscrow?.(data.booking.escrowRef,"release",Number(state.info));addNotice("Money","Milestone released · demo",m.title,"Escrow")}state.modal="";render();break}
 case "booking-dispute":state.modal="dispute";render();break;
 case "dispute-confirm":data.booking.dispute=true;if(data.booking.escrowRef)window.HustleOperations?.updateJourneyEscrow?.(data.booking.escrowRef,"dispute");state.modal="";addNotice("Money","Demo dispute submitted","Remaining milestones are frozen","Escrow");renderToast("Demo dispute marked; releases paused");render();break;
 case "booking-complete":if(data.booking.milestones.every(m=>m.state==="Released")&&!data.booking.dispute){data.booking.stage="completion";addNotice("Booking","Service completed · demo",data.booking.service,"BookingJourney");render()}break;
 case "booking-review":data.booking.stage="review";render();break;
 case "booking-finish":data.booking.notes=root.querySelector("#hj-reviewText")?.value||"";addNotice("Activity","Review drafted · demo",data.booking.service,"Explore");close();break;
 case "rating":data.booking.review=Number(value);render();break;
 case "open-escrow":close();if(data.booking.escrowRef)window.HustleOperations?.openEscrow?.(data.booking.escrowRef);else window.HustleOperations?.open("Wallet");break;
 case "order-choose":data.purchase.stage="payment";render();break;
 case "order-edit":data.purchase.stage="details";render();break;
 case "order-pay":data.purchase.stage="result";data.purchase.status="Payment simulated · not placed";data.purchase.reference=uid("HORD");addNotice("Orders","Order preview complete · no charge",data.purchase.item,"PaymentJourney");render();break;
 case "market":close();window.HustleFlowsPreview?.open("Marketplace");break;
 case "agent-mode":state.agentMode=value;state.agentSelected="";render();break;
 case "agent-select":state.agentSelected=value;render();break;
 case "agent-next":{if(state.agentStep===1&&state.agentMode==="Existing"&&!state.agentSelected){renderToast("Select a professional first");break}
 if(state.agentStep===2){state.agentConsent=!!root.querySelector("#hjAgentConsent")?.checked;state.agentTerms=!!root.querySelector("#hjAgentTerms")?.checked;if(!state.agentConsent||!state.agentTerms){renderToast("Both permission confirmations are required");break}}
 state.agentStep=Math.min(3,state.agentStep+1);render();break}
 case "agent-back":state.agentStep=Math.max(0,state.agentStep-1);render();break;
 case "agent-submit":{const name=state.agentMode==="Existing"?state.agentSelected:state.agentName;if(!name||!state.agentConsent||!state.agentTerms){renderToast("Complete permissions first");return}const invite={id:uid("HAG"),name,skill:state.agentSkill||"Existing profile",mode:state.agentMode,language:state.agentLanguage,handoff:state.agentHandoff,status:"Pending acceptance"};data.agentInvites.unshift(invite);state.agentInviteId=invite.id;if(window.HustleOperations?.addDemoTalent)window.HustleOperations.addDemoTalent({name,skill:invite.skill,status:"Pending invite"});addNotice("System","Agent invite created · demo",name,"Explore");go("AgentInvite");break}
 case "agent-handoff":if(data.agentInvites.find(x=>x.id===state.agentInviteId)?.status==="Pending acceptance")go("AgentConsent");break;
 case "agent-accept":{
  if(state.screen!=="AgentConsent"||!root.querySelector("#hjHustlerAgree")?.checked){renderToast("The professional must review and confirm consent first");break}
  const invite=data.agentInvites.find(x=>x.id===state.agentInviteId);
  if(invite?.status!=="Pending acceptance"){renderToast("Invitation is no longer pending");break}
  invite.status="Accepted · demo only";window.HustleOperations?.acceptDemoTalent?.(invite.name);
  addNotice("System","Example hustler accepted invitation",invite.name,"Explore");
  state.screen="AgentInvite";render();break
 }
 case "agent-decline":{
  if(state.screen!=="AgentConsent"){renderToast("Open the professional confirmation first");break}
  const invite=data.agentInvites.find(x=>x.id===state.agentInviteId);
  if(invite?.status!=="Pending acceptance")break;
  invite.status="Declined · demo only";window.HustleOperations?.declineDemoTalent?.(invite.name);
  addNotice("System","Hustler declined agent invitation",invite.name,"Explore");
  state.screen="AgentInvite";render();break
 }
 }
}
function onSubmit(name,form){
 const f=new FormData(form),get=k=>String(f.get(k)||"").trim();
 if(name==="auth"){const v=get("contact");if(data.auth.method==="phone"?!/^[+0-9 ()-]{7,18}$/.test(v):!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){renderToast("Enter a valid "+data.auth.method);return}data.auth.contact=v;go("Verify");return}
 if(name==="verify"){
  if(get("otp")!=="123456"){renderToast("For this demo, use 123456");return}
  if(state.user){state.signedIn=true;state.guest=false;addNotice("System","Welcome back to your demo profile",state.user.name||"Creator","Explore");close();return}
  state.onboardStep=0;go("Onboarding");return
 }
 if(name==="onboard"){const i=state.onboardStep;
 if(i===1){data.onboarding.name=get("name");data.onboarding.handle=get("handle");if(!data.onboarding.name){renderToast("A display name is needed");return}}
 if(i===2){data.onboarding.skill=get("skill");data.onboarding.area=get("area")}
 if(i===3){data.onboarding.notifications=!!form.querySelector('input[name="updates"]')?.checked;state.signedIn=true;state.guest=false;state.user={...data.onboarding};window.HustleFlowsPreview?.updateDemoUser?.(state.user);addNotice("System","Your demo profile is ready",data.onboarding.name,"Explore");rememberIntro();close();return}
 state.onboardStep++;render();return}
 if(name==="report"){state.reportReason=get("reason");state.reportText=get("reportDetails");state.modal="report-confirm";render();return}
 if(name==="booking-request"){data.booking.requirements=get("requirements");data.booking.location=get("location");if(data.booking.requirements.length<10||!data.booking.location){renderToast("Add at least 10 characters and a work area");return}data.booking.stage="consultation";render();return}
 if(name==="booking-consult"){data.booking.mode=get("mode");data.booking.day=get("day");data.booking.time=get("time");data.booking.stage="quote";render();return}
 if(name==="order-details"){data.purchase.delivery=get("delivery");if(!data.purchase.delivery){renderToast("Add a delivery area");return}data.purchase.stage="review";render();return}
 if(name==="agent-details"){state.agentName=get("agentName");state.agentSkill=get("agentSkill");state.agentArea=get("agentArea");state.agentLanguage=get("language")||"English";state.agentHandoff=get("handoff")||"In-person handover";if(!state.agentName||!state.agentSkill){renderToast("Name and skill are required");return}state.agentStep=2;render()}
}
root.addEventListener("click",e=>{const target=e.target.closest("[data-hj]");if(!target||!root.contains(target))return;if(target.type==="submit")return;e.preventDefault();onAction(target.dataset.hj,target.dataset.value,target.dataset.id)});
root.addEventListener("submit",e=>{const f=e.target;if(!f.dataset.hjForm)return;e.preventDefault();onSubmit(f.dataset.hjForm,f)});
root.addEventListener("input",e=>{if(e.target.id==="hj-agentSearch"){state.agentSearch=e.target.value;const results=root.querySelector("#hjAgentResults");if(results)results.innerHTML=agentSearchResults()}});
root.addEventListener("change",e=>{if(e.target.dataset.hjPref){data.prefs[e.target.dataset.hjPref]=e.target.checked;renderToast("Saved in this demo session")};if(e.target.id==="hj-reportFile"){const file=e.target.files?.[0];if(file&&file.type.startsWith("image/")&&file.size<=10*1024*1024){state.reportFile=file.name;renderToast("Local screenshot selected · not uploaded")}else if(file)renderToast("Choose an image smaller than 10 MB")}});
function updateReportStatus(id,status){
 const report=data.reports.find(x=>x.id===id);if(!report)return false;
 report.status=status;addNotice("System","Report review updated · demo",id+" · "+status,"Explore");
 if(!root.hidden&&(state.screen==="Reports"||state.screen==="ReportSent"))render();
 return true;
}
window.HustleJourneys={open,close,notify:addNotice,updateReportStatus,getState:()=>({screen:state.screen,guest:state.guest,signedIn:state.signedIn,user:state.user,booking:{stage:data.booking.stage,milestones:data.booking.milestones.map(x=>x.state),dispute:data.booking.dispute},payment:{stage:data.purchase.stage,status:data.purchase.status},reports:data.reports.map(x=>({id:x.id,status:x.status})),agentInvites:data.agentInvites.map(x=>({name:x.name,status:x.status})),notifications:data.notifications.map(x=>({id:x.id,read:x.read}))}),_test:{data,state,onAction,onSubmit,render}};
if(!introSeen())open("Splash");
})();
