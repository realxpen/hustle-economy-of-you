/* Render username and optional profile-photo steps in the approved V1 shell. */
(function(root){
"use strict";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function username(name,handle,check,busy){
 const suggested=root.HustleAccountSetup?.suggestions(name,handle)||[];
 const current=String(handle||"").trim().toLowerCase();
 const status=busy?"Checking availability…":check?.username===current?
  check.available?"✓ Available":"Not available — choose another name":
  "Enter a username to check live availability";
 const statusClass=check?.username===current&&!busy?(check.available?"available":"unavailable"):"";
 return '<section class="hj-username-step"><div class="hj-username-intro">Your unique identity on Hustle</div>'+
  '<label class="hj-username-label" for="hj-handle">Username</label>'+
  '<div class="hj-handle-wrap"><span aria-hidden="true">@</span>'+
  '<input id="hj-handle" name="handle" required minlength="3" maxlength="30" pattern="[a-zA-Z0-9._]+" autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="chooseyourhandle" value="'+esc(handle)+'"></div>'+
  '<p class="hj-username-status '+statusClass+'" id="hjUsernameStatus" role="status" aria-live="polite">'+esc(status)+'</p>'+
  '<div class="hj-username-suggestions" id="hjUsernameSuggestions">'+suggested.map(v=>
    '<button type="button" data-hj="username-suggest" data-value="'+esc(v)+'">@'+esc(v)+'</button>'
   ).join("")+'</div>'+
  '<p class="hj-picker-footnote">3–30 letters, numbers, dots and underscores. Suggestions are not reserved until saved.</p></section>';
}
function photo(url,saved,busy,error){
 const safeUrl=String(url||"");
 const src=/^(blob:|https:\/\/)/i.test(safeUrl)?safeUrl:"";
 return '<section class="hj-photo-step"><label class="hj-photo-circle" for="hjAvatarFile" aria-label="Choose profile photo">'+
  (src?'<img alt="Your selected profile picture" src="'+esc(src)+'">':'<span aria-hidden="true" class="hj-photo-face">☺</span>')+
  '<span class="hj-photo-add" aria-hidden="true">＋</span></label>'+
  '<input class="hj-photo-input" id="hjAvatarFile" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo">'+
  '<h3>'+(busy?'Uploading…':saved?'Photo saved':'Add a profile photo')+'</h3>'+
  '<p>A clear picture helps people recognize you. This step is optional.</p>'+
  (error?'<p class="hj-photo-error" role="alert">'+esc(error)+'</p>':'')+
  (!saved?'<small>Photo uploads require isolated storage. An unsaved preview stays on this device; you can skip.</small>':'<small>Saved to your isolated test profile.</small>')+
  '</section>';
}
root.HustleIdentityUI=Object.freeze({username,photo});
})(window);
