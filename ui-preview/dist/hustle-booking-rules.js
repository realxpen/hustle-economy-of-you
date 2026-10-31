(function hustleBookingRules(){
"use strict";
const templates={
 barber:{id:"barber",label:"Barber / grooming",icon:"💈",consultation:"optional",consultFee:1000,creditConsultation:true,capacity:4,duration:60,travelFee:2500,eventFee:5000,approval:"manual",basePrice:5000,locationModes:["At the shop","Home service","Event / group"],fields:[["style","Hairstyle / cut","Describe the haircut or style you want"],["notes","Extra details (optional)","e.g. beard trim, children, preferred barber"]],groupQuote:true},
 tailor:{id:"tailor",label:"Tailor / fashion",icon:"🧵",consultation:"optional",consultFee:2000,creditConsultation:true,capacity:1,duration:90,travelFee:3000,eventFee:5000,approval:"manual",basePrice:18000,locationModes:["At the studio","Home measurement","Event / group"],fields:[["style","Outfit or alteration","What would you like made or adjusted?"],["measurements","Measurements / fitting details","Share sizes or say 'Need measurement session'"],["deadline","Needed by","e.g. 15 November"]],groupQuote:true},
 shoemaker:{id:"shoemaker",label:"Shoemaker / repairs",icon:"👞",consultation:"off",consultFee:0,creditConsultation:false,capacity:3,duration:60,approval:"manual",basePrice:6000,locationModes:["Drop off","Pickup / delivery","Custom order"],fields:[["style","Repair or new shoe","e.g. replace sole, handmade loafers"],["size","Shoe size / material","e.g. size 43 leather"],["deadline","Required by","e.g. next Friday"]],groupQuote:true},
 cook:{id:"cook",label:"Chef / catering",icon:"🍳",consultation:"optional",consultFee:0,creditConsultation:false,capacity:2,duration:120,travelFee:3000,eventFee:10000,approval:"manual",basePrice:12500,locationModes:["Pickup","Delivery","Cater an event"],fields:[["style","Meals or menu","What would you like prepared?"],["diet","Dietary needs","e.g. no peanuts, vegetarian"],["guests","Guests / portions","How many people are you feeding?"]],groupQuote:true},
 education:{id:"education",label:"Tutor / consultant",icon:"📚",consultation:"required",consultFee:3000,creditConsultation:false,capacity:1,duration:45,approval:"manual",basePrice:10000,locationModes:["Video call","Phone call","In person"],fields:[["style","What do you need help with?","e.g. school application or maths lesson"],["level","Student / situation","e.g. university admissions, SS3"]],groupQuote:false},
 home:{id:"home",label:"Home / technical service",icon:"🔧",consultation:"required",consultFee:1500,creditConsultation:true,capacity:2,duration:90,approval:"manual",basePrice:15000,locationModes:["At my location","Remote diagnosis","Site assessment"],fields:[["style","Problem / service needed","e.g. leaking tap, faulty socket"],["urgency","Urgency","e.g. today, this week"]],groupQuote:true},
 photo:{id:"photo",label:"Photographer / events",icon:"📷",consultation:"optional",consultFee:0,creditConsultation:false,capacity:1,duration:120,travelFee:5000,eventFee:7000,approval:"manual",basePrice:30000,locationModes:["Studio","At event / venue","Outdoor shoot"],fields:[["style","Shoot type","e.g. wedding, graduation, portraits"],["guests","People / event size","e.g. 30 guests"],["deadline","Event date","e.g. 14 November"]],groupQuote:true},
 generic:{id:"generic",label:"Other professional",icon:"✳",consultation:"optional",consultFee:0,creditConsultation:false,capacity:1,duration:60,approval:"manual",basePrice:8000,locationModes:["At provider","At my location","Remote"],fields:[["style","What do you need?","Describe the work and any references"]],groupQuote:true}
};
const samples=[{id:"barber",title:"Signature haircut",name:"Tobi Adeyemi"},{id:"tailor",title:"Custom wedding outfit",name:"Zara Okafor"},{id:"shoemaker",title:"Shoe repair or handmade pair",name:"The Shoe Studio"},{id:"cook",title:"Meal boxes and event catering",name:"Chef Amara"},{id:"education",title:"Educational consultation",name:"Education Adviser"},{id:"home",title:"Home repair visit",name:"Home Services Pro"},{id:"photo",title:"Event photography",name:"Photo Studio"}];
const overrides=new Map();const reservations=new Map();
const providerKey=(id,provider)=>[id,String(provider||"default")].join("|");
// Reservation keys are scoped by professional, not a global skill category.
const key=(id,day,time,provider="default")=>[provider,id,day,time].join("|");
const detect=title=>{const v=String(title||"").toLowerCase();if(/barber|haircut|groom|fade|beard/.test(v))return "barber";if(/tailor|outfit|fashion|sewing|alteration|dress/.test(v))return "tailor";if(/shoe|cobbl|footwear/.test(v))return "shoemaker";if(/chef|meal|food|cook|cater|bake/.test(v))return "cook";if(/education|tutor|school|lesson|consult|admission/.test(v))return "education";if(/photo|film|wedding shoot|video shoot/.test(v))return "photo";if(/repair|plumb|electri|home service|clean|technician/.test(v))return "home";return "generic"};
const get=(id,provider="default")=>{const v=templates[id]||templates.generic;return {...v,...(overrides.get(providerKey(v.id,"default"))||{}),...(overrides.get(providerKey(v.id,provider))||{}),fields:v.fields.map(x=>x.slice()),locationModes:v.locationModes.slice()}};
const getForService=(title,id,provider="default")=>get(id&&templates[id]?id:detect(title),provider);
function update(id,patch,provider="default"){if(!templates[id])return false;const policy=get(id,provider);const clean={};
 if(["off","optional","required"].includes(patch.consultation))clean.consultation=patch.consultation;
 if(patch.consultFee!==undefined){const n=Number(patch.consultFee);if(!Number.isSafeInteger(n)||n<0||n>100000)return false;clean.consultFee=n}
 if(typeof patch.creditConsultation==="boolean")clean.creditConsultation=patch.creditConsultation;
 if(patch.capacity!==undefined){const n=Number(patch.capacity);if(!Number.isSafeInteger(n)||n<1||n>50)return false;clean.capacity=n}
 if(patch.basePrice!==undefined){const n=Number(patch.basePrice);if(!Number.isSafeInteger(n)||n<0||n>2000000)return false;clean.basePrice=n}
 for(const k of ["travelFee","eventFee"]){if(patch[k]!==undefined){const n=Number(patch[k]);if(!Number.isSafeInteger(n)||n<0||n>250000)return false;clean[k]=n}}
 if(patch.duration!==undefined){const n=Number(patch.duration);if(!Number.isSafeInteger(n)||n<15||n>480)return false;clean.duration=n}
 if(["manual","auto"].includes(patch.approval))clean.approval=patch.approval;
 if(clean.consultation==="off"){clean.consultFee=0;clean.creditConsultation=false}
 const k=providerKey(id,provider);overrides.set(k,{...(overrides.get(k)||{}),...clean});return true}
function held(id,day,time,provider="default"){return reservations.get(key(id,day,time,provider))||0}
function left(id,day,time,provider="default"){const cap=get(id,provider).capacity;return Math.max(0,cap-held(id,day,time,provider))}
function reserve(id,day,time,units=1,provider="default"){if(!Number.isSafeInteger(units)||units<1||units>get(id,provider).capacity||left(id,day,time,provider)<units)return false;const k=key(id,day,time,provider);reservations.set(k,held(id,day,time,provider)+units);return true}
function release(id,day,time,units=1,provider="default"){const k=key(id,day,time,provider);reservations.set(k,Math.max(0,held(id,day,time,provider)-Math.max(0,units)))}
function slotAt(start,offset){
 const m=String(start).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return offset?null:start;
 const hour=(Number(m[1])%12)+(m[3].toUpperCase()==="PM"?12:0),minute=Number(m[2]);
 if(!Number.isInteger(minute)||minute<0||minute>59)return null;
 const format=n=>{const h=(n+24)%24;return (h%12||12)+":"+String(minute).padStart(2,"0")+" "+(h<12?"AM":"PM")};
 const h=hour+offset;return format(h)+" – "+format(h+1);
}
function reservePlan(id,day,time,people=1,provider="default"){
 const p=get(id,provider),count=Number(people);
 if(!Number.isSafeInteger(count)||count<1||count>50)return null;
 const slotsPerRound=Math.ceil(p.duration/60),rounds=Math.ceil(count/p.capacity);
 const allocations=new Map(),starting=slotAt(time,0);if(!starting)return null;
 for(let round=0;round<rounds;round++){
  const units=Math.min(p.capacity,count-round*p.capacity);
  for(let slot=0;slot<slotsPerRound;slot++){
   const name=slotAt(time,round*slotsPerRound+slot);if(!name)return null;
   allocations.set(name,(allocations.get(name)||0)+units);
  }
 }
 for(const [name,units] of allocations)if(left(id,day,name,provider)<units)return null;
 for(const [name,units] of allocations){const k=key(id,day,name,provider);reservations.set(k,held(id,day,name,provider)+units)}
 return {id,day,time,provider,people:count,minutes:rounds*slotsPerRound*60,allocations:[...allocations].map(([time,units])=>({time,units}))};
}
function releasePlan(plan){
 if(!plan||!Array.isArray(plan.allocations))return false;
 for(const a of plan.allocations)release(plan.id,plan.day,a.time,a.units,plan.provider);
 return true;
}
function quote({id="generic",provider="default",basePrice,people=1,venue="",consultPaid=0}={}){
 const p=get(id,provider),n=Math.max(1,Math.min(50,Number(people)||1));const unit=Number.isFinite(Number(basePrice))?Math.max(0,Math.round(Number(basePrice))):p.basePrice;
 const service=unit*n,travel=/home|at my location|pickup|delivery|at event|outdoor|site assessment/i.test(venue)?(p.travelFee||0):0;
 const event=/event|group|cater|wedding/i.test(venue)?(p.eventFee||0):0;
 const full=service+travel+event,credit=p.creditConsultation?Math.min(full,Math.max(0,Math.round(Number(consultPaid)||0))):0;
 return {unit,people:n,service,travel,event,total:full,credit,due:Math.max(0,full-credit),duration:Math.ceil(n/p.capacity)*p.duration};
}
const finalDue=(amount,paid,enabled)=>Math.max(0,Math.round(amount)-(enabled?Math.min(Math.round(amount),Math.max(0,Math.round(paid))):0));
window.HustleBookingRules={templates,samples,get,getForService,detect,update,held,left,reserve,release,reservePlan,releasePlan,quote,finalDue,_testing:{overrides,reservations}};
})();