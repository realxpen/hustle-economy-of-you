(function hustleAdaptiveUI(){
"use strict";
const host=document.getElementById("phone");if(!host)return;
const core=()=>window.HustleAdaptive;
const root=document.createElement("section");root.id="hustleAdaptiveLayer";root.className="ha-root";root.hidden=true;host.appendChild(root);
const ui={tab:"Spaces",blueprint:"appointment",orderId:"",opportunityId:"",spaceModal:false,serviceModal:false,requestModal:false,delegateModal:false,workModal:false,showAudit:false,notice:""};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"₦"+Number(n||0).toLocaleString("en-NG");
const tabs=[["Spaces","▦"],["Services","✳"],["Work","▤"],["Requests","⌕"],["Team","♙"],["Trust","◇"]];
function data(){return core()?.getState()}
function label(arr,id){return arr.find(x=>x.id===id)?.label||id}
function notice(text){ui.notice=text;render();const box=root.querySelector(".ha-toast");if(box){box.focus?.();}}
function button(text,action,extra="",type="button"){return '<button type="'+type+'" class="ha-btn '+extra+'" data-ha="'+action+'">'+text+'</button>'}
function formStart(action){return '<form class="ha-form" data-ha-form="'+action+'">'}
function field(name,labelTxt,placeholder,type="text",value=""){return '<label class="ha-field"><span>'+esc(labelTxt)+'</span><input type="'+type+'" name="'+esc(name)+'" placeholder="'+esc(placeholder)+'" value="'+esc(value)+'" required></label>'}
function select(name,labelTxt,items,value){return '<label class="ha-field"><span>'+esc(labelTxt)+'</span><select name="'+name+'">'+items.map(x=>'<option value="'+esc(x[0])+'" '+(value===x[0]?"selected":"")+'>'+esc(x[1])+'</option>').join("")+'</select></label>'}
function section(title,hint=""){return '<div class="ha-section-heading"><h2>'+title+'</h2>'+(hint?'<small>'+hint+'</small>':"")+'</div>'}
function humanCtx(s){const current=s.spaces.find(x=>x.id===s.currentSpace);return current||s.spaces[0]}
function empty(t){return '<div class="ha-empty">'+esc(t)+'</div>'}
function blueprintCard(x,selected){return '<button class="ha-blueprint-card '+(selected?"active":"")+'" data-ha="blueprint" data-id="'+x.id+'"><span>'+x.icon+'</span><div><b>'+esc(x.label)+'</b><small>'+esc(x.description)+'</small></div><i>'+(selected?"✓":"＋")+'</i></button>'}
function renderSpaces(s){
 const active=humanCtx(s),caps=core().capabilities;
 return '<div class="ha-hero"><span>THE ECONOMY OF YOU</span><h2>One identity. Many ways to work.</h2><p>Hire, create, sell, teach, manage and grow without starting over.</p></div>'
 +section("Current context","Separate work, team and financial records")
 +'<div class="ha-current"><small>WORKING AS</small><b>'+esc(active.name)+'</b><span>'+esc(active.type.toUpperCase())+' · '+esc(active.category)+'</span></div>'
 +'<div class="ha-space-list">'+s.spaces.map(x=>'<button class="ha-space '+(s.currentSpace===x.id?"active":"")+'" data-ha="space" data-id="'+esc(x.id)+'"><span class="ha-space-icon">'+(x.type==="personal"?"☺":x.type==="team"?"♧":"▣")+'</span><span><b>'+esc(x.name)+'</b><small>'+esc(x.category)+' · '+esc(x.status)+'</small></span><i>'+(s.currentSpace===x.id?"✓":"→")+'</i></button>').join("")+'</div>'
 +button("＋ Add another business or team","space-form","ha-primary ha-wide")
 +section("What you can do","Enable capabilities independently")
 +'<div class="ha-capabilities">'+caps.map(x=>'<button class="'+(s.person.capabilities.includes(x.id)?"on":"")+'" data-ha="capability" data-id="'+x.id+'"><span>'+x.icon+'</span><b>'+esc(x.label)+'</b><small>'+(s.person.capabilities.includes(x.id)?"Enabled":"Enable")+'</small></button>').join("")+'</div>'
 +'<div class="ha-note">Capabilities personalize the demo. They do not grant real identity verification, business access, agent approval or payment permissions.</div>'
 +(ui.spaceModal?'<div class="ha-inline-form">'+section("New workspace")+formStart("new-space")+field("name","Business, team or brand name","e.g. Kunle Apparel")+select("type","Workspace type",[["business","Business"],["team","Team / agency"]],"business")+field("category","Main field","Fashion, services, commerce")+button("Create workspace","", "ha-primary ha-wide","submit")+'</form></div>':"");
}
function renderServices(s){
 const active=humanCtx(s),bp=core().getBlueprint(ui.blueprint)||core().blueprints[0],own=s.services.filter(x=>x.spaceId===active.id);
 return '<div class="ha-hero slim"><span>ADAPTIVE SERVICE BLUEPRINTS</span><h2>Build the right journey, not another generic form.</h2><p>Combine scheduling, delivery, files, fulfilment and approval only when they apply.</p></div>'
 +section("Service architecture","Choose a starting blueprint")
 +'<div class="ha-blueprints">'+core().blueprints.map(x=>blueprintCard(x,x.id===ui.blueprint)).join("")+'</div>'
 +'<div class="ha-blueprint-preview"><div><span>SELECTED EXPERIENCE</span><h3>'+bp.icon+' '+esc(bp.label)+'</h3><p>'+esc(bp.example)+'</p></div><div class="ha-steps">'+bp.steps.map((x,i)=>'<span><i>'+(i+1)+'</i>'+esc(x)+'</span>').join("")+'</div><div class="ha-feature-list">'+bp.features.map(f=>'<span>'+esc(f)+'</span>').join("")+'</div></div>'
 +button("＋ Create service draft in "+esc(active.name),"service-form","ha-primary ha-wide")
 +(ui.serviceModal?'<div class="ha-inline-form">'+section("New service draft")+formStart("new-service")+field("title","Service title","What do you offer?")+field("price","Starting example price (₦)","5000","number","5000")+button("Save service draft","", "ha-primary ha-wide","submit")+'</form></div>':"")
 +section("Your draft services","Scoped to "+esc(active.name))
 +(own.length?own.map(x=>'<div class="ha-listing"><div><small>'+esc(label(core().blueprints,x.blueprint))+' · DEMO DRAFT</small><b>'+esc(x.title)+'</b><p>'+money(x.price)+' · Not a published listing</p></div><div class="ha-listing-actions"><button data-ha="work-from-service" data-id="'+x.id+'">Try request</button>'+(["barber","laundry","tailor","shoemaker"].includes(x.category)?'<button data-ha="existing-booking" data-id="'+x.id+'">Booking preview</button>':"")+'</div></div>').join(""):empty("No services for this workspace. Start with a blueprint."));
}
function workCard(x){const bp=core().getBlueprint(x.blueprint);return '<button class="ha-work-card" data-ha="work-detail" data-id="'+x.id+'"><div class="ha-work-top"><span>'+esc(bp?.icon||"▤")+' '+esc(bp?.label||x.blueprint)+'</span><em>'+esc(x.state.replaceAll("_"," "))+'</em></div><b>'+esc(x.title)+'</b><small>'+esc(x.provider)+' · '+esc(x.source)+'</small><p>'+esc(x.description||"No details yet")+'</p><div class="ha-work-foot"><span>Version '+x.version+' · Payment: '+esc(x.paymentStatus.replaceAll("_"," "))+'</span><strong>View →</strong></div></button>'}
function renderWork(s){
 const active=humanCtx(s),orders=s.orders.filter(x=>x.spaceId===active.id),work=s.orders.find(x=>x.id===ui.orderId&&x.spaceId===active.id);
 let detail="";
 if(work){
 const next=core()._test.allowedTransitions[work.state]||[],delegates=s.grants.filter(x=>x.spaceId===active.id&&x.state==="demo_approved"&&x.permissions.includes("work.manage"));
 detail='<div class="ha-panel"><div class="ha-detail-head"><h3>'+esc(work.title)+'</h3><span>'+esc(work.state)+'</span></div><p>'+esc(work.description)+'</p><small>Work order '+esc(work.id)+' · agreement v'+work.agreementVersion+' · last update v'+work.version+'</small>'
 +'<div class="ha-status-steps">'+work.steps.map((x,i)=>'<div><i>✓</i><span>'+esc(x.state.replaceAll("_"," "))+'</span><small>'+esc(x.by)+'</small></div>').join("")+'</div>'
 +'<div class="ha-actions">'+next.map(x=>'<button data-ha="advance" data-id="'+work.id+'" data-value="'+x+'">'+esc(x.replaceAll("_"," "))+'</button>').join("")+'</div>'
 +(delegates.length?'<label class="ha-field"><span>Authorized assistant</span><select id="ha-assign"><option value="">Choose delegated person</option>'+delegates.map(x=>'<option value="'+x.id+'">'+esc(x.displayName)+'</option>').join("")+'</select></label>'+button("Assign scoped work","assign","ha-outline"):"")
 +(work.state==="completed"?'<div class="ha-inline-form">'+section("Add completion evidence")+formStart("new-evidence")+field("title","Evidence label","e.g. Finished outfit photo")+field("description","What was delivered?","Describe proof and consent")+button("Add claim to history","", "ha-primary","submit")+'</form><small>Self-reported in preview. Not verified customer evidence.</small></div>':"")
 +'<div class="ha-note">This work ledger is a UI simulation. No payment is collected or released, and updates are not persisted.</div></div>';
 }
 return '<div class="ha-hero slim"><span>UNIVERSAL WORK HUB</span><h2>One record. Every stage of the job.</h2><p>Keep requests, scopes, delivery, delegated work and evidence connected.</p></div>'+section("Work in "+esc(active.name))
 +(orders.length?'<div class="ha-work-list">'+orders.map(workCard).join("")+'</div>':empty("No work records in this workspace."))
 +detail
 +button("＋ Add an example work request","work-form","ha-outline ha-wide")
 +(ui.workModal?'<div class="ha-inline-form">'+section("New example request")+formStart("new-work")+field("title","What needs to be done?","e.g. Five graduation outfits")+select("blueprint","Type of work",core().blueprints.map(x=>[x.id,x.label]),ui.blueprint)+field("description","Requirements","Briefly describe the work")+button("Create work record","", "ha-primary ha-wide","submit")+'</form></div>':"");
}
function renderRequests(s){
 const opp=s.opportunities.find(x=>x.id===ui.opportunityId)||s.opportunities[0],matches=opp?core().suggestOpportunity(opp.id):[];
 return '<div class="ha-hero slim"><span>NEED → OPPORTUNITY</span><h2>Describe what you need.</h2><p>Not everyone knows which skill to search for. One request can connect several services.</p></div>'
 +button("＋ Describe a new need","request-form","ha-primary ha-wide")
 +(ui.requestModal?'<div class="ha-inline-form">'+section("Create a draft request")+formStart("new-request")+field("title","What are you trying to accomplish?","e.g. Prepare for a wedding")+field("description","Tell us what you need","Mention services, deadlines, references, or constraints")+select("category","Main workflow",core().blueprints.map(x=>[x.id,x.label]),"event")+field("location","Area (optional; general only)","e.g. Yaba, Lagos")+field("budget","Estimated budget (₦)","Optional","number","0")+button("Create opportunity","", "ha-primary ha-wide","submit")+'</form></div>':"")
 +section("Your opportunity drafts","No outreach is sent")
 +'<div class="ha-opp-list">'+s.opportunities.map(x=>'<button data-ha="opportunity" data-id="'+x.id+'" class="'+(opp?.id===x.id?"selected":"")+'"><strong>'+esc(x.title)+'</strong><small>'+esc(x.category)+' · '+esc(x.status)+'</small></button>').join("")+'</div>'
 +(opp?'<div class="ha-panel"><span class="ha-mini-title">INTENT BREAKDOWN · EXAMPLE</span><h3>'+esc(opp.title)+'</h3><p>'+esc(opp.description)+'</p><div class="ha-feature-list">'+opp.services.map(x=>'<span>'+esc(x)+'</span>').join("")+'</div><p>Possible workflow: '+esc(label(core().blueprints,opp.category))+'</p>'
 +(matches.length?section("Matching sample services")+matches.map(x=>'<div class="ha-match"><b>'+esc(x.title)+'</b><small>'+esc(x.provider)+'</small><button data-ha="match-work" data-id="'+x.serviceId+'">Make work draft</button></div>').join(""):'<div class="ha-note">No sample listing matches exactly. In production this would query eligible providers by requirements, availability, distance, verified skills and consent.</div>')
 +'</div>':empty("Describe a need to see its suggested service breakdown."));
}
function renderTeam(s){
 const active=humanCtx(s),grants=s.grants.filter(x=>x.spaceId===active.id);
 return '<div class="ha-hero slim"><span>RELATIONSHIPS & DELEGATION</span><h2>Assistance without losing control.</h2><p>Choose exactly what an agent or teammate may manage for this workspace.</p></div>'
 +section("Owner controls","'+esc(active.name)+'")
 +'<div class="ha-permission-safety"><strong>Protected actions stay private</strong><p>Identity verification, payout changes, withdrawals, escrow release and granting further access cannot be delegated through this preview.</p></div>'
 +button("＋ Request agent or team access","delegate-form","ha-primary ha-wide")
 +(ui.delegateModal?'<div class="ha-inline-form">'+section("Scoped invitation")+formStart("new-delegate")+field("name","Agent or teammate's name","e.g. Samuel — assistant")+'<span class="ha-mini-title">ALLOWED PERMISSIONS</span><div class="ha-checkboxes">'+core().permissions.map((p,i)=>'<label><input type="checkbox" name="permission" value="'+p.id+'" '+(i<2?"checked":"")+'><span>'+esc(p.label)+'</span></label>').join("")+'</div>'+button("Save consent request","", "ha-primary ha-wide","submit")+'<small>The invited person must explicitly accept in the real product. No invitation is sent here.</small></form></div>':"")
 +section("Delegation requests","Scope can be revoked")
 +(grants.length?grants.map(g=>'<div class="ha-grant"><div><b>'+esc(g.displayName)+'</b><small>'+esc(g.state.replaceAll("_"," "))+'</small></div><div class="ha-feature-list">'+g.permissions.map(x=>'<span>'+esc(label(core().permissions,x))+'</span>').join("")+'</div><div class="ha-actions">'+(g.state==="pending_consent"?'<button data-ha="consent" data-id="'+g.id+'">Simulate explicit consent</button>':"")+(g.state!=="revoked"?'<button data-ha="revoke" data-id="'+g.id+'">Revoke</button>':"")+'</div></div>').join(""):empty("No access granted to agents or team members."))
 +'<div class="ha-note">Consent here is strictly a demonstration. The live system must authenticate both parties, enforce scopes server-side and keep an immutable audit record.</div>';
}
function renderTrust(s){
 const active=humanCtx(s),evidence=s.evidence.filter(x=>x.spaceId===active.id),orders=s.orders.filter(x=>x.spaceId===active.id&&x.state==="completed");
 return '<div class="ha-hero slim"><span>EVIDENCE & REPUTATION</span><h2>Your work should speak for itself.</h2><p>Distinguish personal history, business outcomes and verified customer feedback.</p></div>'
 +'<div class="ha-trust-metrics"><div><b>'+orders.length+'</b><small>Completed demo jobs</small></div><div><b>'+evidence.length+'</b><small>Evidence claims</small></div><div><b>0</b><small>Verified reviews</small></div></div>'
 +section("Work evidence","For "+esc(active.name))
 +(evidence.length?evidence.map(x=>'<div class="ha-evidence"><span>◇</span><div><b>'+esc(x.title)+'</b><small>'+esc(x.level.replaceAll("_"," "))+' · '+esc(x.created)+'</small><p>'+esc(x.description)+'</p></div></div>').join(""):empty("Completed jobs can attach self-reported evidence."))
 +section("Trust principles")
 +'<div class="ha-principles"><p><b>Separate reputations.</b> Personal results belong to the person; business transaction records belong to the business.</p><p><b>Explainable verification.</b> A self-uploaded photo is not the same as customer-confirmed completion.</p><p><b>Appeals and reporting.</b> Disputed work remains reviewable and is not silently converted into positive reputation.</p></div>'
 +button("View audit history","audit-toggle","ha-outline ha-wide")
 +(ui.showAudit?'<div class="ha-audit">'+s.audit.slice(0,16).map(x=>'<p><b>'+esc(x.action)+'</b> · '+esc(x.subject)+' <small>'+esc(x.at.slice(0,16))+'</small></p>').join("")+'</div>':"")
 +'<div class="ha-note">All badges and evidence here are sample labels, not verified customer ratings or KYC results.</div>';
}
function render(){
 const m=core();if(root.hidden||!m)return;
 const s=data(),space=humanCtx(s);
 const output=ui.tab==="Spaces"?renderSpaces(s):ui.tab==="Services"?renderServices(s):ui.tab==="Work"?renderWork(s):ui.tab==="Requests"?renderRequests(s):ui.tab==="Team"?renderTeam(s):renderTrust(s);
 root.innerHTML='<header class="ha-header"><button data-ha="close" aria-label="Close adaptive hub">←</button><div><small>HUSTLE · ADAPTIVE PREVIEW</small><h1>Your economy<span>.</span></h1></div><button class="ha-context" data-ha="tab" data-value="Spaces" aria-label="Change workspace">'+esc(space.name)+' ▾</button></header>'
 +'<div class="ha-demo-warning">Interactive concept · Local demo records only. No real accounts, customer outreach or payments.</div>'
 +'<div class="ha-tabs" role="tablist">'+tabs.map(x=>'<button data-ha="tab" data-value="'+x[0]+'" class="'+(ui.tab===x[0]?"on":"")+'" role="tab" aria-selected="'+(ui.tab===x[0])+'"><span>'+x[1]+'</span>'+x[0]+'</button>').join("")+'</div>'
 +'<div class="ha-body">'+output+'</div>'
 +(ui.notice?'<div class="ha-toast" role="status" tabindex="-1">'+esc(ui.notice)+'<button data-ha="notice-clear" aria-label="Dismiss">×</button></div>':"");
 root.scrollTop=0;
}
function close(){root.hidden=true;root.innerHTML="";host.classList.remove("ha-open");ui.notice=""}
function open(tab="Spaces"){
 ui.tab=tabs.some(x=>x[0]===tab)?tab:"Spaces";ui.notice="";root.hidden=false;host.classList.add("ha-open");render()
}
function val(form,name){return new FormData(form).get(name)}
function onSubmit(e){
 const f=e.target.closest("form[data-ha-form]");if(!f)return;e.preventDefault();const m=core(),type=f.dataset.haForm;
 if(type==="new-space"){const result=m.createSpace(val(f,"name"),val(f,"type"),val(f,"category"));if(!result){notice("Check the workspace name and type");return}m.switchSpace(result.id);ui.spaceModal=false;notice("New draft workspace created — demo only");return}
 if(type==="new-service"){const result=m.makeService(val(f,"title"),ui.blueprint,Number(val(f,"price")));if(!result){notice("Check service name and price");return}ui.serviceModal=false;notice("Service draft saved in this workspace");return}
 if(type==="new-work"){const result=m.newWork(val(f,"title"),val(f,"blueprint"),val(f,"description"));if(!result){notice("Please provide a title and short description");return}ui.orderId=result.id;ui.workModal=false;notice("Work request draft created");return}
 if(type==="new-request"){const desc=val(f,"description")||"";const result=m.createOpportunity(val(f,"title"),desc,val(f,"category"),val(f,"location"),Number(val(f,"budget")));if(!result){notice("Describe your need in at least 12 characters");return}ui.opportunityId=result.id;ui.requestModal=false;notice("Opportunity drafted — no outreach sent");return}
 if(type==="new-delegate"){const perms=[...f.querySelectorAll('input[name="permission"]:checked')].map(x=>x.value);const result=m.requestDelegation(m.currentSpace().id,val(f,"name"),perms);if(!result){notice("Enter a name and select at least one allowed permission");return}ui.delegateModal=false;notice("Scoped invitation drafted — awaiting consent");return}
 if(type==="new-evidence"){const evi=m.attachEvidence(ui.orderId,val(f,"title"),val(f,"description"));if(!evi){notice("Evidence requires a completed work record");return}notice("Self-reported evidence attached to completed work");return}
}
function onClick(e){
 const target=e.target.closest("[data-ha]");if(!target||!root.contains(target))return;
 const action=target.dataset.ha,id=target.dataset.id||"",value=target.dataset.value||"",m=core(),s=data();
 if(action==="close"){close();return}
 if(action==="tab"){ui.tab=value;ui.notice="";render();return}
 if(action==="space"){if(!m.switchSpace(id)){notice("No access to that business");return}ui.orderId="";notice("Switched workspace context");return}
 if(action==="capability"){m.addCapability(id);notice("Capability enabled in demo");return}
 if(action==="space-form"){ui.spaceModal=!ui.spaceModal;render();return}
 if(action==="service-form"){ui.serviceModal=!ui.serviceModal;render();return}
 if(action==="work-form"){ui.workModal=!ui.workModal;render();return}
 if(action==="request-form"){ui.requestModal=!ui.requestModal;render();return}
 if(action==="delegate-form"){ui.delegateModal=!ui.delegateModal;render();return}
 if(action==="blueprint"){ui.blueprint=id;render();return}
 if(action==="work-detail"){ui.orderId=id;render();return}
 if(action==="opportunity"){ui.opportunityId=id;render();return}
 if(action==="advance"){
  const order=s.orders.find(x=>x.id===id);
  if(!order||!m.advanceWork(id,value,order.version)){notice("That transition is not allowed or the record changed");return}
  notice("Work advanced to "+value.replaceAll("_"," ")+" · demo");return
 }
 if(action==="work-from-service"){
  const x=s.services.find(y=>y.id===id);if(!x)return;
  const work=m.newWork("Request: "+x.title,x.blueprint,"Client has requested a service example",x.spaceId,"service listing",x.id);
  if(!work){notice("Unable to draft example request");return}ui.orderId=work.id;ui.tab="Work";notice("Service connected to a new work record");return
 }
 if(action==="existing-booking"){
  const x=s.services.find(y=>y.id===id);if(!x)return;
  const workspace=s.spaces.find(z=>z.id===x.spaceId);
  close();window.HustleJourneys?.open("BookingJourney",{service:x.title,professional:workspace?.name||"Demo professional",category:x.category,price:x.price});return
 }
 if(action==="match-work"){
  const x=s.services.find(y=>y.id===id);if(!x)return;
  const work=m.newWork("Enquiry: "+x.title,x.blueprint,"Draft based on opportunity discovery",m.currentSpace().id,"opportunity",x.id);
  if(!work){notice("Couldn't create that draft");return}ui.orderId=work.id;ui.tab="Work";notice("Draft only — no message was sent to the professional");return
 }
 if(action==="consent"){if(!m.consentDelegation(id)){notice("Consent cannot be confirmed");return}notice("Demo consent confirmed; no account access was granted");return}
 if(action==="revoke"){if(!m.revokeDelegation(id)){notice("Unable to revoke request");return}notice("Demo delegation revoked");return}
 if(action==="assign"){
  const grant=root.querySelector("#ha-assign")?.value;
  if(!m.assignWork(ui.orderId,grant)){notice("Select an authorized assistant with work permissions");return}notice("Demo assignment recorded");return
 }
 if(action==="audit-toggle"){ui.showAudit=!ui.showAudit;render();return}
 if(action==="notice-clear"){ui.notice="";render();return}
}
root.addEventListener("click",onClick);
root.addEventListener("submit",onSubmit);
window.HustleAdaptiveUI={open,close,getState:()=>({tab:ui.tab,opened:!root.hidden,activeSpace:core()?.currentSpace()?.name}),_testing:{root,ui,render,onClick,onSubmit}};
})();