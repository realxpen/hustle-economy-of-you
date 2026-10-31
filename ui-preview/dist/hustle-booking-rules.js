(function hustleBookingRules(){
"use strict";
const templates={
 barber:{id:"barber",label:"Barber / grooming",icon:"💈",consultation:"optional",consultFee:1000,creditConsultation:true,capacity:4,duration:60,approval:"manual",basePrice:5000,locationModes:["At the shop","Home service","Event / group"],fields:[["style","Hairstyle / cut","Describe the haircut or style you want"],["notes","Extra details (optional)","e.g. beard trim, children, preferred barber"]],groupQuote:true},
 tailor:{id:"tailor",label:"Tailor / fashion",icon:"🧵",consultation:"optional",consultFee:2000,creditConsultation:true,capacity:1,duration:90,approval:"manual",basePrice:18000,locationModes:["At the studio","Home measurement","Event / group"],fields:[["style","Outfit or alteration","What would you like made or adjusted?"],["measurements","Measurements / fitting details","Share sizes or say 'Need measurement session'"],["deadline","Needed by","e.g. 15 November"]],groupQuote:true},
 shoemaker:{id:"shoemaker",label:"Shoemaker / repairs",icon:"👞",consultation:"off",consultFee:0,creditConsultation:false,capacity:3,duration:60,approval:"manual",basePrice:6000,locationModes:["Drop off","Pickup / delivery","Custom order"],fields:[["style","Repair or new shoe","e.g. replace sole, handmade loafers"],["size","Shoe size / material","e.g. size 43 leather"],["deadline","Required by","e.g. next Friday"]],groupQuote:true},
 cook:{id:"cook",label:"Chef / catering",icon:"🍳",consultation:"optional",consultFee:0,creditConsultation:false,capacity:2,duration:120,approval:"manual",basePrice:12500,locationModes:["Pickup","Delivery","Cater an event"],fields:[["style","Meals or menu","What would you like prepared?"],["diet","Dietary needs","e.g. no peanuts, vegetarian"],["guests","Guests / portions","How many people are you feeding?"]],groupQuote:true},
 education:{id:"education",label:"Tutor / consultant",icon:"📚",consultation:"required",consultFee:3000,creditConsultation:false,capacity:1,duration:45,approval:"manual",basePrice:10000,locationModes:["Video call","Phone call","In person"],fields:[["style","What do you need help with?","e.g. school application or maths lesson"],["level","Student / situation","e.g. university admissions, SS3"]],groupQuote:false},
 home:{id:"home",label:"Home / technical service",icon:"🔧",consultation:"required",consultFee:1500,creditConsultation:true,capacity:2,duration:90,approval:"manual",basePrice:15000,locationModes:["At my location","Remote diagnosis","Site assessment"],fields:[["style","Problem / service needed","e.g. leaking tap, faulty socket"],["urgency","Urgency","e.g. today, this week"]],groupQuote:true},
 photo:{id:"photo",label:"Photographer / events",icon:"📷",consultation:"optional",consultFee:0,creditConsultation:false,capacity:1,duration:120,approval:"manual",basePrice:30000,locationModes:["Studio","At event / venue","Outdoor shoot"],fields:[["style","Shoot type","e.g. wedding, graduation, portraits"],["guests","People / event size","e.g. 30 guests"],["deadline","Event date","e.g. 14 November"]],groupQuote:true},
 generic:{id:"generic",label:"Other professional",icon:"✳",consultation:"optional",consultFee:0,creditConsultation:false,capacity:1,duration:60,approval:"manual",basePrice:8000,locationModes:["At provider","At my location","Remote"],fields:[["style","What do you need?","Describe the work and any references"]],groupQuote:true}
};
const samples=[{id:"barber",title:"Signature haircut",name:"Tobi Adeyemi"},{id:"tailor",title:"Custom wedding outfit",name:"Zara Okafor"},{id:"shoemaker",title:"Shoe repair or handmade pair",name:"The Shoe Studio"},{id:"cook",title:"Meal boxes and event catering",name:"Chef Amara"},{id:"education",title:"Educational consultation",name:"Education Adviser"},{id:"home",title:"Home repair visit",name:"Home Services Pro"},{id:"photo",title:"Event photography",name:"Photo Studio"}];
const overrides=new Map();const reservations=new Map();
const key=(id,day,time)=>[id,day,time].join("|");
const detect=title=>{const v=String(title||"").toLowerCase();if(/barber|haircut|groom|fade|beard/.test(v))return "barber";if(/tailor|outfit|fashion|sewing|alteration|dress/.test(v))return "tailor";if(/shoe|cobbl|footwear/.test(v))return "shoemaker";if(/chef|meal|food|cook|cater|bake/.test(v))return "cook";if(/education|tutor|school|lesson|consult|admission/.test(v))return "education";if(/photo|film|wedding shoot|video shoot/.test(v))return "photo";if(/repair|plumb|electri|home service|clean|technician/.test(v))return "home";return "generic"};
const get=id=>{const v=templates[id]||templates.generic;return {...v,...(overrides.get(v.id)||{}),fields:v.fields.map(x=>x.slice()),locationModes:v.locationModes.slice()}};
const getForService=(title,id)=>get(id&&templates[id]?id:detect(title));
function update(id,patch){if(!templates[id])return false;const policy=get(id);const clean={};
 if(["off","optional","required"].includes(patch.consultation))clean.consultation=patch.consultation;
 if(patch.consultFee!==undefined){const n=Number(patch.consultFee);if(!Number.isSafeInteger(n)||n<0||n>100000)return false;clean.consultFee=n}
 if(typeof patch.creditConsultation==="boolean")clean.creditConsultation=patch.creditConsultation;
 if(patch.capacity!==undefined){const n=Number(patch.capacity);if(!Number.isSafeInteger(n)||n<1||n>50)return false;clean.capacity=n}
 if(patch.duration!==undefined){const n=Number(patch.duration);if(!Number.isSafeInteger(n)||n<15||n>480)return false;clean.duration=n}
 if(["manual","auto"].includes(patch.approval))clean.approval=patch.approval;
 if(clean.consultation==="off"){clean.consultFee=0;clean.creditConsultation=false}
 overrides.set(id,{...(overrides.get(id)||{}),...clean});return true}
function held(id,day,time){return reservations.get(key(id,day,time))||0}
function left(id,day,time){const cap=get(id).capacity;return Math.max(0,cap-held(id,day,time))}
function reserve(id,day,time,units=1){if(!Number.isSafeInteger(units)||units<1||units>get(id).capacity||left(id,day,time)<units)return false;const k=key(id,day,time);reservations.set(k,held(id,day,time)+units);return true}
function release(id,day,time,units=1){const k=key(id,day,time);reservations.set(k,Math.max(0,held(id,day,time)-Math.max(0,units)))}
const finalDue=(amount,paid,enabled)=>Math.max(0,Math.round(amount)-(enabled?Math.min(Math.round(amount),Math.max(0,Math.round(paid))):0));
window.HustleBookingRules={templates,samples,get,getForService,detect,update,held,left,reserve,release,finalDue,_testing:{overrides,reservations}};
})();