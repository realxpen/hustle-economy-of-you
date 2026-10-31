(function hustleFlows(){
"use strict";
const phone=document.getElementById("phone");
if(!phone)return;
const image=(id,w=800)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=78`;
const pics={
barber:image("photo-1503951914875-452162b0f3f1"),tobi:image("photo-1500648767791-00dcc994a43e",240),
fashion:image("photo-1483985988355-763728e1935b"),fabric:image("photo-1598032895397-b9472444bf93"),
style:image("photo-1490481651871-ab68de25d43d"),zara:image("photo-1524504388940-b1c1722653e1",240),
photo:image("photo-1542038784456-1ea8e935640e"),house:image("photo-1600585154340-be6161a56a0c"),
food:image("photo-1556910103-1c02745aae4d"),flowers:image("photo-1490750967868-88aa4486c946"),
hair:image("photo-1521590832167-7bcbfaa6381f"),meal:image("photo-1547592180-85f173990554"),
dress:image("photo-1595777457583-95e059d581b8"),decor:image("photo-1616486338812-3dadae4b4ace")
};
const people=[
{id:"tobi",name:"Tobi Adeyemi",handle:"@tobithebarber",primary:"Barbering",secondary:"Grooming",location:"Lekki, Lagos",avatar:pics.tobi,cover:pics.barber,bio:"Clean cuts, intentional grooming, and an experience that makes you feel like yourself.",tag:"Beauty",rating:"4.9",reviews:42,work:[pics.barber,pics.hair],followers:"2.4k"},
{id:"zara",name:"Zara Okafor",handle:"@madebyzara",primary:"Fashion design",secondary:"Alterations",location:"Yaba, Lagos",avatar:pics.zara,cover:pics.fashion,bio:"From an idea to something you can wear. Custom fittings and thoughtful details.",tag:"Fashion",rating:"4.8",reviews:28,work:[pics.fashion,pics.fabric,pics.dress],followers:"1.8k"},
{id:"maya",name:"Maya Studio",handle:"@mayastudio",primary:"Photography",secondary:"Portraits",location:"Ikeja, Lagos",avatar:pics.zara,cover:pics.photo,bio:"Portraits, small events, and storytelling with light.",tag:"Creative",rating:"4.9",reviews:37,work:[pics.photo],followers:"3.1k"},
{id:"amara",name:"Chef Amara",handle:"@amarascooks",primary:"Cooking",secondary:"Catering",location:"Ikeja, Lagos",avatar:pics.zara,cover:pics.food,bio:"Good food, warm gatherings, and cooking made with care.",tag:"Food",rating:"4.8",reviews:63,work:[pics.food,pics.meal],followers:"5.2k"},
{id:"nora",name:"Habitat Works",handle:"@habitatworks",primary:"Interior design",secondary:"Decor",location:"Surulere, Lagos",avatar:pics.house,cover:pics.house,bio:"Designing homes that feel like the people living inside them.",tag:"Home",rating:"4.7",reviews:19,work:[pics.house,pics.decor],followers:"960"},
{id:"femi",name:"Femi Styles",handle:"@femistyles",primary:"Styling",secondary:"Wardrobe consulting",location:"Victoria Island, Lagos",avatar:pics.tobi,cover:pics.style,bio:"Personal styling and intentional wardrobe choices.",tag:"Fashion",rating:"4.9",reviews:16,work:[pics.style,pics.dress],followers:"730"},
{id:"flora",name:"Flora Studio",handle:"@florastudio",primary:"Floral styling",secondary:"Event decor",location:"Yaba, Lagos",avatar:pics.flowers,cover:pics.flowers,bio:"Flowers and handmade arrangements for thoughtful spaces.",tag:"Creative",rating:"4.7",reviews:12,work:[pics.flowers],followers:"580"}
];
const services=[
{id:"s-barber",type:"service",seller:"tobi",title:"Signature haircut",category:"Beauty",price:8000,unit:"from",img:pics.barber,photos:[pics.barber,pics.hair],description:"A personalized haircut and finishing session focused on the details that matter. Consult first to discuss your preferred style and location.",includes:["Style consultation and references","Haircut and finishing","Grooming recommendations"],duration:"45–75 minutes"},
{id:"s-fashion",type:"service",seller:"zara",title:"Custom outfit consultation",category:"Fashion",price:18000,unit:"from",img:pics.fashion,photos:[pics.fashion,pics.fabric,pics.dress],description:"Plan a bespoke outfit, discuss fit and fabric choices, and get a tailored quote before work starts.",includes:["Design and fitting consultation","Fabric and measurements discussion","Written estimate after consultation"],duration:"Consultation: 30 minutes"},
{id:"s-photo",type:"service",seller:"maya",title:"Portrait photography session",category:"Creative",price:35000,unit:"from",img:pics.photo,photos:[pics.photo],description:"Portrait photography shaped around your story. Discuss the mood, references, and shoot location before booking.",includes:["Pre-shoot mood discussion","Portrait shoot session","Edited image delivery terms agreed upfront"],duration:"Session: 1–2 hours"},
{id:"s-interior",type:"service",seller:"nora",title:"Interior consultation",category:"Home",price:25000,unit:"from",img:pics.house,photos:[pics.house,pics.decor],description:"Explore layout ideas, mood boards, and practical improvements for a room or living space.",includes:["Room requirements review","Direction and references","Estimate for further design work"],duration:"Consultation: 45 minutes"},
{id:"s-floral",type:"service",seller:"flora",title:"Floral styling consultation",category:"Creative",price:15000,unit:"from",img:pics.flowers,photos:[pics.flowers],description:"Plan custom floral arrangements for a celebration, workspace, or meaningful gift.",includes:["Concept consultation","Theme and seasonal materials","Custom quote after consultation"],duration:"Consultation: 30 minutes"},
{id:"s-stylist",type:"service",seller:"femi",title:"Personal wardrobe styling",category:"Fashion",price:20000,unit:"from",img:pics.style,photos:[pics.style],description:"Create outfits around your daily routine, personal style, and wardrobe goals.",includes:["Personal styling conversation","Look planning","Recommendations"],duration:"Consultation: 30 minutes"}
];
const products=[
{id:"p-meal",type:"product",seller:"amara",title:"Weekend meal box",category:"Food",price:12500,img:pics.meal,photos:[pics.meal,pics.food],description:"A demonstration meal box product. Select a quantity and review a sample order without paying.",includes:["Prepared meal box","Packaging for collection or delivery","Delivery availability confirmed before payment"],variants:["Regular","Family size"]},
{id:"p-outfit",type:"product",seller:"zara",title:"Two-piece fashion set",category:"Fashion",price:24000,img:pics.dress,photos:[pics.dress,pics.fashion],description:"A sample ready-to-wear fashion set with a choice of size. Availability and measurements are demonstrations.",includes:["Two-piece outfit","Size confirmation before fulfilment","Care instructions"],variants:["S","M","L","XL"]},
{id:"p-decor",type:"product",seller:"nora",title:"Handmade home decor",category:"Home",price:18500,img:pics.decor,photos:[pics.decor,pics.house],description:"A sample home accent piece offered by a local creator.",includes:["Decor piece","Protective packaging","Fulfilment agreed after checkout"],variants:["Natural","Dark"]},
{id:"p-flower",type:"product",seller:"flora",title:"Floral gift arrangement",category:"Creative",price:16000,img:pics.flowers,photos:[pics.flowers],description:"A sample floral arrangement for gifting or small celebrations.",includes:["One floral arrangement","Gift presentation","Collection or delivery to confirm"],variants:["Soft tones","Bright tones"]}
];
const training=[
{id:"t-barber",type:"training",seller:"tobi",title:"Barbering basics workshop",category:"Beauty",price:30000,img:pics.barber,photos:[pics.barber],description:"A sample apprenticeship-style introduction to barbering fundamentals. No enrollment occurs in the prototype.",includes:["Skills overview","Tools and safety basics","Demonstration session"]},
{id:"t-fashion",type:"training",seller:"zara",title:"Intro to dressmaking",category:"Fashion",price:45000,img:pics.fabric,photos:[pics.fabric],description:"A sample practical training listing covering measurements, fabric, and finishing.",includes:["Measurement basics","Fabric selection","A guided practical project"]}
];
const allItems=[...services,...products,...training];
const demoRequests=[];
const threads=[
{id:"tobi",person:"tobi",status:"Inquiry",unread:1,last:"Sure, send me a reference cut and location.",when:"10:42",about:"s-barber",messages:[{from:"me",text:"Hi, do you offer appointments in Lekki?",time:"10:39"},{from:"them",text:"Yes, let's discuss the style and location first.",time:"10:41"},{from:"them",text:"Sure, send me a reference cut and location.",time:"10:42"}]},
{id:"zara",person:"zara",status:"Consultation",unread:0,last:"I can help you with that outfit.",when:"Yesterday",about:"s-fashion",messages:[{from:"me",text:"Hi Zara, can we discuss a custom outfit?",time:"Yesterday"},{from:"them",text:"I can help you with that outfit.",time:"Yesterday"}]},
{id:"amara",person:"amara",status:"Order question",unread:0,last:"Weekend meal boxes are listed.",when:"Tue",about:"p-meal",messages:[{from:"them",text:"Weekend meal boxes are listed. Let me know your questions.",time:"Tue"}]},
{id:"maya",person:"maya",status:"Inquiry",unread:0,last:"What date is your shoot?",when:"Mon",about:"s-photo",messages:[{from:"them",text:"What date is your shoot?",time:"Mon"}]}
];
const samplePosts=[{"id":"post-tobi-1","seller":"tobi","kind":"video","image":"barber","caption":"A quiet morning at the chair. Getting the details right, one cut at a time.","related":"s-barber","tag":"Barbering"},{"id":"post-tobi-2","seller":"tobi","kind":"photo","image":"hair","caption":"The tools and people behind the finished look.","related":null,"tag":"Daily life"},{"id":"post-zara-1","seller":"zara","kind":"carousel","image":"fashion","caption":"From sketch to fitting. Here's a little behind the scenes of the making.","related":"s-fashion","tag":"Fashion"},{"id":"post-zara-2","seller":"zara","kind":"photo","image":"fabric","caption":"Mood board from this week's fabric hunt. What would you make with this?","related":null,"tag":"Creative process"},{"id":"post-maya-1","seller":"maya","kind":"photo","image":"photo","caption":"It's not just the camera. It's making people comfortable in front of it.","related":"s-photo","tag":"Photography"},{"id":"post-amara-1","seller":"amara","kind":"photo","image":"food","caption":"Cooking with family today. Good memories start in the kitchen.","related":null,"tag":"Life"},{"id":"post-amara-2","seller":"amara","kind":"photo","image":"meal","caption":"Weekend meal boxes are ready. Ask me anything about the menu.","related":"p-meal","tag":"Food"},{"id":"post-nora-1","seller":"nora","kind":"photo","image":"house","caption":"Small changes, completely different room. Before-and-after inspiration.","related":"s-interior","tag":"Home"},{"id":"post-femi-1","seller":"femi","kind":"photo","image":"style","caption":"Two ways to style pieces you already own.","related":"s-stylist","tag":"Fashion"},{"id":"post-flora-1","seller":"flora","kind":"video","image":"flowers","caption":"The way flowers open always makes me pause for a second.","related":"s-floral","tag":"Creative"},{"id":"post-you-1","seller":"self","kind":"photo","image":"photo","caption":"Learning, creating, and documenting the process. This is a sample post on my Hustle profile.","related":null,"tag":"Everyday"},{"id":"post-you-2","seller":"self","kind":"photo","image":"fashion","caption":"A sample of work I can share with the community.","related":null,"tag":"My work"}].map(p=>({...p,image:pics[p.image]}));
const signedIn={name:"Your name",handle:"@yourhustle",bio:"A little about you, your interests, and the skills you want to share.",primary:"Your primary skill",secondary:"Your other skills",location:"Lagos, Nigeria",avatar:pics.style,cover:pics.photo,following:83,followers:128};
const ownSavedPosts=new Set();
const state={screen:"Home",stack:[],exploreTab:"Top",category:"All",query:"",marketTab:"All",profile:"tobi",profileTab:"Posts",post:"post-tobi-1",postLikes:new Set(),postComments:{},ownTab:"Posts",item:"s-barber",photoIndex:0,thread:"tobi",inboxTab:"All",inboxQuery:"",bookingStep:0,bookingItem:"s-barber",booking:{details:"",location:"",mode:"In person",day:"Tomorrow",time:"11:30 AM"},cart:[],checkoutStep:0,checkoutMethod:"Card",checkout:{name:"",location:"",note:""},follow:new Set(),save:new Set(),variant:{},quantity:{},financeTab:"Overview",draftType:"Post",draftText:"",draftImageSrc:null,draftForms:{},draftFiles:[],draftPostKind:"Photo",draftServiceType:"In person",draftAttach:"",marketSort:"Featured",marketSearch:"",marketSlide:0,liveHubTab:"For You",liveCategory:"All",liveSlideId:null,livePreviewLikes:new Set(),liveSetup:{title:"",category:"Cooking",audience:"Public",offer:"p-meal"},liveComments:[],liveHearts:0,liveGifts:0,liveStarted:false,request:"",postSlide:0};
const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₦"+Number(n||0).toLocaleString("en-NG");
const person=id=>id==="self"?{id:"self",name:signedIn.name,handle:signedIn.handle,avatar:signedIn.avatar,cover:signedIn.cover,primary:signedIn.primary,secondary:signedIn.secondary,location:signedIn.location,tag:"All",rating:"—",followers:String(signedIn.followers),bio:signedIn.bio,work:[],reviews:0}:people.find(p=>p.id===id)||people[0];
const item=id=>allItems.find(p=>p.id===id)||services[0];
const layer=document.createElement("section");layer.id="hfFlowLayer";layer.className="hf-layer";layer.hidden=true;phone.appendChild(layer);
function cartItemCount(){return state.cart.reduce((sum,x)=>sum+x.qty,0)}
function syncCartBadge(){
 const badge=phone.querySelector("[data-hf-home-cart-count]");
 if(badge){const count=cartItemCount();badge.hidden=count===0;badge.textContent=String(count);const cart=phone.querySelector("[data-home-cart]");if(cart)cart.setAttribute("aria-label",count?"Open shopping cart, "+count+" items":"Open shopping cart")}
}
function openShopping(tab="All"){
 state.marketTab=tab;state.category="All";state.marketSearch="";
 if(state.screen==="Marketplace"){render();return}
 push("Marketplace");
}
function renderPayments(){
 const tabs=["Overview","Activity","Payouts"],selected=state.financeTab;
 const body=selected==="Overview"?`
 <div class="hf-money-dashboard"><div class="hf-money-figure"><small>Available earnings</small><strong>—</strong><span>Not connected to a payment provider</span></div>
 <div class="hf-money-summary"><div><b>Escrow in progress</b><strong>—</strong><small>Service milestones and releases</small></div><div><b>Pending payouts</b><strong>—</strong><small>Transfer status will appear here</small></div></div></div>
 <div class="hf-section-row"><h2>How Hustle payments work</h2></div>
 <div class="hf-payment-step"><span>1</span><div><b>Customer pays at checkout</b><small>Card or bank transfer through an approved provider—no required wallet top-up</small></div></div>
 <div class="hf-payment-step"><span>2</span><div><b>Protected service payment</b><small>Escrow/payment protection should track milestones and disputes using an authorized partner</small></div></div>
 <div class="hf-payment-step"><span>3</span><div><b>Professional receives earnings</b><small>After the agreed release conditions, eligible earnings become available for payout</small></div></div>`:
 selected==="Activity"?`<div class="hf-empty">No real payment activity connected. When transactions are enabled, you'll see purchases, protected service payments, refunds, fees and earnings here.</div>`:
 `<div class="hf-empty">No payout account connected. Provider-supported identity checks and bank-account setup will be required before actual withdrawals.</div>
 <button class="hf-soft-button" disabled style="width:100%;margin-top:12px;opacity:.6">Connect payout account · Coming later</button>`;
 return `${head("Payments & earnings","Financial overview · UI preview",true)}
 <div class="hf-page hf-payments-page"><div class="hf-notice">This is a prototype, not an active financial account. No wallet funds are stored, and no real balances are displayed.</div>
 <div class="hf-tabs" role="tablist" aria-label="Payment sections">${tabs.map(x=>`<button data-hf="finance-tab" data-value="${x}" class="${selected===x?"on":""}" role="tab" aria-selected="${selected===x}">${x}</button>`).join("")}</div>
 ${body}
 <div class="hf-actions"><button class="hf-soft-button" data-hf="orders">My purchases</button><button class="hf-lime-button" data-hf="market">Shop marketplace</button></div>
 <p class="hf-demo-footnote">Real money movement, merchant payouts and escrow require a reviewed payment-provider integration, account authorization and compliance checks.</p>
 </div>`;
}
function renderOrders(){
 return `${head("My orders","Purchases and service bookings",true)}<div class="hf-page"><div class="hf-empty"><strong>Nothing ordered in this preview</strong><p>No real orders or bookings are connected yet. Cart and checkout actions are UI demonstrations only.</p></div>
 <div class="hf-actions"><button class="hf-lime-button" data-hf="market">Browse marketplace</button><button class="hf-soft-button" data-hf="cart">View cart${cartItemCount()?` (${cartItemCount()})`:""}</button></div>
 <button class="hf-story-banner" data-hf="payments"><span>₦</span><div><b>Payments & earnings</b><small>Future receipts, escrow, releases and payouts</small></div><strong>→</strong></button></div>`;
}
function renderSettings(){
 return `${head("Settings","Your account and app preferences",true)}<div class="hf-page">
 <button class="hf-person" data-hf="own-edit"><span class="hf-person-icon">♙</span><span class="hf-person-data"><b>Edit profile</b><small>Name, bio, skill and location</small></span><span class="hf-chevron">›</span></button>
 <button class="hf-person" data-hf="appearance"><span class="hf-person-icon">☾</span><span class="hf-person-data"><b>Appearance</b><small>Toggle light or dark theme</small></span><span class="hf-chevron">›</span></button>
 <button class="hf-person" data-hf="notifications"><span class="hf-person-icon">♧</span><span class="hf-person-data"><b>Notifications</b><small>No notifications connected in the preview</small></span><span class="hf-chevron">›</span></button>
 <button class="hf-person" data-hf="payments"><span class="hf-person-icon">₦</span><span class="hf-person-data"><b>Payments & earnings</b><small>Protected payments, earnings and payout overview</small></span><span class="hf-chevron">›</span></button>
 <div class="hf-section-row"><h2>Internal tools</h2><small>Restricted demo</small></div>
 <button class="hf-person" data-hf="admin-preview"><span class="hf-person-icon">🔐</span><span class="hf-person-data"><b>Admin Console</b><small>Internal, invitation-only · Sandbox preview</small></span><span class="hf-chevron">›</span></button>
 <p class="hf-demo-footnote">These settings are demo-only. The internal Admin Console is a non-authenticated design sandbox, not a real admin account.</p></div>`;
}
function head(title,subtitle="",back=true,action=""){
 return `<header class="hf-page-head"><div class="hf-headrow">${back?'<button class="hf-icbtn" data-hf="back" aria-label="Go back">←</button>':''}<div><h1>${esc(title)}<em>.</em></h1>${subtitle?`<small>${esc(subtitle)}</small>`:''}</div>${action}</div></header>`;
}
function push(screen,params={}){
 if((state.screen==="GoLive"||state.screen==="LiveStudio")&&screen!=="GoLive"&&screen!=="LiveStudio")stopCamera();
 if(state.screen!=="Home"||screen!=="Home")state.stack.push({screen:state.screen,profile:state.profile,profileTab:state.profileTab,item:state.item,thread:state.thread});
 state.screen=screen;
 Object.assign(state,params);
 render();
}
function go(screen,params={}){
 if(state.screen==="GoLive"||state.screen==="LiveStudio")stopCamera();
 state.stack=[];state.screen=screen;Object.assign(state,params);render();
}
function home(){
 if(cameraStream)stopCamera();
 state.screen="Home";state.stack=[];layer.hidden=true;layer.innerHTML="";phone.classList.remove("hf-flow-active","hf-flow-detail-active");phone.classList.remove("chrome-hidden");
 const legacy=phone.querySelector(".full-page");if(legacy)legacy.remove();
 updateNav("Home");
 syncCartBadge();
 const v=phone.querySelector("video.hp-feed-video");if(v&&v.getBoundingClientRect().top>=0&&v.getBoundingClientRect().top<phone.clientHeight*.6)v.play().catch(()=>{});
}
function back(){
 if(state.screen==="GoLive"||state.screen==="LiveStudio")stopCamera();
 const prev=state.stack.pop();
 if(prev){state.screen=prev.screen;Object.assign(state,{profile:prev.profile,profileTab:prev.profileTab,item:prev.item,thread:prev.thread});render();return}
 home();
}
function updateNav(screen){
 phone.querySelectorAll(".bottom-nav [data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===(screen==="Marketplace"||screen==="LiveHub"?"Explore":screen==="Chat"?"Inbox":screen==="OwnProfile"?"Profile":screen)));
}
function render(){
 if(state.screen==="Home"){home();return}
 phone.querySelectorAll("video.hp-feed-video").forEach(v=>v.pause());
 layer.hidden=false;
 const main=new Set(["Explore","Marketplace","Inbox","OwnProfile","Create"]);
 const detail=!main.has(state.screen);
 layer.className="hf-layer"+(detail?" hf-detail":"")+(state.screen==="Chat"?" hf-chat-screen":"");
 phone.classList.add("hf-flow-active");
 phone.classList.toggle("hf-flow-detail-active",detail);
 updateNav(detail?(state.screen==="Chat"?"Inbox":["Payments","Orders","Settings","EditProfile"].includes(state.screen)?"Profile":"Explore"):state.screen);
 let html="";
 switch(state.screen){
  case "Explore":html=renderExplore();break;
  case "Marketplace":html=renderMarket();break;
  case "Profile":html=renderProfile();break;
  case "OwnProfile":html=renderOwn();break;
  case "Listing":html=renderListing();break;
  case "Booking":html=renderBooking();break;
  case "Inbox":html=renderInbox();break;
  case "Chat":html=renderChat();break;
  case "Cart":html=renderCart();break;
  case "Checkout":html=renderCheckout();break;
  case "Create":html=renderCreate();break;
  case "LiveHub":html=renderLiveHub();break;
  case "GoLive":html=renderGoLive();break;
  case "LiveStudio":html=renderLiveStudio();break;
  case "LiveWatch":html=renderLiveWatch();break;
  case "Request":html=renderRequest();break;
  case "Post":html=renderPostDetail();break;
  case "EditProfile":html=renderProfileEdit();break;
  case "Payments":html=renderPayments();break;
  case "Orders":html=renderOrders();break;
  case "Settings":html=renderSettings();break;
  default:html=renderExplore();
 }
 if(mapInstance)disposeMap();
 layer.innerHTML=html;
 syncCartBadge();
 layer.scrollTop=0;
 if(state.screen==="Explore"&&state.exploreTab==="Map")initializeMapAfterRender();
 if(state.screen==="LiveWatch"||state.screen==="LiveStudio")layer.querySelector("#hfLiveMessages")?.scrollTo?.(0,100000);
 if(state.screen==="Chat"){const chat=layer.querySelector(".hf-chat-scroll");if(chat)chat.scrollTop=chat.scrollHeight}
 if(state.screen==="GoLive"||state.screen==="LiveStudio")bindCameraPreview();
 if(state.screen==="LiveHub")initLiveFeed();
}
function personCard(p){
 return `<button class="hf-person" data-hf="profile" data-id="${p.id}"><img src="${p.avatar}" alt="" loading="lazy"><span class="hf-person-data"><b>${esc(p.name)} <span class="hf-verified">✓</span></b><small>${esc(p.primary)} · ${esc(p.location)}</small><small>★ ${esc(p.rating)} example rating · ${esc(p.secondary)}</small></span><span class="hf-chevron">›</span></button>`;
}
function listingCard(p){
 return `<article class="hf-card"><button data-hf="listing" data-id="${p.id}" aria-label="View ${esc(p.title)}"><div class="hf-card-img"><img src="${p.img}" alt="${esc(p.title)}" loading="lazy"><span>${p.type==="service"?"Service":p.type==="product"?"Product":"Training"}</span></div><div class="hf-card-body"><b class="hf-card-title">${esc(p.title)}</b><div class="hf-card-mini">${esc(person(p.seller).name)}</div><strong class="hf-card-price">${p.type==="service"?"From ":""}${money(p.price)}</strong><div class="hf-card-seller"><img class="hf-card-avatar" src="${person(p.seller).avatar}" alt="" loading="lazy">${esc(person(p.seller).location)}</div></div></button></article>`;
}
function categoryChips(){
 return `<div class="hf-chips" role="group" aria-label="Categories">${["All","Beauty","Fashion","Creative","Food","Home"].map(x=>`<button data-hf="cat" data-value="${x}" class="${state.category===x?"on":""}">${x}</button>`).join("")}</div>`;
}

function mapCategoryInfo(p){
 const id=p.id;
 const info={
  tobi:{icon:"💈",label:"Barbering",color:"#c6e97b",group:"Beauty"},
  zara:{icon:"🧵",label:"Fashion",color:"#efc4e3",group:"Fashion"},
  maya:{icon:"📷",label:"Photography",color:"#bad8fa",group:"Creative"},
  amara:{icon:"🍳",label:"Cooking",color:"#ffd59e",group:"Food"},
  nora:{icon:"🏠",label:"Home design",color:"#c9d2fc",group:"Home"},
  femi:{icon:"👗",label:"Styling",color:"#e6c8f8",group:"Fashion"},
  flora:{icon:"💐",label:"Floral design",color:"#f9c4d7",group:"Creative"}
 };
 return info[id]||{icon:"✦",label:p.primary||"Skill",color:"#daff8a",group:p.tag||"Creative"};
}
function mapLegend(){
 const list=[people[0],people[1],people[2],people[3],people[4],people[6]];
 return `<div class="hf-map-skill-legend" aria-label="Map skills legend">${list.map(p=>{const i=mapCategoryInfo(p);return `<span><i style="background:${i.color}">${i.icon}</i>${esc(i.label)}</span>`}).join("")}</div>`;
}
function mapMiniGraphic(list,variant){
 const all=list.filter(p=>p.coords);
 const name=variant==="results"?"Results map illustration":"Lagos skills illustration";
 return `<div class="hf-map-illustration hf-map-illustration-${variant}" role="group" aria-label="${name}; sample neighborhood positions, not a live map">
 <svg viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
 <path d="M-40 143 C60 96 119 192 344 72" fill="none" stroke="#b7c8b0" stroke-width="21" opacity=".53"/>
 <path d="M-30 61 C102 105 150 15 329 32" fill="none" stroke="#edf4e5" stroke-width="12"/>
 <path d="M63 -16 L100 188 M168 -30 L229 197 M-16 125 L321 126" fill="none" stroke="#ffffff" stroke-width="7" opacity=".68"/>
 <path d="M-10 150 C40 137 63 177 99 180 L-10 190Z" fill="#afd1d9" opacity=".75"/>
 </svg>
 <span class="hf-map-place hf-map-place-lekki">LEKKI</span><span class="hf-map-place hf-map-place-yaba">YABA</span><span class="hf-map-place hf-map-place-ikeja">IKEJA</span>
 ${all.map((p,n)=>{const i=mapCategoryInfo(p);const positions={tobi:[75,69],zara:[37,55],maya:[45,21],amara:[64,14],nora:[27,47],femi:[59,84],flora:[29,70]},pos=positions[p.id]||[35,35];
 return `<button type="button" class="hf-mini-skill-pin" data-hf="mini-map-pin" data-id="${p.id}" style="left:${pos[0]}%;top:${pos[1]}%;--skill-color:${i.color};--skill-delay:${(n%5)*.22}s" aria-label="View ${esc(p.name)} · ${esc(i.label)} in ${esc(p.location)}"><span>${i.icon}</span></button>`;
 }).join("")}
 </div>`;
}
function mapPreSearchCard(){
 return `<div class="hf-map-discovery-card" aria-label="Discover professionals on a map">
 <div class="hf-map-discovery-copy"><span class="hf-map-kicker">⌖ EXPLORE BY LOCATION</span><h2>Find skills around you<span>.</span></h2><p>See who does what, and where to find them.</p>
 <button data-hf="map-open" class="hf-map-cta">Explore map <span aria-hidden="true">↗</span></button><small>Sample Lagos locations · No GPS needed</small></div>
 ${mapMiniGraphic(mapPeople(),"home")}
 </div>`;
}
function mapSearchPreview(){
 const list=mapPeople();
 if(!state.query.trim()||!["Top","People","Posts","Services","Products","Training"].includes(state.exploreTab))return "";
 const count=list.length;
 return `<section class="hf-map-results-feature" aria-label="Map search matches">
 <div class="hf-map-results-copy"><span>⌖ MAP MATCHES</span><b>${count===1?"1 local skill to explore":count+" local skills to explore"}</b>
 <small>${count?"See matching demo professionals on the map":"No demo map pins match this search yet"}</small>
 <button data-hf="map-open" class="hf-map-results-open">View map results ↗</button></div>
 ${mapMiniGraphic(list.slice(0,5),"results")}
 </section>`;
}

function renderExplore(){
 const tabs=["Top","People","Posts","Services","Products","Training","Requests","Map","Stories","Live"];
 return `${head("Explore","People, skills, work and opportunities",false,`<button class="hf-live-mini" data-hf="live-hub" aria-label="Explore Live feeds">● LIVE</button><button class="hf-icbtn" data-hf="cart" aria-label="Open shopping cart">🛒${cartItemCount()?`<span class="hf-cart-count">${cartItemCount()}</span>`:""}</button>`)}
 <div class="hf-page"><div id="hfMapPresearchHost">${state.exploreTab==="Top"&&!state.query.trim()?mapPreSearchCard():""}</div><div class="hf-searchbox"><span>⌕</span><input id="hfExploreQuery" type="search" value="${esc(state.query)}" placeholder="Barber in Lekki, fashion in Yaba..." aria-label="Search Hustle"/><button data-hf="search-clear" aria-label="Clear search">×</button></div>
 <div class="hf-discovery-shopping"><button data-hf="market" aria-label="Browse the Marketplace"><span>🛍️</span><b>Marketplace</b><small>Products · Services</small><strong>→</strong></button><button data-hf="cart" aria-label="Open cart"><span>🛒</span><b>Cart${cartItemCount()?` · ${cartItemCount()}`:""}</b><small>Review items</small><strong>→</strong></button></div>
 <div class="hf-tabs" role="tablist" aria-label="Search sections">${tabs.map(x=>`<button data-hf="explore-tab" data-value="${x}" class="${state.exploreTab===x?"on":""}" role="tab" aria-selected="${state.exploreTab===x}">${x}</button>`).join("")}</div>
 ${categoryChips()}
 <div id="hfSearchResults">${mapSearchPreview()}${exploreResults()}</div>
 </div>`;
}
function matches(p){
 const c=person(p.seller||p.id);
 const text=[p.title,p.category,p.description,c.name,c.primary,c.secondary,c.location,c.handle].filter(Boolean).join(" ").toLowerCase();
 const q=state.query.toLowerCase().split(/\s+/).filter(x=>x&&!["in","near","at","for","the","a"].includes(x));
 const cat=state.category==="All"||p.category===state.category||c.tag===state.category;
 return cat&&q.every(w=>text.includes(w));
}
function exploreResults(){
 if(state.exploreTab==="Map")return renderMapResults();
 if(state.exploreTab==="Stories")return `<button class="hf-story-banner" data-hf="stories"><span>✦</span><div><b>Friends and recommended Stories</b><small>Circles for people you follow; square Stories for discovery</small></div><strong>→</strong></button>`;
 if(state.exploreTab==="Live")return liveExploreTeaser();
 if(state.exploreTab==="Requests")return renderRequestGrid();
 const ppl=people.filter(p=>matches({...p,title:p.primary,description:p.secondary,category:p.tag,seller:p.id}));
 const foundPosts=samplePosts.filter(postMatches);
 const productsFound=products.filter(matches),servicesFound=services.filter(matches),trainingFound=training.filter(matches);
 const blocks=[];
 if(["Top","People"].includes(state.exploreTab)&&ppl.length)blocks.push(`<div class="hf-section-row"><h2>Professionals</h2><small>${ppl.length} examples</small></div>${ppl.slice(0,state.exploreTab==="Top"?3:20).map(personCard).join("")}`);
 if(["Top","Posts"].includes(state.exploreTab)&&foundPosts.length)blocks.push(`<div class="hf-section-row"><h2>Posts from the community</h2><small>${foundPosts.length} demo posts</small></div>${renderPostsGrid(foundPosts.slice(0,state.exploreTab==="Top"?4:30))}`);
 if(["Top","Services"].includes(state.exploreTab)&&servicesFound.length)blocks.push(`<div class="hf-section-row"><h2>Services</h2>${state.exploreTab==="Top"?'<button class="hf-link" data-hf="market-services">View all →</button>':""}</div><div class="hf-two">${servicesFound.slice(0,state.exploreTab==="Top"?4:20).map(listingCard).join("")}</div>`);
 if(["Top","Products"].includes(state.exploreTab)&&productsFound.length)blocks.push(`<div class="hf-section-row"><h2>Products</h2>${state.exploreTab==="Top"?'<button class="hf-link" data-hf="market-products">View all →</button>':""}</div><div class="hf-two">${productsFound.slice(0,state.exploreTab==="Top"?2:20).map(listingCard).join("")}</div>`);
 if(["Top","Training"].includes(state.exploreTab)&&trainingFound.length)blocks.push(`<div class="hf-section-row"><h2>Learn from professionals</h2></div><div class="hf-two">${trainingFound.map(listingCard).join("")}</div>`);
 if(state.exploreTab==="Top"&&!state.query)blocks.push(`<div class="hf-hero-card"><div style="flex:1"><h3>From watching to doing.</h3><p>Find the service or product behind the work you love.</p><button class="hf-lime-button" data-hf="market">Open marketplace →</button></div><img src="${pics.fashion}" alt="Fashion work" loading="lazy"></div>`);
 if(state.exploreTab==="Top"&&!state.query)blocks.push(`<div class="hf-section-row"><h2>More to discover</h2></div><button class="hf-story-banner" data-hf="stories"><span>✦</span><div><b>Explore creator Stories</b><small>Quick behind-the-scenes moments</small></div><strong>→</strong></button>`);
 return blocks.join("")||'<div class="hf-empty">No matches in this demo. Try a skill, person or location such as “barber in Lekki”.</div>';
}
function refreshSearch(){
 const input=layer.querySelector("#hfExploreQuery");
 if(input)state.query=input.value;
 const result=layer.querySelector("#hfSearchResults");
 if(result){if(mapInstance)disposeMap();result.innerHTML=mapSearchPreview()+exploreResults();if(state.exploreTab==="Map")initializeMapAfterRender();}
  const discover=layer.querySelector("#hfMapPresearchHost");
  if(discover)discover.innerHTML=state.exploreTab==="Top"&&!state.query.trim()?mapPreSearchCard():"";
}
function marketCard(l){
 const p=person(l.seller);
 return `<article class="hf-shop-card"><button data-hf="listing" data-id="${l.id}" aria-label="View ${esc(l.title)}"><div class="hf-shop-img"><img src="${l.img}" alt="${esc(l.title)}" loading="lazy"><span>${l.type==="product"?"PRODUCT":l.type==="service"?"SERVICE":"LEARN"}</span></div><div class="hf-shop-body"><b>${esc(l.title)}</b><small>by ${esc(p.name)}</small><div class="hf-shop-price">${l.type==="service"?"From ":""}${money(l.price)}</div><div class="hf-shop-meta"><span>⌖ ${esc(p.location)}</span><strong>View →</strong></div></div></button></article>`;
}
function renderMarket(){
 const tabs=["All","Products","Services","Training"],cats=[["All","✦","Everything"],["Beauty","✂","Beauty"],["Fashion","♢","Fashion"],["Food","♨","Food"],["Home","⌂","Home"],["Creative","✳","Creative"]];
 const promos=[
 {kicker:"FEATURED · SAMPLE PROMOTION",title:"Made by people near you.",copy:"Discover products and skills from creators in Lagos.",image:pics.fashion,action:"market-products",label:"Shop products"},
 {kicker:"FEATURED · SAMPLE PROMOTION",title:"Your next good find.",copy:"Explore local meals, gifts and handmade things.",image:pics.meal,action:"market-products",label:"Explore products"},
 {kicker:"FEATURED · SAMPLE PROMOTION",title:"From skills to possibilities.",copy:"Book a conversation before you hire a professional.",image:pics.barber,action:"market-services",label:"Explore services"}
 ];
 const promo=promos[state.marketSlide%promos.length];
 const tabProducts=state.marketTab==="Products"?products:state.marketTab==="Services"?services:state.marketTab==="Training"?training:allItems;
 const words=state.marketSearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
 let filtered=tabProducts.filter(l=>(state.category==="All"||l.category===state.category)&&words.every(w=>[l.title,l.category,l.description,person(l.seller).name,person(l.seller).location].join(" ").toLowerCase().includes(w)));
 if(state.marketSort==="Price: low")filtered=[...filtered].sort((a,b)=>a.price-b.price);
 if(state.marketSort==="Price: high")filtered=[...filtered].sort((a,b)=>b.price-a.price);
 const featuredProducts=products.filter(l=>state.category==="All"||l.category===state.category);
 return `${head("Marketplace","Shop products · Book services · Learn skills",false,`<button class="hf-icbtn" data-hf="cart" aria-label="Shopping cart">🛒${cartItemCount()?`<span class="hf-cart-count">${cartItemCount()}</span>`:""}</button>`)}
 <div class="hf-shop-page">
 <div class="hf-shop-search"><span aria-hidden="true">⌕</span><input id="hfMarketSearch" type="search" value="${esc(state.marketSearch)}" placeholder="Search products, services, stores..." aria-label="Search marketplace"><button data-hf="market-search-clear" aria-label="Clear marketplace search">×</button></div>
 <div class="hf-promo" role="region" aria-label="Featured sample promotions">
 <img src="${promo.image}" alt="Featured creative work"><div class="hf-promo-gradient"></div>
 <div class="hf-promo-copy"><span>${promo.kicker}</span><h2>${promo.title}</h2><p>${promo.copy}</p><button data-hf="${promo.action}">${promo.label} →</button></div>
 <div class="hf-promo-controls"><button data-hf="market-promo-prev" aria-label="Previous promotional banner">‹</button><span>${promos.map((_,i)=>`<i class="${i===state.marketSlide%promos.length?"on":""}"></i>`).join("")}</span><button data-hf="market-promo-next" aria-label="Next promotional banner">›</button></div></div>
 <div class="hf-shop-promo-disclaimer">Sponsored placements and discounts are illustrative. No advertiser is connected.</div>
 <div class="hf-section-row"><h2>Shop by category</h2><small>Find your thing</small></div>
 <div class="hf-shop-categories">${cats.map(([id,icon,name])=>`<button data-hf="cat" data-value="${id}" class="${state.category===id?"on":""}"><span>${icon}</span><b>${name}</b></button>`).join("")}</div>
 <div class="hf-shop-pills">${tabs.map(x=>`<button data-hf="market-tab" data-value="${x}" class="${state.marketTab===x?"on":""}">${x}</button>`).join("")}</div>
 <div class="hf-shop-sortrow"><div><b>${state.marketTab==="All"?"Discover listings":state.marketTab}</b><small>${filtered.length} sample listings</small></div><label>Sort <select id="hfMarketSort" aria-label="Sort marketplace listings">${["Featured","Price: low","Price: high"].map(x=>`<option ${state.marketSort===x?"selected":""} value="${x}">${x}</option>`).join("")}</select></label></div>
 <div id="hfMarketListings" class="hf-shop-grid">${filtered.map(marketCard).join("")||'<div class="hf-empty">Nothing matches that search. Try another category.</div>'}</div>
 ${state.marketTab==="All"&&!state.marketSearch?`<div class="hf-shop-promo-strip"><div><span>HUSTLE LIVE · DEMO</span><h3>Watch makers. Shop the moment.</h3><p>Explore creators and their pinned offers.</p><button data-hf="live-hub">Explore Live →</button></div><img src="${pics.food}" alt="Creator cooking" loading="lazy"></div>
 <div class="hf-section-row"><h2>Curated products</h2><button class="hf-link" data-hf="market-products">Shop all →</button></div><div class="hf-shop-grid">${featuredProducts.slice(0,4).map(marketCard).join("")}</div>
 <div class="hf-shop-proof"><span>✦ Direct from creators</span><span>⌖ Discover by skill</span><span>♧ Consultation before hire</span></div>`:""}
 </div>`;
}
function renderRequestGrid(){
 const rows=demoRequests.map(r=>`<button class="hf-request-tile" data-hf="request-open" data-id="${r.id}"><b>${esc(r.title)}</b><p>${esc(r.description)}</p><span>${esc(r.category)} · ${esc(r.location)}</span><strong>${money(r.budget)} budget · demo →</strong></button>`).join("");
 return `<div class="hf-section-row"><h2>Community requests</h2><small>Demo only</small></div>${rows||'<div class="hf-empty">No sample requests yet. Create one from the Create tab to see how they appear.</div>'}<button class="hf-soft-button" data-hf="request-create" style="width:100%;margin-top:12px">+ Post a demo request</button>`;
}
function renderRequest(){
 const req=demoRequests.find(r=>r.id===state.request);
 if(!req)return `${head("Request","Demo request",true)}<div class="hf-empty">Request unavailable.</div>`;
 return `${head("Customer request","Sample opportunity",true)}<div class="hf-form"><span class="hf-create-kicker">DEMO · NOT PUBLISHED</span><h2>${esc(req.title)}</h2><div class="hf-summary"><div><b>Category</b><span>${esc(req.category)}</span></div><div><b>Location</b><span>${esc(req.location)}</span></div><div><b>Budget</b><span>${money(req.budget)}</span></div></div><p>${esc(req.description)}</p><button class="hf-lime-button" data-hf="request-contact" style="width:100%">Preview response →</button><p class="hf-demo-footnote">No real request is posted. Contacting the requester is disabled in this preview.</p></div>`;
}
const liveSessions=[{"id":"live-chef","person":"amara","title":"In the kitchen with Chef Amara","category":"Food","picture":"food","viewerCount":486,"offer":"p-meal"},{"id":"live-barber","person":"tobi","title":"Inside the barber studio","category":"Beauty","picture":"barber","viewerCount":129,"offer":"s-barber"},{"id":"live-style","person":"zara","title":"Making a custom outfit","category":"Fashion","picture":"fashion","viewerCount":82,"offer":"s-fashion"},{"id":"live-decor","person":"nora","title":"Designing a cozy living room","category":"Home","picture":"house","viewerCount":55,"offer":"s-interior"}];
liveSessions.unshift({id:"live-flora",person:"flora",title:"Flowers opening in the studio",category:"Creative",picture:"flowers",viewerCount:73,offer:"s-floral",previewVideo:"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"});
let cameraStream=null;
async function toggleCamera(){
 if(cameraStream){stopCamera();render();return}
 if(!navigator.mediaDevices?.getUserMedia){notify("Camera preview is unavailable in this browser");return}
 try {
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
  if(state.screen!=="GoLive"&&state.screen!=="LiveStudio"){stream.getTracks().forEach(x=>x.stop());return}
  cameraStream=stream;render();
 }catch(e){notify("Camera not available or permission denied. The demo works without it.")}
}
function stopCamera(){if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null}}
function bindCameraPreview(){const v=layer.querySelector("#hfLiveCamera");if(v&&cameraStream){v.srcObject=cameraStream;v.play().catch(()=>{})}}
function liveHubMatches(){
 return liveSessions.filter(l=>(state.liveCategory==="All"||l.category===state.liveCategory)&&(state.liveHubTab!=="Following"||state.follow.has(l.person)||l.person==="amara"));
}
function renderLiveHub(){
 const tabs=["For You","Following","Nearby"],cats=["All","Food","Beauty","Fashion","Home","Creative"],filtered=liveHubMatches();
 return `<section class="hf-live-feed hf-live-discovery" aria-label="Swipe through Live broadcast previews">
 <header class="hf-live-feed-top hf-live-minimal-head">
   <div class="hf-live-feed-header"><button class="hf-live-feed-close" data-hf="back" aria-label="Close Live discovery">×</button>
   <span class="hf-live-feed-title">hustle<span>.</span> <b>LIVE</b></span>
   <button class="hf-live-feed-create" data-hf="go-live">＋ Go Live</button></div>
   <nav class="hf-live-feed-tabs" aria-label="Live discovery">${tabs.map(x=>`<button data-hf="live-hub-tab" data-value="${x}" class="${state.liveHubTab===x?"on":""}" aria-pressed="${state.liveHubTab===x}">${x}</button>`).join("")}</nav>
   <div class="hf-live-feed-filter" aria-label="Filter Live creators">${cats.map(x=>`<button data-hf="live-category" data-value="${x}" class="${state.liveCategory===x?"on":""}">${x}</button>`).join("")}</div>
 </header>
 <main class="hf-live-feed-viewport" id="hfLiveFeedViewport" aria-label="Swipe vertically to see another Live preview" tabindex="0">
 ${filtered.map((l,i)=>{
 const c=person(l.person),hasPreview=!!l.previewVideo;
 return `<article class="hf-live-feed-slide" data-live-slide="${l.id}" aria-label="${esc(c.name)} live preview ${i+1} of ${filtered.length}">
 <div class="hf-live-preview-stage">
 ${hasPreview?`<video class="hf-live-preview-video" data-live-preview-video="${l.id}" src="${l.previewVideo}" poster="${pics[l.picture]}" playsinline webkit-playsinline muted loop preload="metadata" aria-label="Sample flower footage, not an actual live broadcast"></video>`:`<img class="hf-live-preview-still" src="${pics[l.picture]}" alt="Still photograph preview of ${esc(c.name)}">`}
 <span class="hf-live-media-hint">${hasPreview?"Sample video · not live":"Still-image demo · not live"}</span>
 </div>
 <div class="hf-live-feed-shade"></div>
 <button class="hf-live-feed-tap" data-hf="live-watch" data-id="${l.id}" aria-label="Enter ${esc(c.name)} simulated Live room">
 <span class="hf-live-tap-prompt"><i aria-hidden="true">▮▮▏</i> Tap to watch LIVE</span>
 </button>
 <div class="hf-live-preview-bottom">
 <span class="hf-live-live-now">● LIVE DEMO</span>
 <div class="hf-live-preview-host"><img src="${c.avatar}" alt=""><div><b>${esc(c.name)}</b><small>${esc(l.title)} · ${esc(l.category)}</small></div></div>
 <span class="hf-live-preview-viewers">${l.viewerCount} sample viewers · ${hasPreview?"video example":"photo example"}</span>
 </div>
 </article>`}).join("")||'<div class="hf-live-feed-empty"><h2>No example rooms here yet.</h2><p>Select another category or switch to For You.</p><button data-hf="live-hub-tab" data-value="For You">For You →</button></div>'}
 </main><div class="hf-live-feed-hint">Swipe for another creator · Tap to enter</div>
 </section>`;
}
function updateLiveReaction(id){
 const node=layer.querySelector('[data-hf="live-preview-like"][data-id="'+id+'"]');
 if(!node)return;
 const liked=state.livePreviewLikes.has(id);
 node.innerHTML=(liked?"♥":"♡")+"<small>"+(liked?"Liked":"Like")+"</small>";
 node.setAttribute("aria-pressed",String(liked));
}
function updateLiveFollow(id){
 layer.querySelectorAll('[data-hf="live-preview-follow"][data-id="'+id+'"]').forEach(node=>{
  const on=state.follow.has(id);node.innerHTML=(on?"✓":"＋")+"<small>"+(on?"Following":"Follow")+"</small>";
 });
}
function initLiveFeed(){
 const viewport=layer.querySelector("#hfLiveFeedViewport");if(!viewport)return;
 const slides=Array.from(viewport.querySelectorAll("[data-live-slide]"));
 const videos=Array.from(viewport.querySelectorAll("video[data-live-preview-video]"));
 const index=slides.findIndex(x=>x.dataset.liveSlide===state.liveSlideId);
 if(index>0)viewport.scrollTop=index*viewport.clientHeight;
 let current=-1;
 const sync=()=>{
  const height=viewport.clientHeight||1;
  const idx=Math.max(0,Math.min(slides.length-1,Math.round(viewport.scrollTop/height)));
  if(idx===current)return;
  current=idx;
  if(slides[idx])state.liveSlideId=slides[idx].dataset.liveSlide;
  videos.forEach(video=>{
   const parent=video.closest("[data-live-slide]");
   const active=parent===slides[idx]&&!document.hidden&&!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
   if(active){video.play().catch(()=>{})}else{video.pause()}
  });
 };
 viewport.addEventListener("scroll",sync,{passive:true});
 viewport.addEventListener("keydown",e=>{
  if(e.target!==viewport||!["ArrowDown","ArrowUp"].includes(e.key))return;
  e.preventDefault();const idx=Math.round(viewport.scrollTop/(viewport.clientHeight||1));
  viewport.scrollTo({top:Math.max(0,Math.min(slides.length-1,idx+(e.key==="ArrowDown"?1:-1)))*viewport.clientHeight,behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth"});
 });
 videos.forEach(video=>video.addEventListener("error",()=>{video.hidden=true;const stage=video.parentNode;const fallback=document.createElement("img");fallback.className="hf-live-preview-still";fallback.src=video.poster;fallback.alt="Sample creator photograph";stage.insertBefore(fallback,video);const label=stage.querySelector(".hf-live-media-hint");if(label)label.textContent="Photo fallback · not live"}));
 sync();
}
function renderLiveWatch(){
 const l=liveSessions.find(x=>x.id===state.liveWatchId)||liveSessions[0],c=person(l.person),offer=item(l.offer);
 return `<section class="hf-live-room hf-live-room-detail" aria-label="${esc(c.name)} interactive simulated Live room">
 <div class="hf-live-room-visual">
 ${l.previewVideo?`<video class="hf-live-room-bg-video" id="hfLiveRoomVideo" src="${l.previewVideo}" poster="${pics[l.picture]}" autoplay muted loop playsinline webkit-playsinline preload="metadata" aria-label="Sample footage, not a real live broadcast"></video>`:`<img class="hf-live-room-bg" src="${pics[l.picture]}" alt="Demo room illustration for ${esc(c.name)}">`}
 </div>
 <div class="hf-live-room-shade"></div>
 <div class="hf-live-room-ui">
 <header class="hf-live-room-header hf-live-watch-header">
 <img src="${c.avatar}" alt=""><div><b>${esc(c.name)}</b><small>${l.viewerCount} example viewers · ${esc(l.category)}</small></div>
 <button data-hf="live-follow" data-id="${l.person}">${state.follow.has(l.person)?"✓ Following":"+ Join"}</button>
 <button class="hf-live-room-exit" data-hf="back" aria-label="Leave Live room">×</button>
 </header>
 <div class="hf-live-room-status"><span>● LIVE ROOM DEMO</span><span>✦ ${esc(c.primary)}</span></div>
 <div class="hf-live-room-spacer"></div>
 <div class="hf-live-room-messages" id="hfLiveMessages" aria-live="polite">
 <p><b>Hustle</b> Welcome to the demonstration room.</p>
 <p><b>@community</b> This work looks amazing!</p>
 <p><b>@viewer</b> Can I book a consultation?</p>
 ${state.liveComments.map(message=>`<p><b>You</b> ${esc(message)}</p>`).join("")}
 </div>
 <button class="hf-live-pinned" data-hf="listing" data-id="${offer.id}"><span>✦ PINNED ${offer.type==="product"?"PRODUCT":"SERVICE"} · DEMO</span><b>${esc(offer.title)}</b><strong>${money(offer.price)} ↗</strong></button>
 <div class="hf-live-room-interaction">
 <form id="hfLiveChatForm" class="hf-live-composer"><input name="message" maxlength="200" required placeholder="Type a demo message…" aria-label="Demo Live chat"><button type="submit" aria-label="Send a demo message">↑</button></form>
 <button class="hf-live-room-heart" data-hf="live-heart" aria-label="Send demo heart">♥<small>${state.liveHearts||""}</small></button>
 <button class="hf-live-room-gift" data-hf="live-gift" aria-label="Send a free demo gift">🎁<small>${state.liveGifts||""}</small></button>
 </div>
 <p class="hf-live-room-disclaimer">No actual broadcast, audience or paid gifts</p>
 </div></section>`;
}
function renderGoLive(){
 const categories=["Beauty","Fashion","Creative","Food","Home"];
 const l=state.liveSetup;
 return `${head("Go Live","Create a host session · Demo only",true)}<div class="hf-live-setup">
 <div class="hf-live-setup-intro"><span>● CREATOR LIVE STUDIO</span><h2>Show people the process.</h2><p>Let viewers discover your work, ask questions and find relevant offers.</p></div>
 <div class="hf-live-camera-box"><img src="${pics.food}" alt="Sample background for Live setup"><video id="hfLiveCamera" autoplay muted playsinline></video><div><span>${cameraStream?"CAMERA PREVIEW · LOCAL ONLY":"CAMERA OFF · SAMPLE BACKGROUND"}</span><button data-hf="live-camera">${cameraStream?"Stop camera":"Preview camera (optional)"}</button></div></div>
 <div class="hf-notice">Camera access is optional. Permission is only requested if you tap Preview camera. Nothing is broadcast or uploaded.</div>
 <form id="hfGoLiveForm" class="hf-create-form">
 <div class="hf-field"><label for="hfLiveTitle">Live title</label><input name="title" id="hfLiveTitle" maxlength="90" required value="${esc(l.title)}" placeholder="e.g. Cooking Saturday orders"></div>
 <div class="hf-field"><label for="hfLiveCategory">What skill are you showing?</label><select name="category" id="hfLiveCategory">${categories.map(x=>`<option value="${x}" ${l.category===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="hf-field"><label for="hfLiveAudience">Audience</label><select name="audience" id="hfLiveAudience">${["Public","Following","Mutuals"].map(x=>`<option value="${x}" ${l.audience===x?"selected":""}>${x}</option>`).join("")}</select></div>
 <div class="hf-field"><label for="hfLiveOffer">Pin an offer (optional)</label><select name="offer" id="hfLiveOffer"><option value="">No pinned offer</option>${allItems.map(x=>`<option value="${x.id}" ${l.offer===x.id?"selected":""}>${esc(x.title)} · ${money(x.price)}</option>`).join("")}</select></div>
 <button type="submit" class="hf-lime-button hf-create-submit">Start Live simulation →</button>
 <p class="hf-demo-footnote">Starting here does not start a real livestream, enable real audience access or collect payments.</p></form>
 </div>`;
}
function renderLiveStudio(){
 const l=state.liveSetup;
 const chosen=l.offer?allItems.find(x=>x.id===l.offer):null;
 return `<section class="hf-live-room" aria-label="Your simulated Live studio">
 <img class="hf-live-room-bg" src="${pics.food}" alt="Simulated Live host background"><video id="hfLiveCamera" class="hf-live-room-camera" autoplay muted playsinline></video><div class="hf-live-room-shade"></div>
 <div class="hf-live-room-ui">
 <div class="hf-live-room-header"><button data-hf="live-end" aria-label="End Live simulation">×</button><img src="${signedIn.avatar}" alt=""><div><b>${esc(signedIn.name)}</b><small>● HOST PREVIEW · No audience connected</small></div><span class="hf-live-card-flag">DEMO</span></div>
 <div class="hf-live-warning">${esc(l.title)} · ${esc(l.audience)} · No live stream</div>
 <div class="hf-live-room-spacer"></div>
 <div class="hf-live-room-messages" id="hfLiveMessages"><p><b>Hustle demo</b> This is how your creator Live could feel.</p>${state.liveComments.map(m=>`<p><b>You</b> ${esc(m)}</p>`).join("")}</div>
 ${chosen?`<button class="hf-live-pinned" data-hf="listing" data-id="${chosen.id}"><span>✦ PINNED OFFER · PREVIEW</span><b>${esc(chosen.title)}</b><strong>${money(chosen.price)} →</strong></button>`:""}
 <div class="hf-live-host-tools"><button data-hf="live-camera">${cameraStream?"Stop camera preview":"Preview camera"}</button><button data-hf="live-heart">♥ Demo hearts ${state.liveHearts}</button></div>
 <form id="hfLiveChatForm" class="hf-live-composer"><input name="message" maxlength="200" placeholder="Test a chat message…" required><button type="submit">↑</button></form>
 <button class="hf-live-end" data-hf="live-end">End demo Live</button></div></section>`;
}
function liveExploreTeaser(){
 return `<div class="hf-hero-card"><div style="flex:1"><span style="font-size:10px;letter-spacing:1px;color:#dbff85">● LIVE HUB · DEMO</span><h3>Creators in the moment.</h3><p>Explore a dedicated Live discovery page, then try an interactive simulated Live room.</p><button class="hf-lime-button" data-hf="live-hub">Browse Live →</button></div><img src="${pics.food}" alt="Cooking creator" loading="lazy"></div>
 <button class="hf-story-banner" data-hf="go-live"><span>●</span><div><b>Start your own Live</b><small>Configure your title, audience and pinned offer</small></div><strong>→</strong></button>`;
}
function poster(id){return id==="self"?{id:"self",name:signedIn.name,handle:signedIn.handle,avatar:signedIn.avatar,primary:signedIn.primary,location:signedIn.location,tag:"All"}:person(id)}
function postById(id){return samplePosts.find(p=>p.id===id)||samplePosts[0]}
function postMatches(p){
 const who=poster(p.seller);
 const terms=state.query.toLowerCase().split(/\s+/).filter(x=>x&&!["in","near","at","for","the","a"].includes(x));
 const corpus=[p.caption,p.tag,p.kind,who.name,who.handle,who.primary,who.location,p.related?item(p.related).title:""].join(" ").toLowerCase();
 const category=state.category==="All"||who.tag===state.category||p.tag.toLowerCase()===state.category.toLowerCase();
 return category&&terms.every(t=>corpus.includes(t));
}
function postCard(p){
 const who=poster(p.seller);
 return `<button class="hf-post-tile" data-hf="post-detail" data-id="${esc(p.id)}" aria-label="View post by ${esc(who.name)}">
 <img src="${p.image}" alt="Post by ${esc(who.name)}" loading="lazy">
 <span class="hf-post-tile-type">${p.kind==="video"?"▶ Video":p.kind==="carousel"?"▧ Carousel":"Photo"}</span>
 <span class="hf-post-tile-foot"><b>${esc(who.name)}</b><small>${esc(p.caption)}</small></span></button>`;
}
function renderPostsGrid(posts,empty="No posts in this section yet."){
 return posts.length?`<div class="hf-post-grid">${posts.map(postCard).join("")}</div>`:`<div class="hf-empty">${esc(empty)}</div>`;
}
function renderPostDetail(){
 const p=postById(state.post),who=poster(p.seller),comments=state.postComments[p.id]||[];
 return `${head("Post","A moment from "+who.name,true)}
 <div class="hf-post-view">
 <div class="hf-post-detail-photo">${p.videoSrc?`<video src="${p.videoSrc}" poster="${p.image}" playsinline controls muted></video>`:`<img src="${p.images?.[state.postSlide]||p.image}" alt="${esc(p.caption)}">`}
 ${p.images?.length>1?`<div class="hf-post-photo-controls"><button data-hf="post-photo-prev" aria-label="Previous photo">‹</button><small>${state.postSlide+1} / ${p.images.length}</small><button data-hf="post-photo-next" aria-label="Next photo">›</button></div>`:''}<span class="hf-post-kind">${p.kind==="video"?"Video preview":p.kind==="carousel"?"Carousel preview":"Photo post"}</span></div>
 <div class="hf-post-author"><img src="${who.avatar}" alt=""><div><b>${esc(who.name)}</b><small>${esc(who.handle)} · ${esc(who.location)}</small></div>
 <button data-hf="${p.seller==="self"?"own":"profile"}" ${p.seller!=="self"?`data-id="${p.seller}"`:""}>Profile →</button></div>
 <p class="hf-post-full-caption">${esc(p.caption)}</p>
 <div class="hf-post-interactions">
 <button data-hf="post-like" data-id="${p.id}" aria-pressed="${state.postLikes.has(p.id)}">${state.postLikes.has(p.id)?"♥ Liked":"♡ Like"}</button>
 <button data-hf="post-comment-focus">♧ Comment</button>
 <button data-hf="post-save" data-id="${p.id}">${ownSavedPosts.has(p.id)?"▣ Saved":"▢ Save"}</button>
 <button data-hf="share">↗ Share</button></div>
 ${p.related?`<button class="hf-post-attached" data-hf="listing" data-id="${p.related}"><span>✦ Attached ${item(p.related).type}</span><b>${esc(item(p.related).title)}</b><strong>${money(item(p.related).price)} →</strong></button>`:""}
 <div class="hf-section-row"><h2>Comments</h2><small>Local preview</small></div>
 <div class="hf-post-comments"><p><b>@community</b> Love seeing the process ✨</p>${comments.map(c=>`<p><b>You</b> ${esc(c)}</p>`).join("")}</div>
 <form id="hfPostCommentForm" class="hf-post-comment-form"><input id="hfPostCommentInput" name="comment" maxlength="280" required placeholder="Add a demo comment…" aria-label="Comment"/><button type="submit">Post</button></form>
 <p class="hf-demo-footnote">Sample content only. Likes, comments and saves stay in this demo session.</p></div>`;
}
function renderProfileEdit(){
 const fields=[["Name","name",signedIn.name],["Username","handle",signedIn.handle],["Primary skill","primary",signedIn.primary],["Secondary skill","secondary",signedIn.secondary],["Location","location",signedIn.location]];
 return `${head("Edit profile","Signed-in account preview",true)}
 <form class="hf-form" id="hfEditProfileForm">
 <div class="hf-profile-edit-avatar"><img src="${signedIn.avatar}" alt="Sample avatar"><span>Demo avatar · change in the real app</span></div>
 ${fields.map(([label,name,value])=>`<div class="hf-field"><label for="hf-edit-${name}">${label}</label><input id="hf-edit-${name}" name="${name}" value="${esc(value)}" maxlength="70" required></div>`).join("")}
 <div class="hf-field"><label for="hf-edit-bio">Bio</label><textarea id="hf-edit-bio" name="bio" maxlength="250" required>${esc(signedIn.bio)}</textarea></div>
 <button class="hf-lime-button" type="submit" style="width:100%">Save demo profile →</button>
 <p class="hf-demo-footnote">This is not your real signed-in account. Changes last only while this preview is open.</p></form>`;
}
let mapInstance=null,mapLoadPromise=null,mapGpsMarker=null;
const mapMarkers=new Map();
function mapPeople(){
 const coords={tobi:[6.442,3.478],zara:[6.518,3.381],maya:[6.601,3.349],amara:[6.613,3.361],nora:[6.496,3.350],femi:[6.430,3.420],flora:[6.513,3.375]};
 const visible=people.filter(p=>{
  const offered=allItems.filter(l=>l.seller===p.id);
  const joined=offered.map(l=>[l.title,l.category,l.description].join(" ")).join(" ");
  return matches({...p,title:[p.primary,joined].join(" "),description:[p.secondary,joined].join(" "),category:p.tag,seller:p.id});
 });
 return visible.map(p=>({...p,coords:coords[p.id]})).filter(p=>p.coords);
}
function renderMapResults(){
 const list=mapPeople();
 return `<div class="hf-map-intro"><div><h2>Find skills on the map</h2><p>Explore sample professionals around Lagos. Pins are approximate neighborhood positions, not exact addresses.</p></div><span>⌖</span></div>
 <p class="hf-map-hint">Tap a skill icon to see the professional and their available example services.</p>
 ${mapLegend()}
 <div class="hf-map-tools"><button data-hf="map-locate">◎ Use my location</button><button data-hf="map-reset">↺ Reset to Lagos</button></div>
 <div class="hf-map-stage" role="region" aria-label="Interactive professionals map">
 <div id="hfLeafletMap" class="hf-leaflet-map"><div class="hf-map-loading">Preparing map…</div></div></div>
 <div class="hf-map-privacy">Map tiles © OpenStreetMap contributors. Your location is off unless you tap Use my location. Demo pins are neighborhood examples only.</div>
 <div id="hfMapSelection"></div>
 <div class="hf-section-row"><h2>Professionals on this map</h2><small>${list.length} demo pins</small></div>
 ${list.length?list.map(personCard).join(""):'<div class="hf-empty">No professionals match these filters. Try a different skill or location.</div>'}`;
}
function ensureLeaflet(){
 if(window.L)return Promise.resolve(window.L);
 if(mapLoadPromise)return mapLoadPromise;
 mapLoadPromise=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-hf-leaflet]')){
   const style=document.createElement("link");
   style.rel="stylesheet";style.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";style.integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";style.crossOrigin="anonymous";style.dataset.hfLeaflet="true";document.head.appendChild(style);
  }
  const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";script.crossOrigin="anonymous";
  script.onload=()=>window.L?resolve(window.L):reject(new Error("Map library unavailable"));
  script.onerror=()=>reject(new Error("Map library unavailable on this connection"));
  document.head.appendChild(script);
 }).catch(e=>{mapLoadPromise=null;throw e});
 return mapLoadPromise;
}
function disposeMap(){
 if(mapInstance){mapInstance.remove();mapInstance=null}
 mapMarkers.clear();mapGpsMarker=null;
}
function renderMapSelection(){
 const el=layer.querySelector("#hfMapSelection");
 if(!el)return;
 const p=people.find(x=>x.id===state.mapSelected);
 if(!p){el.innerHTML="";return}
 const skill=mapCategoryInfo(p),listing=allItems.find(x=>x.seller===p.id&&x.type==="service");
 el.innerHTML=`<div class="hf-map-selected"><span class="hf-map-selected-icon" style="background:${skill.color}">${skill.icon}</span><img src="${p.avatar}" alt=""><div><b>${esc(p.name)}</b><small>${esc(skill.label)} · ${esc(p.location)}</small><small>${listing?"Offers "+esc(listing.title)+" · ":""}Approximate demo pin</small></div><button data-hf="profile" data-id="${p.id}">Profile →</button></div>${listing?`<button class="hf-map-offer-link" data-hf="listing" data-id="${listing.id}">View ${esc(listing.title)} <span aria-hidden="true">↗</span></button>`:""}`;
}
function initMap(){
 if(state.screen!=="Explore"||state.exploreTab!=="Map")return;
 const el=layer.querySelector("#hfLeafletMap");
 if(!el||!window.L)return;
 disposeMap();
 const L=window.L;
 el.innerHTML="";
 mapInstance=L.map(el,{zoomControl:true,scrollWheelZoom:false,attributionControl:true}).setView([6.515,3.388],11);
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
 }).addTo(mapInstance);
 for(const p of mapPeople()){
  const skill=mapCategoryInfo(p);
  const ico=L.divIcon({className:"hf-map-custom-icon",html:`<span class="hf-map-pin" style="--skill-color:${skill.color}" aria-hidden="true"><i>${skill.icon}</i></span>`,iconSize:[46,50],iconAnchor:[23,43],popupAnchor:[0,-32]});
  const marker=L.marker(p.coords,{icon:ico,title:p.name}).addTo(mapInstance);
  const offer=allItems.find(l=>l.seller===p.id&&l.type==="service");
  marker.bindPopup(`<div class="hf-map-popup"><b>${skill.icon} ${esc(p.name)}</b><small>${esc(skill.label)} · ${esc(p.location)}</small>${offer?`<small>Service: ${esc(offer.title)}</small>`:""}<small>Approximate location · demo</small><button type="button" data-hf-map-profile="${esc(p.id)}">View professional →</button></div>`,{maxWidth:240});
  marker.on("click",()=>{
   state.mapSelected=p.id;renderMapSelection();
   for(const [id,m] of mapMarkers){const element=m.getElement?.();element?.classList.toggle("hf-map-pin-selected",id===p.id)}
  });
  marker.on("popupopen",()=>{const button=marker.getPopup()?.getElement()?.querySelector("[data-hf-map-profile]");button?.addEventListener("click",()=>openProfile(p.id),{once:true})});
  mapMarkers.set(p.id,marker);
 }
 if(state.mapGPS&&mapInstance){
  mapGpsMarker=L.circleMarker(state.mapGPS,{radius:8,color:"#377ac0",weight:2,fillColor:"#72b9fb",fillOpacity:.9}).addTo(mapInstance).bindPopup("Your approximate current location (only in this session)");
  mapInstance.setView(state.mapGPS,12);
 }
 renderMapSelection();
 setTimeout(()=>{if(state.screen==="Explore"&&state.exploreTab==="Map"&&mapInstance)mapInstance.invalidateSize()},120);
}
function initializeMapAfterRender(){
 if(state.screen!=="Explore"||state.exploreTab!=="Map")return;
 ensureLeaflet().then(()=>{if(state.screen==="Explore"&&state.exploreTab==="Map")initMap()}).catch(()=>{
  const el=layer.querySelector("#hfLeafletMap");
  if(el)el.innerHTML='<div class="hf-map-loading">Map tiles could not load. You can still browse the professionals below. Try a better connection or reload.</div>';
 });
}
function mapUseLocation(){
 if(!navigator.geolocation){notify("Location services unavailable in this browser");return}
 navigator.geolocation.getCurrentPosition(position=>{
  state.mapGPS=[position.coords.latitude,position.coords.longitude];
  if(state.screen==="Explore"&&state.exploreTab==="Map")initMap();
  notify("Location shown only in this preview session");
 },err=>{
  notify(err.code===1?"Location permission was not granted":"Unable to get your location. Browse sample pins instead.");
 },{enableHighAccuracy:false,timeout:9000,maximumAge:90000});
}
function renderProfile(){
 const p=person(state.profile);
 const sellerItems=allItems.filter(x=>x.seller===p.id);
 const tabs=["Posts","Work","Services","Products","Training","Reviews"];
 let inner="";
 if(state.profileTab==="Posts"){
  inner=`<p class="hf-profile-tab-copy">Posts and everyday moments shared by ${esc(p.name)}.</p>${renderPostsGrid(samplePosts.filter(x=>x.seller===p.id))}`;
 }else if(state.profileTab==="Work"){
  inner=`<p class="hf-profile-tab-copy">Work by ${esc(p.name)}. Tap a listing to see its full details.</p><div class="hf-profile-work-grid">${p.work.map((src,i)=>`<button data-hf="profile-work" data-value="${i}" aria-label="View featured work ${i+1}"><img src="${src}" alt="Sample work by ${esc(p.name)}" loading="lazy"></button>`).join("")}</div>`;
 }else if(state.profileTab==="Reviews"){
  inner=`<p class="hf-profile-tab-copy">The following reviews are illustrations, not verified customer feedback.</p><div class="hf-review"><strong>★★★★★</strong><p>“Clear communication and really thoughtful work.”</p><small>Sample review · demonstration only</small></div><div class="hf-review"><strong>★★★★★</strong><p>“The consultation helped me explain what I needed.”</p><small>Sample review · demonstration only</small></div>`;
 }else{
  const chosen=sellerItems.filter(x=>x.type===state.profileTab.slice(0,-1).toLowerCase()||(state.profileTab==="Training"&&x.type==="training"));
  inner=`<div class="hf-two" style="margin-top:13px">${chosen.map(listingCard).join("")}</div>${!chosen.length?'<p class="hf-empty">No demo listings in this section yet.</p>':""}`;
 }
 return `<div class="hf-profile-cover"><img src="${p.cover}" alt="Work from ${esc(p.name)}"><div class="hf-profile-head"><button data-hf="back" aria-label="Back">←</button><span>HUSTLE · PROFESSIONAL</span><button data-hf="share" aria-label="Share profile">↗</button></div></div>
 <div class="hf-profile-info"><div class="hf-profile-identity"><img src="${p.avatar}" alt=""><div><h2>${esc(p.name)} <span class="hf-verified">✓</span></h2><small>${esc(p.handle)} · ${esc(p.location)}</small></div></div>
 <p class="hf-profile-bio">${esc(p.bio)}</p><div class="hf-trust"><span>✦ Profile demo</span><span>Primary: ${esc(p.primary)}</span><span>Also: ${esc(p.secondary)}</span></div>
 <div class="hf-profile-metrics"><span><b>${p.followers}</b> followers (demo)</span><span><b>★ ${p.rating}</b> example rating</span></div>
 <div class="hf-actions"><button class="hf-lime-button" data-hf="profile-hire" data-id="${p.id}">Hire / Consult</button><button class="hf-soft-button" data-hf="message" data-id="${p.id}">Message</button><button class="hf-soft-button" data-hf="follow" data-id="${p.id}">${state.follow.has(p.id)?"✓ Following":"+ Follow"}</button></div>
 <div class="hf-tabs" role="tablist" aria-label="Professional profile sections">${tabs.map(x=>`<button data-hf="profile-tab" data-value="${x}" class="${state.profileTab===x?"on":""}" role="tab">${x}</button>`).join("")}</div>
 ${inner}</div>`;
}
function renderOwn(){
 const tabs=["Posts","Work","Services","Products","Training","Reposts","Saved","Reviews"];
 let content="";
 if(state.ownTab==="Posts")content=renderPostsGrid(samplePosts.filter(p=>p.seller==="self"),"Your own posts will appear here.");
 else if(state.ownTab==="Work")content=renderPostsGrid(samplePosts.filter(p=>p.seller==="self"&&p.tag==="My work"),"Showcase your skills here.");
 else if(state.ownTab==="Saved")content=renderPostsGrid(samplePosts.filter(p=>ownSavedPosts.has(p.id)),"Only you can see saved posts.");
 else if(state.ownTab==="Reposts")content='<div class="hf-empty">Posts you repost can appear here. Privacy controls come with your real account.</div>';
 else if(state.ownTab==="Reviews")content='<div class="hf-empty">Reviews from real customers will appear once your account is connected.</div>';
 else {const type=state.ownTab==="Services"?"service":state.ownTab==="Products"?"product":"training";const ownItems=allItems.filter(x=>x.seller==="self"&&x.type===type);content=ownItems.length?`<div class="hf-two">${ownItems.map(listingCard).join("")}</div>`:'<div class="hf-empty">No demo '+type+' listings under your profile yet.</div><button class="hf-lime-button hf-listing-draft" data-hf="create">+ Create listing draft</button>';}
 return `<div class="hf-profile-cover hf-own-cover"><img src="${signedIn.cover}" alt="Sample profile cover"><div class="hf-profile-head"><span>HUSTLE · YOUR PROFILE</span><button data-hf="own-settings" aria-label="Profile settings">⚙</button></div></div>
 <div class="hf-profile-info"><div class="hf-profile-identity"><img src="${signedIn.avatar}" alt="Sample avatar"><div><h2>${esc(signedIn.name)}</h2><small>${esc(signedIn.handle)} · ${esc(signedIn.location)}</small></div></div>
 <p class="hf-profile-bio">${esc(signedIn.bio)}</p><div class="hf-trust"><span>Primary: ${esc(signedIn.primary)}</span><span>Secondary: ${esc(signedIn.secondary)}</span><span>Client + creator</span></div>
 <div class="hf-profile-metrics"><span><b>${signedIn.followers}</b> sample followers</span><span><b>${signedIn.following}</b> following</span><span><b>${samplePosts.filter(p=>p.seller==="self").length}</b> sample posts</span></div>
 <div class="hf-actions"><button class="hf-lime-button" data-hf="own-edit">Edit profile</button><button class="hf-soft-button" data-hf="create">+ Post</button><button class="hf-soft-button" data-hf="share">↗ Share</button></div>
 <div class="hf-profile-commerce"><div class="hf-section-row"><h2>Shopping & earnings</h2><small>Everything in one place</small></div>
 <div class="hf-profile-commerce-grid">
 <button data-hf="market"><span>🛍️</span><b>Marketplace</b><small>Explore offers</small></button>
 <button data-hf="cart"><span>🛒</span><b>Cart${cartItemCount()?` (${cartItemCount()})`:""}</b><small>Review items</small></button>
 <button data-hf="orders"><span>▤</span><b>My orders</b><small>Purchases & bookings</small></button>
 <button data-hf="payments"><span>₦</span><b>Wallet & escrow</b><small>Fund · Milestones · Payouts</small></button>
 </div></div>
 <div class="hf-profile-commerce hf-profile-studios"><div class="hf-section-row"><h2>Workspaces</h2><small>Creator & agent tools</small></div><div class="hf-profile-commerce-grid"><button data-hf="hustler-studio"><span>✳</span><b>Hustler Studio</b><small>Bookings · Insights</small></button><button data-hf="agent-studio"><span>♙</span><b>Agent Studio</b><small>Apply · Manage talent</small></button></div></div>
 <div class="hf-notice hf-own-notice">Preview account only. No real identity, followers, posts, or account data is connected.</div>
 <div class="hf-tabs" role="tablist" aria-label="Your profile sections">${tabs.map(x=>`<button data-hf="own-tab" data-value="${x}" class="${state.ownTab===x?"on":""}" role="tab" aria-selected="${state.ownTab===x}">${x}</button>`).join("")}</div>
 <div class="hf-own-tab-content">${content}</div></div>`;
}
function renderListing(){
 const l=item(state.item),seller=person(l.seller);
 const picture=l.photos[state.photoIndex%l.photos.length]||l.img;
 const isProduct=l.type==="product",isTraining=l.type==="training";
 return `<div class="hf-detail-hero"><img src="${picture}" alt="${esc(l.title)}"><div class="hf-detail-top"><button data-hf="back" aria-label="Back to listings">←</button><button data-hf="save" data-id="${l.id}" aria-label="Save listing">${state.save.has(l.id)?"♥":"♡"}</button></div>
 ${l.photos.length>1?`<button class="hf-tinybtn" data-hf="photo-prev" style="position:absolute;z-index:3;bottom:12px;left:12px">‹</button><span style="position:absolute;z-index:3;bottom:20px;left:50%;color:#fff;font-size:10px">${state.photoIndex%l.photos.length+1} / ${l.photos.length}</span><button class="hf-tinybtn" data-hf="photo-next" style="position:absolute;z-index:3;bottom:12px;right:12px">›</button>`:""}</div>
 <div class="hf-detail-body"><div class="hf-detail-kicker">${l.type==="service"?"Service":isProduct?"Product":"Training"} · ${esc(l.category)}</div>
 <h1>${esc(l.title)}</h1><div class="hf-detail-price">${l.type==="service"?"From ":""}${money(l.price)}</div>
 <p>${esc(l.description)}</p>
 <div class="hf-seller-row"><img src="${seller.avatar}" alt=""><div><b>${esc(seller.name)} <span class="hf-verified">✓</span></b><small>${esc(seller.primary)} · ${esc(seller.location)}</small></div><button data-hf="profile" data-id="${seller.id}">Profile →</button></div>
 ${isProduct?`<div class="hf-section-row"><h2>Options</h2></div><div class="hf-picker-row">${(l.variants||["Standard"]).map(x=>`<button class="${(state.variant[l.id]||l.variants[0])===x?"on":""}" data-hf="variant" data-value="${esc(x)}">${esc(x)}</button>`).join("")}</div><div class="hf-section-row"><h2>Quantity</h2></div><div class="hf-picker-row"><button data-hf="quantity" data-value="-1">−</button><button style="pointer-events:none">${state.quantity[l.id]||1}</button><button data-hf="quantity" data-value="1">+</button></div>`:""}
 <div class="hf-section-row"><h2>${isProduct?"Product details":isTraining?"What you will learn":"What's included"}</h2></div><ul class="hf-bullets">${l.includes.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
 ${l.duration?`<div class="hf-notice">◷ ${esc(l.duration)}. Dates and availability are confirmed during consultation.</div>`:""}
 <div class="hf-section-row"><h2>Reviews & trust</h2></div><div class="hf-review"><strong>★ ${seller.rating} · example</strong><p>Review details are examples until the real reputation system is connected.</p><small>Trust indicators in this preview are illustrative</small></div>
 <div class="hf-section-row"><h2>Questions about this ${l.type}?</h2><button class="hf-link" data-hf="message" data-id="${seller.id}">Chat seller →</button></div>
 ${l.type==="service"?'<div class="hf-notice">Consultation comes before a confirmed hire. Final quotes, milestones and escrow are agreed after requirements are reviewed.</div>':isProduct?'<div class="hf-notice">Product availability, delivery and payments are not connected. You can try the cart and checkout preview.</div>':'<div class="hf-notice">This sample training listing does not enroll you or create an apprenticeship agreement.</div>'}
 </div>
 <div class="hf-sticky-actions"><div class="hf-sticky-copy"><b>${money(l.price)}</b><small>${l.type==="service"?"Starting price · demo":l.type==="product"?"Sample product price":"Training fee · demo"}</small></div>
 <button class="hf-soft-button" data-hf="message" data-id="${seller.id}">Chat</button>
 <button class="hf-lime-button" data-hf="${isProduct?"add-cart":isTraining?"training-interest":"book"}" data-id="${l.id}">${isProduct?"Add to cart":isTraining?"Enquire":"Book consult"} →</button></div>`;
}
function bookingSteps(){
 return `<div class="hf-steps">${[0,1,2].map((x)=>`<span class="${state.bookingStep>=x?"on":""}"></span>`).join("")}</div>`;
}
function renderBooking(){
 const l=item(state.bookingItem),seller=person(l.seller);
 const title=state.bookingStep===0?"Tell us what you need":state.bookingStep===1?"Choose a preference":state.bookingStep===2?"Review your request":"Request preview";
 let body="";
 if(state.bookingStep===0){
  body=`<div class="hf-field"><label for="hfRequest">What would you like ${esc(seller.name)} to do?</label><textarea id="hfRequest" placeholder="Describe your style, scope, requirements or references..." minlength="10" maxlength="500">${esc(state.booking.details)}</textarea></div>
  <div class="hf-field"><label for="hfLocation">Where will the service happen?</label><input id="hfLocation" placeholder="e.g. Lekki Phase 1, Lagos" value="${esc(state.booking.location)}"></div>
  <div class="hf-notice">A consultation is required before hiring. You can discuss references, milestones and a final quote with the professional.</div>`;
 }else if(state.bookingStep===1){
  body=`<p>These slots are for demonstration only. They do not represent real calendar availability.</p>
  <div class="hf-section-row"><h2>Consultation type</h2></div><div class="hf-picker-row">${["In person","Voice call","Video call"].map(x=>`<button class="${state.booking.mode===x?"on":""}" data-hf="booking-choice" data-field="mode" data-value="${x}">${x}</button>`).join("")}</div>
  <div class="hf-section-row"><h2>Preferred day</h2></div><div class="hf-picker-row">${["Tomorrow","Saturday","Next week"].map(x=>`<button class="${state.booking.day===x?"on":""}" data-hf="booking-choice" data-field="day" data-value="${x}">${x}</button>`).join("")}</div>
  <div class="hf-section-row"><h2>Preferred time</h2></div><div class="hf-picker-row">${["11:30 AM","2:00 PM","5:00 PM"].map(x=>`<button class="${state.booking.time===x?"on":""}" data-hf="booking-choice" data-field="time" data-value="${x}">${x}</button>`).join("")}</div>`;
 }else if(state.bookingStep===2){
  body=`<div class="hf-summary"><div><b>Professional</b><span>${esc(seller.name)}</span></div><div><b>Service</b><span>${esc(l.title)}</span></div><div><b>Starting price</b><span>${money(l.price)}</span></div><div><b>Preferences</b><span>${esc(state.booking.day)} · ${esc(state.booking.time)} · ${esc(state.booking.mode)}</span></div><div><b>Location</b><span>${esc(state.booking.location)}</span></div></div>
 <div class="hf-summary"><b>Requirements</b><p style="font-size:12px;line-height:1.6;overflow-wrap:anywhere">${esc(state.booking.details)}</p></div>
 <div class="hf-notice">Nothing will be sent or charged. In the real app, the professional will confirm the consultation, then a quote/invoice and escrow milestones can follow.</div>`;
 }else{
  return `${head("Consultation","Prototype review",true)}<div class="hf-book-done"><div class="hf-success-circle">✓</div><h2>Request preview complete</h2><p>You've completed the consultation journey. No booking was made, no message was sent, and no money was collected.</p><button class="hf-lime-button" data-hf="chat-after-booking" data-id="${seller.id}">View conversation →</button><div style="height:11px"></div><button class="hf-soft-button" data-hf="escrow-demo">Preview protected payment & milestones →</button><div style="height:11px"></div><button class="hf-soft-button" data-hf="home">Return to Feed</button></div>`;
 }
 return `${head("Consultation","Step "+(state.bookingStep+1)+" of 3 · "+esc(seller.name),true)}<div class="hf-form">${bookingSteps()}<h2>${title}</h2><div class="hf-seller-row"><img src="${seller.avatar}" alt=""><div><b>${esc(seller.name)}</b><small>${esc(l.title)} · From ${money(l.price)}</small></div></div>${body}
 <button class="hf-lime-button" style="width:100%;margin-top:17px" data-hf="booking-next">${state.bookingStep===2?"Finish demo request":"Continue →"}</button>
 ${state.bookingStep>0?'<button class="hf-soft-button" style="width:100%;margin-top:9px" data-hf="booking-prev">← Previous step</button>':""}
 </div>`;
}
function renderInbox(){
 const selected=threads.filter(t=>(state.inboxTab==="All"||t.status===state.inboxTab||(state.inboxTab==="Unread"&&t.unread>0))&&[person(t.person).name,t.last,t.status].join(" ").toLowerCase().includes(state.inboxQuery.toLowerCase()));
 return `${head("Inbox","Conversations, enquiries and requests",false)}<div class="hf-page">
 <div class="hf-searchbox"><span>⌕</span><input id="hfInboxSearch" type="search" placeholder="Search messages..." value="${esc(state.inboxQuery)}" aria-label="Search inbox"/></div>
 <div class="hf-chips" aria-label="Inbox sections">${["All","Unread","Inquiry","Consultation","Order question"].map(x=>`<button data-hf="inbox-tab" data-value="${x}" class="${state.inboxTab===x?"on":""}">${x==="Order question"?"Orders":x==="Inquiry"?"Enquiries":x}</button>`).join("")}</div>
 <p class="hf-subtitle">Demo chats are stored only while this preview is open.</p>
 <div class="hf-inbox-list">${selected.map(t=>`<button class="hf-thread-row" data-hf="thread" data-id="${t.id}"><img src="${person(t.person).avatar}" alt=""><div class="hf-thread-copy"><b>${esc(person(t.person).name)} <span class="hf-verified">✓</span></b><p>${esc(t.last)}</p></div><div class="hf-thread-meta"><span>${esc(t.when)}</span>${t.unread?`<span class="hf-unread">${t.unread}</span>`:""}</div></button>`).join("")||'<div class="hf-empty">No conversations match your filter.</div>'}</div>
 </div>`;
}
function renderChat(){
 const t=threads.find(x=>x.id===state.thread)||threads[0],p=person(t.person),l=item(t.about);
 return `${head(p.name,"Demo conversation · "+p.primary,true,`<button class="hf-icbtn" data-hf="profile" data-id="${p.id}" aria-label="View professional profile">♙</button>`)}
 <div class="hf-chat-scroll" id="hfChatScroll"><div class="hf-chat-date">Demo messages · Not connected to other users</div>
 ${t.messages.map(m=>`<div class="hf-bubble ${m.from==="me"?"out":"in"}">${esc(m.text)}<small>${esc(m.time)}</small></div>`).join("")}
 <div class="hf-chat-attachment"><span style="font-size:23px">✦</span><div><b>${esc(l.title)}</b><small>From ${money(l.price)} · ${l.type}</small></div><button data-hf="listing" data-id="${l.id}">View →</button></div>
 <button class="hf-soft-button" style="width:100%" data-hf="book" data-id="${l.id}">Discuss a consultation →</button></div>
 <form id="hfChatForm" class="hf-chat-input"><input name="message" placeholder="Type a demo message..." maxlength="500" required aria-label="Message"/><button type="submit" aria-label="Send demo message">↑</button></form>`;
}
function renderCart(){
 const subtotal=state.cart.reduce((n,x)=>n+item(x.id).price*x.qty,0);
 return `${head("Your cart","Review products before checkout",true,`<button class="hf-tinybtn" data-hf="market">Continue shopping</button>`)}<div class="hf-page">
 ${state.cart.length?state.cart.map(x=>{const l=item(x.id);return `<div class="hf-cart-row"><img src="${l.img}" alt="${esc(l.title)}"><div><b>${esc(l.title)}</b><small>${esc(x.variant)} · ${esc(person(l.seller).name)}</small><b>${money(l.price*x.qty)}</b><div class="hf-qty"><button data-hf="cart-qty" data-id="${l.id}" data-value="-1">−</button><span>${x.qty}</span><button data-hf="cart-qty" data-id="${l.id}" data-value="1">+</button><button class="hf-link" data-hf="cart-remove" data-id="${l.id}">Remove</button></div></div></div>`}).join("")+
 `<div class="hf-summary"><div><b>Subtotal</b><span>${money(subtotal)}</span></div><div><b>Delivery</b><span>To be agreed</span></div></div><button class="hf-lime-button" style="width:100%" data-hf="checkout">Review checkout →</button><div class="hf-notice">No payment will be made. Product availability and delivery fees are examples only.</div>`:
 `<div class="hf-empty">Your cart is empty. Browse the marketplace and add a sample product.</div><button class="hf-lime-button" data-hf="market" style="width:100%;margin-top:15px">Browse products →</button>`}</div>`;
}
function renderCheckout(){
 if(state.checkoutStep===2)return `${head("Checkout","Simulation",true)}<div class="hf-book-done"><div class="hf-success-circle">✓</div><h2>Checkout preview complete</h2><p>No order was placed and no payment was processed. Your cart is still available in this session.</p><button class="hf-lime-button" data-hf="market">Return to Marketplace →</button></div>`;
 const subtotal=state.cart.reduce((n,x)=>n+item(x.id).price*x.qty,0);
 return `${head("Checkout","Step "+(state.checkoutStep+1)+" of 2 · Demo only",true)}<div class="hf-form"><div class="hf-steps"><span class="on"></span><span class="${state.checkoutStep?"on":""}"></span></div>
 ${state.checkoutStep===0?`<h2>Delivery or collection</h2><p>Enter sample details to see the review page. Don't enter sensitive information.</p>
 <div class="hf-field"><label for="hfCheckoutName">Name</label><input id="hfCheckoutName" maxlength="80" value="${esc(state.checkout.name)}" placeholder="Your name"></div>
 <div class="hf-field"><label for="hfCheckoutLocation">Delivery area</label><input id="hfCheckoutLocation" maxlength="120" value="${esc(state.checkout.location)}" placeholder="e.g. Yaba, Lagos"></div>
 <div class="hf-field"><label for="hfCheckoutNote">Notes (optional)</label><textarea id="hfCheckoutNote" maxlength="280" placeholder="Special instructions">${esc(state.checkout.note)}</textarea></div>`:
 `<h2>Review your order</h2><div class="hf-summary"><div><b>Items</b><span>${state.cart.reduce((n,x)=>n+x.qty,0)}</span></div><div><b>Subtotal</b><span>${money(subtotal)}</span></div><div><b>Delivery area</b><span>${esc(state.checkout.location)}</span></div><div><b>Payment</b><span>Not connected</span></div></div><div class="hf-section-row"><h2>Choose how to pay</h2></div><div class="hf-picker-row">${["Card","Bank transfer","Wallet (demo)"].map(x=>`<button class="${state.checkoutMethod===x?"on":""}" data-hf="checkout-method" data-value="${x}">${x}</button>`).join("")}</div><div class="hf-notice">Payment choice: ${esc(state.checkoutMethod)}. This is a UI demonstration only. No wallet funds are charged, no bank transfer is made, and no real order is submitted.</div>`}
 <button data-hf="checkout-next" class="hf-lime-button" style="width:100%">${state.checkoutStep===0?"Review order →":"Finish checkout preview"}</button></div>`;
}
const categories=["Beauty","Fashion","Creative","Food","Home"];
function createCategoryOptions(selected){
 return categories.map(k=>`<option value="${k}" ${selected===k?"selected":""}>${k}</option>`).join("");
}
function createFormField(name,label,type="text",extra=""){
 const old=state.draftForms[state.draftType]||{};
 const value=old[name]??"";
 const opts=type==="category"?`<select name="${name}" id="hfDraft-${name}">${createCategoryOptions(value||"Creative")}</select>`:
 type==="description"?`<textarea id="hfDraft-${name}" name="${name}" rows="4" maxlength="600" required placeholder="${extra||"Tell people what to expect"}">${esc(value)}</textarea>`:
 type==="price"?`<input name="${name}" id="hfDraft-${name}" type="number" inputmode="numeric" min="1" max="99999999" required value="${esc(value)}" placeholder="${extra||"e.g. 15000"}">`:
 type==="location"?`<input name="${name}" id="hfDraft-${name}" maxlength="120" value="${esc(value||"Lagos")}" placeholder="Neighborhood, city" required>`:
 `<input name="${name}" id="hfDraft-${name}" maxlength="100" value="${esc(value)}" required placeholder="${esc(extra)}">`;
 return `<div class="hf-field"><label for="hfDraft-${name}">${label}</label>${opts}</div>`;
}
function storeDraftForm(){
 const form=layer.querySelector("#hfCreateForm");if(!form)return;
 const draft=state.draftForms[state.draftType]||{};
 form.querySelectorAll("input[name],textarea[name],select[name]").forEach(el=>draft[el.name]=el.value);
 state.draftForms[state.draftType]=draft;
}
function submitCreate(form){
 const d=Object.fromEntries(new FormData(form).entries());
 if(state.draftType==="Post"){
  const caption=String(d.caption||"").trim();if(!caption){notify("Write a caption first");return}
  const media=state.draftFiles,first=media[0];
  samplePosts.unshift({id:"post-you-"+Date.now(),seller:"self",kind:state.draftPostKind.toLowerCase(),
   image:first&&!first.type.startsWith("video/")?first.url:pics.photo,images:media.filter(x=>x.type.startsWith("image/")).map(x=>x.url),
   videoSrc:first?.type.startsWith("video/")?first.url:null,caption,related:d.attach||null,tag:"Everyday",location:d.location||signedIn.location});
  state.draftForms.Post={};state.draftFiles=[];state.ownTab="Posts";go("OwnProfile");
  notify("Demo post created · Not published");return;
 }
 const title=String(d.title||"").trim(),description=String(d.description||"").trim(),category=d.category||"Creative",price=Number(d.price);
 if(title.length<3||description.length<10||!Number.isFinite(price)||price<=0){notify("Enter a title, description and valid amount");return}
 if(state.draftType==="Request"){
  demoRequests.unshift({id:"r-self-"+Date.now(),title,description,category,location:d.location||"Lagos",budget:price});
  state.exploreTab="Requests";state.query="";state.category="All";state.draftForms.Request={};go("Explore");
  notify("Demo request added · Not published");return;
 }
 const type=state.draftType.toLowerCase(),categoryImage={Beauty:pics.barber,Fashion:pics.fashion,Food:pics.meal,Home:pics.house,Creative:pics.flowers};
 const img=state.draftFiles.find(x=>x.type.startsWith("image/"))?.url||categoryImage[category]||pics.photo;
 const id=(type==="product"?"p":type==="service"?"s":"t")+"-self-"+Date.now();
 const listing={id,type,seller:"self",title,category,price,img,photos:[img],description,includes:type==="service"?["Consultation first","Scope and quote agreed before hire"]:type==="product"?["Confirm availability","Agree delivery and payment before fulfilment"]:["Training schedule and contract to be agreed"]};
 if(type==="service"){listing.unit="from";listing.duration="Time agreed at consultation";listing.location=d.location||"Lagos";listing.mode=d.mode||"In person";services.unshift(listing)}
 else if(type==="product"){listing.variants=String(d.variants||"Standard").split(",").map(x=>x.trim()).filter(Boolean).slice(0,8);listing.stock=Number(d.stock)||1;products.unshift(listing)}
 else{listing.duration=d.mode||"In person";training.unshift(listing)}
 allItems.unshift(listing);state.draftForms[state.draftType]={};state.draftFiles=[];
 state.ownTab=type==="service"?"Services":type==="product"?"Products":"Training";go("OwnProfile");
 notify("Demo listing added · Not published");
}
function submitGoLive(form){
 const d=Object.fromEntries(new FormData(form).entries()),title=String(d.title||"").trim();
 if(title.length<4){notify("Choose a title for your Live");return}
 state.liveSetup={title,category:d.category||"Creative",audience:d.audience||"Public",offer:d.offer||""};
 state.liveStarted=true;state.liveComments=[];state.liveHearts=0;push("LiveStudio");
}
function renderCreate(){
 const choices=["Post","Service","Product","Request","Training"];
 let formBody="";
 if(state.draftType==="Post"){
  const d=state.draftForms.Post||{};
  formBody=`<div class="hf-create-type-switch">${["Photo","Video","Carousel"].map(x=>`<button type="button" data-hf="post-kind" data-value="${x}" class="${state.draftPostKind===x?"on":""}">${x==="Video"?"▶":x==="Carousel"?"▧":"▣"} ${x}</button>`).join("")}</div>
  <div class="hf-field"><label for="hfPostCaption">Caption</label><textarea id="hfPostCaption" name="caption" rows="4" maxlength="500" required placeholder="What's the story behind your work?">${esc(d.caption||"")}</textarea></div>
  <div class="hf-create-uploader"><span>↥</span><b>Choose ${state.draftPostKind==="Video"?"a video":state.draftPostKind==="Carousel"?"up to 4 photos":"a photo"} from your device</b><small>Local preview only · Nothing is uploaded</small>
  <input id="hfDraftMedia" type="file" accept="${state.draftPostKind==="Video"?"video/*":"image/*"}" ${state.draftPostKind==="Carousel"?"multiple":""} aria-label="Choose ${state.draftPostKind.toLowerCase()} media"></div>
  ${state.draftFiles.length?`<div class="hf-create-media-preview">${state.draftFiles.map(m=>m.type.startsWith("video/")?`<video src="${m.url}" muted playsinline controls></video>`:`<img src="${m.url}" alt="Selected local media">`).join("")}</div>`:""}
  <div class="hf-field"><label for="hfPostAttach">Attach a service or product (optional)</label><select name="attach" id="hfPostAttach"><option value="">No attached offer</option>${allItems.filter(x=>["service","product"].includes(x.type)).map(x=>`<option value="${x.id}" ${d.attach===x.id?"selected":""}>${esc(x.title)} · ${money(x.price)}</option>`).join("")}</select></div>
  <div class="hf-field"><label for="hfPostLocation">Location (optional)</label><input name="location" id="hfPostLocation" maxlength="100" placeholder="e.g. Yaba, Lagos" value="${esc(d.location||"")}"></div>`;
 }else if(state.draftType==="Service"){
  formBody=`${createFormField("title","Service name","text","e.g. Signature haircut")}
  ${createFormField("category","Category","category")}
  ${createFormField("price","Starting price (₦)","price")}
  ${createFormField("location","Where do you work?","location")}
  <div class="hf-field"><label for="hfServiceMode">Delivery style</label><select name="mode" id="hfServiceMode">${["In person","Online","Both"].map(x=>`<option ${state.draftForms.Service?.mode===x?"selected":""}>${x}</option>`).join("")}</select></div>
  ${createFormField("description","Describe the service and what is included","description")}
  <div class="hf-notice">A consultation will be required before a service hire. Prices are starting prices, not final invoices.</div>`;
 }else if(state.draftType==="Product"){
  formBody=`${createFormField("title","Product name","text","e.g. Handmade accessories")}
  ${createFormField("category","Product category","category")}
  ${createFormField("price","Price (₦)","price")}
  <div class="hf-field"><label for="hfStock">Sample stock quantity</label><input id="hfStock" name="stock" type="number" inputmode="numeric" min="1" max="1000" value="${esc(state.draftForms.Product?.stock||1)}" required></div>
  ${createFormField("description","Product description","description")}
  <div class="hf-field"><label for="hfVariants">Options (comma separated)</label><input id="hfVariants" name="variants" maxlength="130" placeholder="e.g. Small, Medium, Large" value="${esc(state.draftForms.Product?.variants||"Standard")}"></div>
  <div class="hf-notice">Product stock and delivery are simulated. No customer can buy this from your real account.</div>`;
 }else if(state.draftType==="Request"){
  formBody=`${createFormField("title","What do you need?","text","e.g. Photographer for an event")}
  ${createFormField("category","Skill category","category")}
  ${createFormField("price","Budget (₦)","price")}
  ${createFormField("location","Where is the request?","location")}
  ${createFormField("description","Describe the project and timeline","description")}
  <div class="hf-notice">Demo requests will appear under Explore → Requests, not in the real marketplace.</div>`;
 }else{
  formBody=`${createFormField("title","Training or apprenticeship title","text","e.g. Intro to dressmaking")}
  ${createFormField("category","Skill category","category")}
  ${createFormField("price","Sample training fee (₦)","price")}
  <div class="hf-field"><label for="hfTrainMode">Format</label><select id="hfTrainMode" name="mode">${["In person","Online","Hybrid"].map(x=>`<option ${state.draftForms.Training?.mode===x?"selected":""}>${x}</option>`).join("")}</select></div>
  ${createFormField("description","What will learners gain?","description")}
  <div class="hf-notice">This is a preview listing. It does not enroll anyone or create a training contract.</div>`;
 }
 return `${head("Create","Share work, sell, teach or find talent",false,`<button class="hf-create-go-live-btn" data-hf="go-live">● Go Live</button>`)}
 <div class="hf-create-page">
 <div class="hf-create-intro"><button class="hf-tinybtn hf-studio-launch" data-hf="hustler-studio" style="float:right">✳ Hustler Studio →</button><span>CREATE ON HUSTLE</span><h2>What are you making today?</h2><p>Every account can show their work, offer a service, sell something, request help or teach.</p></div>
 <div class="hf-create-tabs" role="tablist" aria-label="Creation types">${choices.map(x=>`<button class="${x===state.draftType?"on":""}" data-hf="draft-type" data-value="${x}" role="tab" aria-selected="${x===state.draftType}"><span>${x==="Post"?"▣":x==="Service"?"✂":x==="Product"?"♧":x==="Request"?"⌕":"✳"}</span>${x}</button>`).join("")}</div>
 <form id="hfCreateForm" class="hf-create-form">
 <div class="hf-create-form-heading"><div><span>NEW ${state.draftType.toUpperCase()}</span><h3>${state.draftType==="Post"?"Tell the story":state.draftType==="Service"?"Offer your skill":state.draftType==="Product"?"List a product":state.draftType==="Request"?"Find someone who can help":"Share what you know"}</h3></div><span class="hf-create-step">Demo only</span></div>
 ${formBody}
 ${["Service","Product","Training"].includes(state.draftType)?`<div class="hf-create-uploader"><span>↥</span><b>Add a listing photo (optional)</b><small>Local demo preview · no upload</small><input id="hfDraftMedia" type="file" accept="image/*" aria-label="Choose listing photo"></div>${state.draftFiles.length?`<div class="hf-create-media-preview"><img src="${state.draftFiles[0].url}" alt="Selected listing photo"></div>`:''}`:''}
 <button type="submit" class="hf-lime-button hf-create-submit">${state.draftType==="Post"?"Add to demo profile":state.draftType==="Request"?"Preview request":"Create demo "+state.draftType.toLowerCase()+" listing"} →</button>
 <p class="hf-demo-footnote">Nothing will be published, charged, booked or uploaded to the real Hustle app.</p></form>
 <div class="hf-create-live-cta"><div><strong>● LIVE STUDIO</strong><h3>Show them the work as it happens.</h3><p>Set up a live room, choose an audience and pin an offer.</p><button data-hf="go-live">Set up Live →</button></div><img src="${pics.food}" alt="Creator at work"></div>
 </div>`;
}
function notify(s){
 const container=phone.querySelector("#toastArea");
 if(container){container.innerHTML=`<div class="toast">${esc(s)}</div>`;clearTimeout(notify.timer);notify.timer=setTimeout(()=>container.innerHTML="",2400)}
}
function openPost(id){state.postSlide=0;push("Post",{post:id})}
function openListing(id){state.photoIndex=0;push("Listing",{item:id})}
function openProfile(id){if(id==="self"){push("OwnProfile");return}push("Profile",{profile:id,profileTab:"Posts"})}
function booking(id){
 const l=item(id);
 if(l.type==="product"){openListing(id);return}
 if(l.type==="training"){openProfile(l.seller);notify("Training enquiries are a demo");return}
 state.bookingStep=0;state.bookingItem=l.id;state.booking={details:"",location:"",mode:"In person",day:"Tomorrow",time:"11:30 AM"};
 push("Booking");
}
function openThread(id){
 let t=threads.find(x=>x.id===id)||threads.find(x=>x.person===id);
 if(!t){
  const creator=person(id),listing=allItems.find(x=>x.seller===creator.id);
  t={id:creator.id,person:creator.id,status:"Inquiry",unread:0,last:"Start a conversation about their work.",when:"Now",about:listing?.id||services[0].id,messages:[]};
  threads.push(t);
 }
 t.unread=0;push("Chat",{thread:t.id});
}
function addCart(id){
 const l=item(id);if(l.type!=="product")return;
 const variant=state.variant[id]||(l.variants?.[0]||"Standard");
 const count=state.quantity[id]||1;const found=state.cart.find(x=>x.id===id&&x.variant===variant);
 if(found)found.qty+=count;else state.cart.push({id,variant,qty:count});
 notify("Added to cart · demo");
 push("Cart");
}
function setNav(name){
 if(name==="Home"){home();return}
 if(name==="Explore"){state.category="All";state.exploreTab="Top";go("Explore");return}
 if(name==="Inbox"){state.inboxTab="All";go("Inbox");return}
 if(name==="Profile"){state.ownTab="Posts";go("OwnProfile");return}
 if(name==="Create"){go("Create");return}
}
function triggerStories(){
 home();
 phone.querySelector('[data-action="openStories"]')?.click();
 phone.querySelector('[data-action="exploreStories"]')?.click();
}
function triggerLive(){
 home();
 const btn=phone.querySelector("[data-join-live]");
 if(btn)btn.click();else notify("Scroll to the Live demonstration in the Feed");
}
phone.addEventListener("click",e=>{
 const btn=e.target.closest("button");
 if(!btn)return;
 if(btn.dataset.homeShop!==undefined){e.preventDefault();e.stopImmediatePropagation();openShopping();return}
 if(btn.dataset.homeCart!==undefined){e.preventDefault();e.stopImmediatePropagation();push("Cart");return}
 if(btn.dataset.homeLive!==undefined){e.preventDefault();e.stopImmediatePropagation();state.liveHubTab="For You";state.liveCategory="All";state.liveSlideId=null;push("LiveHub");return}
 if(btn.closest(".bottom-nav")&&btn.dataset.nav){
  e.preventDefault();e.stopImmediatePropagation();setNav(btn.dataset.nav);return;
 }
 if(btn.closest("#hfFlowLayer"))return;
 if(btn.dataset.profile||btn.dataset.jumpProfile){
  e.preventDefault();e.stopImmediatePropagation();openProfile(btn.dataset.profile||btn.dataset.jumpProfile);return;
 }
 if(btn.dataset.cta){
  const mapping={p1:"s-barber",p2:"s-fashion",p3:"s-photo",p4:"p-meal",p5:"s-interior",v1:"s-floral",live1:"p-meal"};
  e.preventDefault();e.stopImmediatePropagation();openListing(mapping[btn.dataset.cta]||"s-barber");return;
 }
},true);
layer.addEventListener("click",e=>{
 const btn=e.target.closest("button[data-hf]");
 if(!btn)return;
 e.preventDefault();e.stopPropagation();
 const action=btn.dataset.hf,id=btn.dataset.id,value=btn.dataset.value;
 switch(action){
 case "back":back();break;
 case "home":home();break;
 case "explore":setNav("Explore");break;
 case "market":openShopping();break;
 case "market-services":openShopping("Services");break;
 case "market-products":openShopping("Products");break;
 case "market-tab":state.marketTab=value;render();break;
 case "market-search-clear":state.marketSearch="";render();layer.querySelector("#hfMarketSearch")?.focus();break;
 case "market-promo-next":state.marketSlide=(state.marketSlide+1)%3;render();break;
 case "market-promo-prev":state.marketSlide=(state.marketSlide+2)%3;render();break;
 case "explore-tab":if(value==="Stories"){triggerStories()}else if(value==="Live"){push("LiveHub")}else{state.exploreTab=value;render()}break;
 case "cat":state.category=value;render();break;
 case "search-clear":state.query="";render();layer.querySelector("#hfExploreQuery")?.focus();break;
 case "stories":triggerStories();break;
 case "live":push("LiveHub");break;
 case "live-hub":push("LiveHub");break;
 case "go-live":state.liveComments=[];state.liveHearts=0;push("GoLive");break;
 case "live-hub-tab":state.liveHubTab=value;state.liveSlideId=null;render();break;
 case "live-category":state.liveCategory=value;state.liveSlideId=null;render();break;
 case "live-watch":state.liveWatchId=id;state.liveSlideId=id;state.liveComments=[];state.liveHearts=0;state.liveGifts=0;push("LiveWatch");break;
 case "live-preview-like":state.livePreviewLikes.has(id)?state.livePreviewLikes.delete(id):state.livePreviewLikes.add(id);updateLiveReaction(id);break;
 case "live-preview-follow":state.follow.has(id)?state.follow.delete(id):state.follow.add(id);updateLiveFollow(id);break;
 case "live-heart":state.liveHearts++;{const count=layer.querySelector(".hf-live-room-heart small");if(count)count.textContent=String(state.liveHearts);const host=layer.querySelector('[data-hf="live-heart"]');if(host&&state.screen==="LiveStudio")host.textContent="♥ Demo hearts "+state.liveHearts}break;
 case "live-gift":state.liveGifts++;{const count=layer.querySelector(".hf-live-room-gift small");if(count)count.textContent=String(state.liveGifts)}notify("Free demo gift · No charge");break;
 case "live-follow":state.follow.has(id)?state.follow.delete(id):state.follow.add(id);{const button=layer.querySelector('[data-hf="live-follow"]');if(button)button.textContent=state.follow.has(id)?"✓ Following":"+ Join"}break;
 case "live-end":stopCamera();state.liveStarted=false;back();notify("Live simulation ended · No stream created");break;
 case "live-camera":toggleCamera();break;
 case "map-open":state.exploreTab="Map";render();break;
 case "mini-map-pin":openProfile(id);break;
 case "map-locate":mapUseLocation();break;
 case "map-reset":state.mapGPS=null;state.mapSelected=null;if(mapInstance)disposeMap();initializeMapAfterRender();break;
 case "profile":openProfile(id);break;
 case "own":go("OwnProfile");break;
 case "own-edit":push("EditProfile");break;
 case "own-settings":push("Settings");break;
 case "payments":if(window.HustleOperations)window.HustleOperations.open("Wallet");else push("Payments");break;
 case "escrow-demo":window.HustleOperations?.open("NewEscrow");break;
 case "hustler-studio":window.HustleOperations?.open("Hustler");break;
 case "agent-studio":window.HustleOperations?.open("Agent");break;
 case "admin-preview":window.HustleOperations?.open("Admin");break;
 case "orders":push("Orders");break;
 case "finance-tab":state.financeTab=value;render();break;
 case "appearance":phone.classList.toggle("dark");notify("Appearance updated for this preview");break;
 case "notifications":notify("No notifications in this demo");break;
 case "own-tab":state.ownTab=value;render();break;
 case "post-detail":openPost(id);break;
 case "post-photo-next":state.postSlide=(state.postSlide+1)%(postById(state.post).images?.length||1);render();break;
 case "post-photo-prev":state.postSlide=(state.postSlide-1+(postById(state.post).images?.length||1))%(postById(state.post).images?.length||1);render();break;
 case "post-like":state.postLikes.has(id)?state.postLikes.delete(id):state.postLikes.add(id);render();break;
 case "post-save":ownSavedPosts.has(id)?ownSavedPosts.delete(id):ownSavedPosts.add(id);render();break;
 case "post-comment-focus":layer.querySelector("#hfPostCommentInput")?.focus();break;
 case "profile-tab":state.profileTab=value;render();break;
 case "profile-work":{const p=person(state.profile);const listing=allItems.find(x=>x.seller===p.id);if(listing)openListing(listing.id);break}
 case "listing":openListing(id);break;
 case "photo-next":state.photoIndex++;render();break;
 case "photo-prev":state.photoIndex=Math.max(0,state.photoIndex-1);render();break;
 case "save":state.save.has(id)?state.save.delete(id):state.save.add(id);render();break;
 case "share":notify("Share preview · public links are not available yet");break;
 case "message":openThread(id);break;
 case "follow":state.follow.has(id)?state.follow.delete(id):state.follow.add(id);render();break;
 case "profile-hire":{const s=services.find(x=>x.seller===id);if(s)booking(s.id);else openThread(id);break}
 case "book":booking(id);break;
 case "booking-choice":state.booking[btn.dataset.field]=value;render();break;
 case "booking-prev":state.bookingStep=Math.max(0,state.bookingStep-1);render();break;
 case "booking-next":{
  if(state.bookingStep===0){
   const details=layer.querySelector("#hfRequest")?.value.trim()||"";
   const loc=layer.querySelector("#hfLocation")?.value.trim()||"";
   if(details.length<10||!loc){notify("Add a short description and your service location");return}
   state.booking.details=details;state.booking.location=loc;
  }
  state.bookingStep=Math.min(3,state.bookingStep+1);render();break;
 }
 case "chat-after-booking":openThread(id);break;
 case "variant":state.variant[state.item]=value;render();break;
 case "quantity":state.quantity[state.item]=Math.max(1,Math.min(10,(state.quantity[state.item]||1)+Number(value)));render();break;
 case "add-cart":addCart(id);break;
 case "training-interest":openThread(item(id).seller);break;
 case "cart":push("Cart");break;
 case "cart-qty":{const line=state.cart.find(x=>x.id===id);if(line){line.qty=Math.max(0,line.qty+Number(value));state.cart=state.cart.filter(x=>x.qty>0);render()}break}
 case "cart-remove":state.cart=state.cart.filter(x=>x.id!==id);render();break;
 case "checkout":if(!state.cart.length){notify("Add a product first");break}state.checkoutStep=0;push("Checkout");break;
 case "checkout-method":state.checkoutMethod=value;render();break;
 case "checkout-next":{
  if(state.checkoutStep===0){
   const name=layer.querySelector("#hfCheckoutName")?.value.trim()||"",loc=layer.querySelector("#hfCheckoutLocation")?.value.trim()||"";
   if(!name||!loc){notify("Enter a name and delivery area to preview checkout");return}
   state.checkout={name,location:loc,note:layer.querySelector("#hfCheckoutNote")?.value.trim()||""};
  }
  state.checkoutStep=Math.min(2,state.checkoutStep+1);render();break;
 }
 case "thread":openThread(id);break;
 case "inbox-tab":state.inboxTab=value;render();break;
 case "create":setNav("Create");break;
 case "draft-type":storeDraftForm();state.draftType=value;state.draftFiles=[];render();break;
 case "post-kind":storeDraftForm();state.draftPostKind=value;state.draftFiles=[];render();break;
 case "request-create":state.draftType="Request";push("Create");break;
 case "request-open":push("Request",{request:id});break;
 case "request-contact":notify("Response preview · Not sent to any user");break;
 case "draft-preview":notify("Use the Create form's main button to add a demo listing");break;
  default:break;
 }
});
layer.addEventListener("change",e=>{
 if(e.target.id==="hfMarketSort"){state.marketSort=e.target.value;render();return}
 if(e.target.id==="hfDraftMedia"){
  const files=Array.from(e.target.files||[]).slice(0,state.draftType==="Post"&&state.draftPostKind==="Carousel"?4:1);
  const valid=files.filter(f=>(state.draftType==="Post"&&state.draftPostKind==="Video"?f.type.startsWith("video/"):f.type.startsWith("image/"))&&f.size<=30*1024*1024);
  if(!valid.length){notify("Choose an image or video under 30 MB");return}
  storeDraftForm();state.draftFiles=valid.map(f=>({url:URL.createObjectURL(f),type:f.type,name:f.name}));
  render();notify("Selected media stays on this device");return;
 }
 if(e.target.id!=="hfDraftImage")return;
 const file=e.target.files?.[0];
 if(!file)return;
 if(!file.type.startsWith("image/")||file.size>15*1024*1024){notify("Choose an image up to 15 MB");return}
 state.draftImageSrc=URL.createObjectURL(file);
 const existing=layer.querySelector(".hf-draft-photo");
 if(existing)existing.src=state.draftImageSrc;
 else {
  const preview=document.createElement("img");preview.className="hf-draft-photo";preview.src=state.draftImageSrc;preview.alt="Selected photo preview";
  e.target.parentNode.appendChild(preview);
 }
});
layer.addEventListener("input",e=>{
 if(e.target.id==="hfMarketSearch"){
  state.marketSearch=e.target.value;const pos=e.target.selectionStart;render();
  const field=layer.querySelector("#hfMarketSearch");if(field){field.focus();try{field.setSelectionRange(pos,pos)}catch(err){}}
  return;
 }
 if(e.target.id==="hfExploreQuery"){
  state.query=e.target.value;
  const result=layer.querySelector("#hfSearchResults");
  if(result){if(mapInstance)disposeMap();result.innerHTML=mapSearchPreview()+exploreResults();if(state.exploreTab==="Map")initializeMapAfterRender()}
  const presearch=layer.querySelector("#hfMapPresearchHost");
  if(presearch)presearch.innerHTML=state.exploreTab==="Top"&&!state.query.trim()?mapPreSearchCard():"";
 }
 if(e.target.id==="hfInboxSearch"){state.inboxQuery=e.target.value;const active=document.activeElement;const cursor=e.target.selectionStart;render();const search=layer.querySelector("#hfInboxSearch");if(search){search.focus();search.setSelectionRange(cursor,cursor)}}
});
layer.addEventListener("submit",e=>{
 if(e.target.id==="hfCreateForm"){e.preventDefault();submitCreate(e.target);return}
 if(e.target.id==="hfGoLiveForm"){e.preventDefault();submitGoLive(e.target);return}
 if(e.target.id==="hfLiveChatForm"){
  e.preventDefault();const input=e.target.elements.namedItem("message"),msg=input?.value.trim();
  if(msg){
   state.liveComments.push(msg);
   const container=layer.querySelector("#hfLiveMessages");
   if(container){
    const line=document.createElement("p"),name=document.createElement("b");
    name.textContent="You";line.appendChild(name);line.appendChild(document.createTextNode(" "+msg));container.appendChild(line);
    container.scrollTop=container.scrollHeight;
   }
   input.value="";
  }return;
 }
 if(e.target.id==="hfEditProfileForm"){
  e.preventDefault();const f=e.target;
  for(const k of ["name","handle","primary","secondary","location","bio"]){const v=f.elements.namedItem(k)?.value?.trim();if(v)signedIn[k]=v}
  back();notify("Profile updated for this preview session");return;
 }
 if(e.target.id==="hfPostCommentForm"){
  e.preventDefault();const postText=e.target.elements.namedItem("comment")?.value?.trim();
  if(postText){(state.postComments[state.post]??=[]).push(postText);render()}return;
 }
 if(e.target.id!=="hfChatForm")return;
 e.preventDefault();
 const input=e.target.querySelector('[name="message"]');
 const message=input?.value.trim();
 if(!message)return;
 const t=threads.find(x=>x.id===state.thread);
 if(!t)return;
 t.messages.push({from:"me",text:message,time:"Now"});
 t.last=message;t.when="Now";render();
 layer.querySelector(".hf-chat-input input")?.focus();
});
window.HustleFlowsPreview={open:(screen,params)=>push(screen,params),home,people,services,products,postIds:()=>samplePosts.map(p=>p.id)};
})();
