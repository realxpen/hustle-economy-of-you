/* Identity setup formatting and suggestion logic; server owns availability. */
(function(root){
"use strict";
function normalize(value){
 return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g,"").slice(0,25);
}
function valid(handle){
 return /^[a-z0-9._]{3,30}$/.test(handle)&&!handle.startsWith(".")&&
  !handle.endsWith(".")&&!handle.includes("..");
}
function suggestions(name,handle=""){
 const words=String(name||"").normalize("NFKD").toLowerCase()
  .split(/\s+/).map(normalize).filter(Boolean);
 const first=words[0]||"hustler",last=words.at(-1)||"";
 const seed=normalize(handle)||first;
 const options=[first+(last||"hq"),last+first,first+"creates",seed+"hq",seed+"works",seed+"ng"];
 return [...new Set(options.map(x=>x.slice(0,25)).filter(valid))].slice(0,5);
}
async function compress(file){
 if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>12*1024*1024)
  throw new Error("Choose a JPG, PNG or WebP photo under 12 MB.");
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();
  img.decoding="async";
  img.src=url;
  await img.decode();
  const side=Math.max(img.naturalWidth,img.naturalHeight);
  if(!side||side>12000)throw new Error("Invalid image size");
  const ratio=Math.min(1,512/side);
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Image processing is unavailable on this device");
  context.drawImage(img,0,0,canvas.width,canvas.height);
  for(const quality of [.8,.6,.42]){
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
   if(blob?.type==="image/webp"&&blob.size<=256*1024)return blob;
  }
  throw new Error("This photo is too detailed. Try a smaller image.");
 }finally{URL.revokeObjectURL(url)}
}
root.HustleAccountSetup=Object.freeze({normalize,valid,suggestions,compress});
})(window);
