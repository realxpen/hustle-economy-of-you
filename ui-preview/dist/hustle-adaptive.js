(function hustleAdaptiveCore(){
"use strict";
/* UI-only domain model. No persistence, authentication, payments or production writes. */
const CAPABILITIES=[
 {id:"hire",label:"Hire professionals",icon:"⌕"},
 {id:"offer",label:"Offer services",icon:"✂"},
 {id:"sell",label:"Sell products",icon:"▣"},
 {id:"create",label:"Publish creative work",icon:"✦"},
 {id:"teach",label:"Teach or mentor",icon:"◇"},
 {id:"manage",label:"Manage a business",icon:"▥"},
 {id:"represent",label:"Represent with consent",icon:"♙"}
];
const BLUEPRINTS=[
 {id:"appointment",label:"Appointment",icon:"◷",description:"Scheduled individual services",steps:["Request","Availability","Approval","Service","Confirmation"],features:["calendar","staff","location","reference","consultation"],example:"Barber, makeup artist"},
 {id:"item",label:"Item-based job",icon:"▤",description:"Collect, work on and return items",steps:["Intake","Quote","Handover","In progress","Ready","Return","Approval"],features:["intake","measurements","turnaround","delivery","evidence"],example:"Laundry, tailor, shoemaker"},
 {id:"project",label:"Project",icon:"▥",description:"Scoped work with milestones",steps:["Brief","Proposal","Agreement","Milestones","Delivery","Approval"],features:["brief","files","milestones","revisions","contract"],example:"Renovation, software, interiors"},
 {id:"group",label:"Shared session",icon:"◎",description:"One session for multiple participants",steps:["Enroll","Schedule","Attendance","Session","Follow-up"],features:["seats","calendar","attendance","learning"],example:"Tutors and workshops"},
 {id:"event",label:"Event",icon:"✧",description:"Staff, venue and logistics",steps:["Requirements","Availability","Quote","Preparation","Event","Approval"],features:["venue","resources","team","logistics","milestones"],example:"Weddings, catering, photography"},
 {id:"product",label:"Product",icon:"▣",description:"Inventory and fulfilment",steps:["Select","Checkout","Stock allocation","Dispatch","Delivery","Return window"],features:["variants","inventory","cart","shipping","returns"],example:"Crafts, clothing and goods"},
 {id:"digital",label:"Digital deliverable",icon:"⌘",description:"Remote commissions and files",steps:["Brief","Proposal","Create","Review","Revisions","Acceptance"],features:["brief","files","revisions","deadline"],example:"Design, editing, consulting"},
 {id:"recurring",label:"Recurring service",icon:"↻",description:"Repeat jobs and renewals",steps:["Plan","Schedule","Recurring work","Review","Renew"],features:["cadence","subscription","staff","reminders"],example:"Cleaning, maintenance"},
 {id:"live",label:"Live experience",icon:"●",description:"Interactive paid or free sessions",steps:["Publish","Registration","Access","Live","Replay"],features:["stream","admission","chat","replay"],example:"Live selling and classes"}
];
const PERMISSIONS=[
 {id:"services.manage",label:"Edit listings and services"},
 {id:"work.manage",label:"Manage assigned work"},
 {id:"messages.reply",label:"Reply to customer messages"},
 {id:"schedule.manage",label:"Schedule staff and appointments"},
 {id:"finance.view",label:"View financial summaries"}
];
const PRIVATE_ACTIONS=["payout.change","wallet.withdraw","escrow.release","identity.approve","delegate.grant"];
let sequence=100;
const key=p=>"HA-"+p+"-"+(++sequence);
const date=()=>new Date().toISOString().slice(0,10);
const copy=obj=>JSON.parse(JSON.stringify(obj));
const state={
 person:{id:"self",displayName:"Your Hustle identity",capabilities:["hire","offer","create","manage"],verified:false},
 spaces:[
  {id:"personal",name:"Personal",type:"personal",ownerId:"self",status:"active",category:"Independent",location:"Lagos",description:"Personal work and creative identity"},
  {id:"salon",name:"Royal Cuts Studio",type:"business",ownerId:"self",status:"demo",category:"Grooming",location:"Lagos",description:"Team-based appointment business"},
  {id:"garment",name:"FreshFold Atelier",type:"business",ownerId:"self",status:"demo",category:"Laundry and tailoring",location:"Lagos",description:"Item-based services and production"}
 ],
 currentSpace:"personal",
 memberships:[
  {id:"M-self-personal",spaceId:"personal",personId:"self",role:"owner",permissions:["*"],state:"active"},
  {id:"M-self-salon",spaceId:"salon",personId:"self",role:"owner",permissions:["*"],state:"active"},
  {id:"M-self-garment",spaceId:"garment",personId:"self",role:"owner",permissions:["*"],state:"active"}
 ],
 grants:[],
 services:[
  {id:"S-demo-barber",spaceId:"salon",title:"Signature haircut",blueprint:"appointment",category:"barber",price:5000,customizations:["Staff scheduling","Optional consultation"],state:"draft"},
  {id:"S-demo-laundry",spaceId:"garment",title:"Laundry, pickup & return",blueprint:"item",category:"laundry",price:2500,customizations:["Home pickup","Ready-by date","Delivery"],state:"draft"},
  {id:"S-demo-creator",spaceId:"personal",title:"Video commission",blueprint:"digital",category:"creative",price:15000,customizations:["Client brief","Revision rounds"],state:"draft"}
 ],
 orders:[
  {id:"W-demo-1",spaceId:"salon",serviceId:"S-demo-barber",blueprint:"appointment",title:"Haircut for an event",client:"Example customer",provider:"Royal Cuts Studio",state:"awaiting",date:date(),amount:5000,source:"social post",version:1,steps:[{state:"requested",at:date(),by:"customer"}],assignedTo:null,description:"Example request awaiting approval",evidence:[],paymentStatus:"not_collected",agreementVersion:1},
  {id:"W-demo-2",spaceId:"garment",serviceId:"S-demo-laundry",blueprint:"item",title:"Laundry collection, 6 garments",client:"Example customer",provider:"FreshFold Atelier",state:"in_progress",date:date(),amount:9500,source:"service listing",version:1,steps:[{state:"requested",at:date(),by:"customer"},{state:"accepted",at:date(),by:"business"},{state:"in_progress",at:date(),by:"business"}],assignedTo:null,description:"Pickup selected · estimated turnaround, demo only",evidence:[],paymentStatus:"not_collected",agreementVersion:1}
 ],
 opportunities:[
  {id:"O-demo-1",spaceId:"personal",title:"Wedding preparation services",category:"event",description:"Outfit, grooming, photography and catering needed",location:"Lagos",budget:0,status:"draft",created:date(),services:["Tailoring","Barbering","Photography","Catering"],source:"client intent"}
 ],
 evidence:[
  {id:"E-demo-1",spaceId:"personal",orderId:null,title:"Portfolio sample",description:"Self-uploaded examples are not verified customer work",level:"self_reported",created:date()}
 ],
 audit:[],
};
const allowedTransitions={
 awaiting:["accepted","declined","cancelled"],accepted:["in_progress","cancelled"],in_progress:["ready","review","disputed"],ready:["delivered","review","disputed"],delivered:["review","disputed"],review:["completed","disputed"],disputed:["review","cancelled"],completed:[],declined:[],cancelled:[]
};
function log(action,subject,meta){state.audit.unshift({id:key("audit"),at:new Date().toISOString(),actor:"self",action,subject,meta:meta||""})}
function currentSpace(){return state.spaces.find(s=>s.id===state.currentSpace)}
function membership(spaceId,personId="self"){return state.memberships.find(m=>m.spaceId===spaceId&&m.personId===personId&&m.state==="active")}
function can(permission,spaceId=state.currentSpace,personId="self"){
 const m=membership(spaceId,personId);if(!m)return false;
 if(PRIVATE_ACTIONS.includes(permission))return m.role==="owner"&&personId==="self";
 return m.role==="owner"||m.permissions.includes("*")||m.permissions.includes(permission);
}
function switchSpace(id){if(!state.spaces.some(s=>s.id===id)||!can("services.manage",id))return false;state.currentSpace=id;log("space.switch",id);return true}
function createSpace(name,type="business",category="Services"){
 const n=String(name||"").trim();if(n.length<3||n.length>70||!["business","personal","team"].includes(type))return null;
 if(state.spaces.some(s=>s.name.toLowerCase()===n.toLowerCase()))return null;
 const id=key("space"),space={id,name:n,type,category:String(category||"Services").slice(0,80),status:"draft",ownerId:"self",location:"Lagos",description:"New demo workspace"};
 state.spaces.push(space);state.memberships.push({id:key("member"),spaceId:id,personId:"self",role:"owner",permissions:["*"],state:"active"});log("space.create",id);return copy(space)
}
function addCapability(id){if(!CAPABILITIES.some(x=>x.id===id))return false;if(!state.person.capabilities.includes(id)){state.person.capabilities.push(id);log("capability.add",id)}return true}
function makeService(title,blueprint,price=0,spaceId=state.currentSpace){
 const n=String(title||"").trim(),p=Number(price);
 if(n.length<3||n.length>110||!BLUEPRINTS.some(b=>b.id===blueprint)||!Number.isFinite(p)||p<0||p>100000000||!can("services.manage",spaceId))return null;
 const x={id:key("service"),spaceId,title:n,blueprint,category:blueprint,price:p,customizations:[],state:"draft",created:date()};
 state.services.unshift(x);log("service.draft",x.id,blueprint);return copy(x)
}
function serviceById(id){return state.services.find(s=>s.id===id)}
function newWork(title,blueprint,description="",spaceId=state.currentSpace,source="request",serviceId=null){
 const n=String(title||"").trim();
 if(n.length<3||n.length>120||String(description).length>1200||!BLUEPRINTS.some(b=>b.id===blueprint)||!can("work.manage",spaceId))return null;
 const x={id:key("work"),spaceId,serviceId,blueprint,title:n,client:"Example customer",provider:state.spaces.find(s=>s.id===spaceId)?.name||"Personal",state:"awaiting",date:date(),source,version:1,agreementVersion:1,amount:serviceById(serviceId)?.price||0,paymentStatus:"not_collected",description:String(description),steps:[{state:"requested",at:date(),by:"customer"}],assignedTo:null,evidence:[]};
 state.orders.unshift(x);log("work.request",x.id);return copy(x)
}
function advanceWork(id,to,expectedVersion){
 const x=state.orders.find(w=>w.id===id);if(!x||x.externalRef||!can("work.manage",x.spaceId)||!allowedTransitions[x.state]?.includes(to)||expectedVersion!==x.version)return false;
 x.state=to;x.version++;x.steps.push({state:to,at:new Date().toISOString(),by:"demo professional"});
 log("work.transition",id,to);window.HustleJourneys?.notify?.("Orders","Work status updated · demo",x.title+" · "+to.replaceAll("_"," ")+" (no real message sent)","AdaptiveHub");return true
}
function createOpportunity(title,description,category,location="",budget=0){
 const t=String(title||"").trim(),d=String(description||"").trim(),b=Number(budget);
 if(t.length<5||t.length>130||d.length<12||d.length>1400||!BLUEPRINTS.some(x=>x.id===category)||!Number.isFinite(b)||b<0||b>100000000)return null;
 const opportunity={id:key("opportunity"),spaceId:state.currentSpace,title:t,description:d,category,location:String(location||"").slice(0,100),budget:b,services:inferServices(t+" "+d),status:"draft",created:date(),source:"client need"};
 state.opportunities.unshift(opportunity);log("opportunity.draft",opportunity.id);return copy(opportunity)
}
function inferServices(input){
 const text=String(input||"").toLowerCase(),terms=[
 ["barber","Barbering"],["hair","Hair and beauty"],["wedding","Event services"],["photograph","Photography"],["photo","Photography"],["cater","Catering"],["makeup","Makeup"],["decorate","Event decoration"],["food","Food preparation"],["cloth","Tailoring"],["outfit","Tailoring"],["shoe","Shoemaking"],["laundry","Laundry"],["clean","Cleaning"],["design","Design"],["video","Video production"],["tutor","Tutoring"],["lesson","Education"]];
 const found=[...new Set(terms.filter(([term])=>text.includes(term)).map(x=>x[1]))];return found.length?found:["General professional services"];
}
function suggestOpportunity(id){
 const o=state.opportunities.find(x=>x.id===id);if(!o)return [];
 const picks=state.services.filter(x=>x.blueprint===o.category||o.services.some(s=>x.title.toLowerCase().includes(s.toLowerCase())));
 return picks.map(x=>({serviceId:x.id,spaceId:x.spaceId,title:x.title,provider:state.spaces.find(s=>s.id===x.spaceId)?.name||"Demo provider",reason:"Matches example service type or inferred needs"}));
}
function requestDelegation(spaceId,name,permissions){
 const n=String(name||"").trim();
 if(!can("delegate.grant",spaceId)||n.length<3||n.length>80||!Array.isArray(permissions)||!permissions.length||!permissions.every(p=>PERMISSIONS.some(x=>x.id===p)))return null;
 const grant={id:key("grant"),spaceId,displayName:n,permissions:[...new Set(permissions)],state:"pending_consent",created:date(),consentedAt:null,revokedAt:null};
 state.grants.unshift(grant);log("delegation.request",grant.id);return copy(grant)
}
function consentDelegation(id){
 const grant=state.grants.find(g=>g.id===id);if(!grant||grant.state!=="pending_consent"||!can("delegate.grant",grant.spaceId))return false;
 // Demo confirmation only; not a real third-party identity verification or consent.
 grant.state="demo_approved";grant.consentedAt=new Date().toISOString();log("delegation.simulated_consent",id);return true
}
function revokeDelegation(id){
 const grant=state.grants.find(g=>g.id===id);if(!grant||!["pending_consent","demo_approved"].includes(grant.state)||!can("delegate.grant",grant.spaceId))return false;
 grant.state="revoked";grant.revokedAt=new Date().toISOString();log("delegation.revoke",id);return true
}
function assignWork(workId,grantId){
 const work=state.orders.find(x=>x.id===workId),grant=state.grants.find(x=>x.id===grantId);
 if(!work||work.externalRef||!grant||grant.spaceId!==work.spaceId||grant.state!=="demo_approved"||!grant.permissions.includes("work.manage")||!can("work.manage",work.spaceId))return false;
 work.assignedTo=grant.id;work.version++;log("work.assign",work.id,grant.id);return true
}
function attachEvidence(workId,title,description=""){
 const work=state.orders.find(x=>x.id===workId);
 if(!work||work.state!=="completed"||!can("work.manage",work.spaceId)||String(title).trim().length<3)return null;
 const e={id:key("evidence"),spaceId:work.spaceId,orderId:work.id,title:String(title).trim().slice(0,120),description:String(description).slice(0,500),level:"completion_claim",created:date()};
 state.evidence.unshift(e);work.evidence.push(e.id);log("evidence.attach",e.id);return copy(e)
}

function mirrorBooking(snapshot){
 if(!snapshot||!snapshot.reference||!snapshot.service||snapshot.stage==="request")return null;
 const map={awaiting:"awaiting",consultation:"awaiting",consultPayment:"accepted",quote:"accepted",payment:"accepted",work:"in_progress",completion:"review",review:"completed",declined:"declined",cancelled:"cancelled"};
 let mapped=map[snapshot.stage]||"awaiting";
 if(snapshot.stage==="work"){
  if(snapshot.jobStatus==="ready")mapped="ready";
  else if(snapshot.jobStatus==="out_for_delivery")mapped="ready";
  else if(snapshot.jobStatus==="completed")mapped="delivered";
 }
 const id=String(snapshot.reference).slice(0,100);
 let w=state.orders.find(x=>x.externalRef===id);
 if(!w){
  w={id:key("work"),spaceId:"personal",serviceId:null,blueprint:snapshot.jobFulfillment?"item":"appointment",title:String(snapshot.service).slice(0,120),client:"You · demo customer",provider:String(snapshot.professional||"Example professional"),state:mapped,date:String(snapshot.day||date()),amount:Math.max(0,Number(snapshot.price)||0),source:"existing booking preview",externalRef:id,externalSource:"HustleJourneys",version:1,agreementVersion:1,steps:[{state:mapped,at:new Date().toISOString(),by:"booking preview"}],assignedTo:null,description:"Linked booking · "+String(snapshot.requirements||"No request details"),evidence:[],paymentStatus:snapshot.paymentConfirmed?"simulated_paid":"not_collected",metadata:{jobStatus:snapshot.jobStatus||"",readyDate:snapshot.readyDate||""}};
  state.orders.unshift(w);log("work.link_existing_booking",w.id)
 }else{
  if(w.state!==mapped){w.state=mapped;w.version++;w.steps.push({state:mapped,at:new Date().toISOString(),by:"booking preview"});}
  w.amount=Math.max(0,Number(snapshot.price)||0);
  w.paymentStatus=snapshot.paymentConfirmed?"simulated_paid":"not_collected";
  w.metadata={jobStatus:snapshot.jobStatus||"",readyDate:snapshot.readyDate||""};
 }
 return copy(w)
}
function capabilityGuidance(){
 const tags=state.person.capabilities;return [...(tags.includes("hire")?["Explore skilled people and publish a request"]:[]),...(tags.includes("offer")?["Create services with a suitable work blueprint"]:[]),...(tags.includes("manage")?["Separate business teams and work records"]:[]),...(tags.includes("create")?["Connect useful posts to services and products"]:[]),...(tags.includes("represent")?["Request scoped delegation before acting for another person"]:[])];
}
window.HustleAdaptive={
 capabilities:CAPABILITIES,blueprints:BLUEPRINTS,permissions:PERMISSIONS,privateActions:PRIVATE_ACTIONS,
 getState:()=>copy(state),currentSpace:()=>copy(currentSpace()),can, switchSpace,createSpace,addCapability,makeService,newWork,advanceWork,createOpportunity,suggestOpportunity,requestDelegation,consentDelegation,revokeDelegation,assignWork,attachEvidence,capabilityGuidance,
 getBlueprint:id=>BLUEPRINTS.find(x=>x.id===id),getService:serviceById,mirrorBooking,
 _test:{state,allowedTransitions}
};
})();