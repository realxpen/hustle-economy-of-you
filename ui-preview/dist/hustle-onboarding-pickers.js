/* Hustle V1 onboarding taxonomy + coarse, privacy-first location picker. */
(function(root){
"use strict";
const skillGroups={
 "Beauty & personal care":["Barbering","Hairdressing","Braiding","Makeup artistry","Nail technology","Skincare","Lash artistry","Massage therapy","Personal styling","Tattoo artistry"],
 "Fashion & crafts":["Tailoring","Fashion design","Clothing alterations","Shoemaking","Shoe repair","Bag making","Jewellery making","Beadwork","Leatherwork","Textile design","Embroidery"],
 "Food & events":["Cooking","Catering","Baking","Pastry making","Event planning","Event decoration","Floral design","Bartending","Food delivery","DJing","Event hosting"],
 "Home & construction":["Carpentry","Plumbing","Electrical installation","Painting","Tiling","Masonry","Bricklaying","Welding","Furniture making","Interior design","Cleaning","Laundry & dry cleaning","AC repair","Solar installation"],
 "Creative & media":["Photography","Videography","Video editing","Graphic design","Content creation","Animation","Music production","Voice-over","Copywriting","UI/UX design","Illustration"],
 "Digital & business":["Web development","Mobile app development","Data analysis","Digital marketing","Social media management","Virtual assistance","Bookkeeping","Business consulting","Software testing","Cybersecurity"],
 "Wellness & learning":["Personal training","Fitness coaching","Yoga instruction","Tutoring","Language teaching","Music lessons","Dance instruction","Career coaching"],
 "Transport & practical":["Driving","Delivery services","Auto mechanics","Auto detailing","Phone repair","Laptop repair","Computer maintenance","Gardening","Personal shopping","Errand running"]
};
const skills=Object.entries(skillGroups).flatMap(([category,values])=>values.map(name=>({name,category})));
const interestGroups={
 "Creative life":[["Art & design","🎨"],["Photography","📷"],["Fashion","👗"],["Writing","✍️"],["Books & reading","📚"],["Music","🎵"],["Movies","🎬"],["Dance","💃"],["Crafts & DIY","🧵"],["Architecture","🏛️"]],
 "Everyday & culture":[["Food","🍽️"],["Cooking","🍳"],["Coffee","☕"],["Travel","✈️"],["Adventure","⛰️"],["Local culture","🌍"],["Nature","🌿"],["Animals","🐾"],["Gardening","🌱"],["Lifestyle","✨"]],
 "Growth & ideas":[["Business","💼"],["Entrepreneurship","🚀"],["Technology","💻"],["Science","🔬"],["Education","🎓"],["Career","🗂️"],["Personal finance","💰"],["News","📰"],["History","🏺"],["Mindfulness","🌸"]],
 "Fun & fitness":[["Football","⚽"],["Basketball","🏀"],["Fitness","🏋️"],["Running","🏃"],["Cycling","🚴"],["Swimming","🏊"],["Gaming","🎮"],["Anime","🌙"],["Board games","🎲"],["Outdoors","🏕️"]]
};
const interests=Object.entries(interestGroups).flatMap(([group,values])=>values.map(([name,icon])=>({name,icon,group})));
/* Areas are approximate locality centres for browse and user-confirmed selection,
   not verified addresses, precise geocoding, or live proximity estimates. */
const areas=[
 ["Yaba, Lagos",6.515,3.372],["Ikeja, Lagos",6.605,3.348],
 ["Lekki, Lagos",6.469,3.561],["Victoria Island, Lagos",6.429,3.421],
 ["Surulere, Lagos",6.504,3.349],["Ikorodu, Lagos",6.620,3.505],
 ["Ajah, Lagos",6.468,3.600],["Maryland, Lagos",6.571,3.366],
 ["Gbagada, Lagos",6.555,3.389],["Ogba, Lagos",6.625,3.344],
 ["Agege, Lagos",6.619,3.326],["Oshodi, Lagos",6.556,3.333],
 ["Mushin, Lagos",6.526,3.354],["Festac Town, Lagos",6.469,3.286],
 ["Apapa, Lagos",6.448,3.364],["Epe, Lagos",6.587,3.980],
 ["Lagos Island, Lagos",6.455,3.394],["Sangotedo, Lagos",6.469,3.634],
 ["Badagry, Lagos",6.416,2.881],["Magodo, Lagos",6.619,3.384],
 ["Ketu, Lagos",6.596,3.390],["Ogudu, Lagos",6.581,3.399],
 ["Alimosho, Lagos",6.607,3.288],["Amuwo Odofin, Lagos",6.462,3.272],
 ["Abuja Municipal, FCT",9.057,7.490],["Gwarinpa, FCT",9.107,7.412],
 ["Wuse, FCT",9.074,7.471],["Maitama, FCT",9.095,7.490],
 ["Garki, FCT",9.035,7.489],["Kubwa, FCT",9.145,7.327],
 ["Port Harcourt, Rivers",4.815,7.050],["Obio/Akpor, Rivers",4.867,6.985],
 ["Ibadan, Oyo",7.376,3.897],["Ogbomoso, Oyo",8.133,4.257],
 ["Abeokuta, Ogun",7.155,3.346],["Sagamu, Ogun",6.833,3.649],
 ["Benin City, Edo",6.335,5.625],["Warri, Delta",5.520,5.750],
 ["Asaba, Delta",6.192,6.734],["Enugu, Enugu",6.450,7.501],
 ["Owerri, Imo",5.485,7.035],["Aba, Abia",5.106,7.367],
 ["Onitsha, Anambra",6.150,6.786],["Kano, Kano",12.000,8.518],
 ["Kaduna, Kaduna",10.510,7.417],["Jos, Plateau",9.930,8.890],
 ["Ilorin, Kwara",8.497,4.543],["Akure, Ondo",7.253,5.195],
 ["Uyo, Akwa Ibom",5.037,7.912],["Calabar, Cross River",4.976,8.341],
 ["Makurdi, Benue",7.737,8.536],["Osogbo, Osun",7.771,4.556]
].map(([label,lat,lon])=>({label,lat,lon}));
const normalize=value=>String(value||"").trim().toLocaleLowerCase("en");
const findSkills=(query="",limit=30)=>skills.filter(x=>normalize(x.name+" "+x.category).includes(normalize(query))).slice(0,limit);
const findAreas=(query="",limit=12)=>areas.filter(x=>normalize(x.label).includes(normalize(query))).slice(0,limit);
const bySkill=name=>skills.find(x=>normalize(x.name)===normalize(name));
const byArea=label=>areas.find(x=>normalize(x.label)===normalize(label));
function distanceKm(a,b){
 const toRad=x=>x*Math.PI/180,dLat=toRad(a.lat-b.lat),dLon=toRad(a.lon-b.lon);
 const z=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(z),Math.sqrt(1-z));
}
function approximateArea(latitude,longitude){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
 const nearby=areas.map(x=>({area:x,km:distanceKm({lat:latitude,lon:longitude},x)}))
  .sort((a,b)=>a.km-b.km)[0];
 return nearby&&nearby.km<=18?nearby.area:null;
}
function previewMap(label){
 const area=byArea(label);if(!area)return "";
 const lat=area.lat,lon=area.lon,spread=.038;
 const bbox=[lon-spread,lat-spread,lon+spread,lat+spread].map(x=>x.toFixed(5)).join("%2C");
 const marker=[lat,lon].map(x=>x.toFixed(5)).join("%2C");
 return "https://www.openstreetmap.org/export/embed.html?bbox="+bbox+
  "&layer=mapnik&marker="+marker;
}
root.HustleOnboardingPickers=Object.freeze({
 skills,interests,areas,findSkills,findAreas,bySkill,byArea,
 approximateArea,previewMap,interestLimit:10
});
})(window);
