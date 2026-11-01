/* V1 onboarding selectors. Keep existing Hustle typography/colors and layout. */
(function(root){
"use strict";
const catalog=root.HustleOnboardingPickers;
if(!catalog)return;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const option=([name,category])=>'<button type="button" class="hj-skill-option" data-hj="skill-select" data-value="'+esc(name)+'" aria-label="Choose '+esc(name)+'"><span>'+esc(name)+'</span><small>'+esc(category)+'</small><b aria-hidden="true">＋</b></button>';
function skillsList(query){
 const results=catalog.findSkills(query,18);
 return results.length?results.map(x=>option([x.name,x.category])).join(""):
  '<p class="hj-picker-empty">No matching skill yet. Try a broader term, such as “Hair”, “Repair” or “Design”.</p>';
}
function skills(current,query){
 const picked=current?'<div class="hj-picker-selection"><span>✓ '+esc(current)+'</span><button type="button" data-hj="skill-clear" aria-label="Clear selected skill">×</button></div>':"";
 return '<section class="hj-picker-block"><div class="hj-picker-title"><span>✳</span><div><b>Primary skill</b><small>What can you do or want to offer?</small></div></div>'+
 picked+'<label class="hj-picker-search"><span class="hj-sr-only">Search for a primary skill</span>'+
 '<input type="search" id="hj-skill-query" autocomplete="off" placeholder="Search skills e.g. Barbering, Tailoring…" value="'+esc(query)+'" aria-controls="hjSkillResults"></label>'+
 '<div class="hj-skill-list" id="hjSkillResults" aria-live="polite">'+skillsList(query)+'</div>'+
 '<p class="hj-picker-footnote">Choose one primary skill. This never automatically grants a verified Hustler role.</p></section>';
}
function chips(selected,expanded){
 const items=expanded?catalog.interests:catalog.interests.slice(0,18);
 return items.map(x=>{
  const on=selected.includes(x.name);
  return '<button type="button" class="hj-interest-chip'+(on?' selected':'')+'" data-hj="interest-toggle" data-value="'+esc(x.name)+'" aria-pressed="'+on+'"><span aria-hidden="true">'+x.icon+'</span>'+esc(x.name)+(on?' <b>✓</b>':'')+'</button>';
 }).join("");
}
function interests(selected,expanded){
 return '<section class="hj-picker-block"><div class="hj-picker-title"><span>♡</span><div><b>Your interests</b><small>What do you enjoy seeing and learning about?</small></div></div>'+
 '<p class="hj-picker-footnote">Interests personalize your discovery feed. They are separate from your professional skill.</p>'+
 '<div class="hj-interest-chips" id="hjInterestChips">'+chips(selected,expanded)+'</div>'+
 '<button class="hj-show-all" type="button" data-hj="interest-show-all">'+(expanded?'Show fewer':'Show all interests')+' →</button>'+
 '<div class="hj-interest-footer"><span>'+selected.length+'/'+catalog.interestLimit+' selected</span><small>Choose any number, or skip for now</small></div></section>';
}
function areaResults(query){
 const results=catalog.findAreas(query,11);
 const existing=results.some(x=>x.label.toLowerCase()===query.trim().toLowerCase());
 const own=query.trim().length>=3&&query.trim().length<=100&&/^[\p{L}\p{N} ,.'()/-]+$/u.test(query.trim());
 const rows=results.map(x=>'<button type="button" class="hj-area-result" data-hj="area-select" data-value="'+esc(x.label)+'"><span aria-hidden="true">⌖</span><div><b>'+esc(x.label)+'</b><small>Approximate area · Nigeria</small></div><span aria-hidden="true">→</span></button>').join("");
 return rows+(own&&!existing?'<button type="button" class="hj-area-result" data-hj="area-select" data-value="'+esc(query.trim())+'"><span aria-hidden="true">＋</span><div><b>Use '+esc(query.trim())+'</b><small>Area not in suggestions · confirm spelling</small></div></button>':"")+
 (!rows&&!own?'<p class="hj-picker-empty">Try a town or neighbourhood, or enter your own area.</p>':"");
}
function area(label,query,showMap){
 const selected=label?'<div class="hj-area-selected"><span>⌖</span><div><b>'+esc(label)+'</b><small>Your selected general area, not your exact address</small></div><button type="button" data-hj="area-clear" aria-label="Clear selected area">×</button></div>':"";
 const map=label&&catalog.previewMap(label)?'<button type="button" class="hj-map-optin" data-hj="area-map-toggle">'+(showMap?'Hide map':'Preview this area on a map')+' ↗</button>'+
 (showMap?'<div class="hj-map-preview"><iframe loading="lazy" referrerpolicy="no-referrer" title="OpenStreetMap preview of your selected general area" src="'+catalog.previewMap(label)+'"></iframe><small>Approximate locality only. Map tiles load from OpenStreetMap only when you choose to preview.</small></div>':""):'';
 return '<section class="hj-picker-block"><div class="hj-picker-title"><span>⌖</span><div><b>Choose your area</b><small>Find people and services relevant to you</small></div></div>'+
 selected+'<label class="hj-picker-search"><span class="hj-sr-only">Search town, city or neighbourhood</span><input type="search" id="hj-area-query" value="'+esc(query)+'" autocomplete="address-level2" placeholder="Search e.g. Yaba, Ikeja, Abuja…" aria-controls="hjAreaResults"></label>'+
 '<div class="hj-area-list" id="hjAreaResults" aria-live="polite">'+areaResults(query)+'</div>'+map+
 '<div class="hj-location-permission"><div><b>Use my location</b><small>Optional. We only select a nearby general area—never save your GPS coordinates.</small></div>'+
 '<button type="button" data-hj="area-geolocate">Allow location</button></div>'+
 '<p class="hj-picker-footnote">You can also skip this step and change your location later. No automatic location permission request.</p></section>';
}
root.HustleOnboardingUI=Object.freeze({skills,skillsList,interests,area,areaResults});
})(window);
