#!/usr/bin/env node
"use strict";
/** UX020 — All Prisma reads in this regression are faked. No network or DB. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const file=path.resolve(__dirname,"../../apps/api/src/search/search.service.ts");
const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  experimentalDecorators:true,emitDecoratorMetadata:false
}}).outputText;
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(output,file);
const SearchService=mod.exports.SearchService;
const stamp=new Date("2026-10-25T10:00:00.000Z");
const owner={
  id:"fixture-user",username:"xpen",displayName:"Web Development",
  bio:"Digital product maker",avatarUrl:null,location:"Lagos, Nigeria",
  emailVerified:true,phoneVerified:false,updatedAt:stamp
};
const profile={
  id:"fixture-profile",status:"PUBLISHED",publishedAt:stamp,updatedAt:stamp,
  headline:"Web developer",primarySkill:"Digital products",secondarySkills:[],
  category:"Digital",professionalSummary:"Professional",yearsExperience:2,user:owner
};
const fields=[];
const clientOwner={
  ...owner,id:"fixture-client",username:"guestmaker",displayName:"Creative Client",
  emailVerified:false,phoneVerified:false
};
const draftProfile={
  ...profile,id:"fixture-client-profile",status:"DRAFT",publishedAt:null,
  headline:"PRIVATE UNPUBLISHED OFFER",primarySkill:"Confidential profession",
  professionalSummary:"PRIVATE DRAFT BIO",category:"Hidden category",user:clientOwner
};
const db={
  user:{findMany:async ({where})=>{
    fields.push({kind:"person",where});
    return [{...owner,professionalProfile:{...profile}}];
  }},
  post:{findMany:async ({where})=>{
    fields.push({kind:"post",where});
    return [{
      id:"fixture-post",status:"PUBLISHED",caption:"Hello from my studio",
      category:"Photography",tags:["photos"],location:"Lagos, Nigeria",
      createdAt:stamp,publishedAt:stamp,media:[],professionalProfile:profile,
      _count:{likes:0,saves:0,comments:0}
    },{
      id:"fixture-client-post",status:"PUBLISHED",caption:"Hello from a creative client",
      category:"Personal updates",tags:[],location:"Lagos, Nigeria",
      createdAt:stamp,publishedAt:stamp,media:[],professionalProfile:draftProfile,
      _count:{likes:0,saves:0,comments:0}
    }];
  }},
  service:{findMany:async ({where})=>{
    fields.push({kind:"service",where});
    return [{
      id:"fixture-service",status:"PUBLISHED",title:"Website Design & Development",
      category:"Digital",description:"Web design",requirements:null,
      availabilityNote:null,deliveryMode:"REMOTE",location:"Lagos, Nigeria",
      priceMinor:150000,publishedAt:stamp,createdAt:stamp,mediaUrls:[],
      professionalProfile:profile
    }];
  }},
  product:{findMany:async ({where})=>{
    fields.push({kind:"product",where});
    return [{
      id:"fixture-product",status:"PUBLISHED",title:"Designer portfolio template",
      category:"Digital",description:"Editable template",type:"DIGITAL",
      deliveryInformation:null,mediaUrls:[],trackInventory:false,
      inventoryQuantity:null,priceMinor:100000,variants:[],
      publishedAt:stamp,createdAt:stamp,professionalProfile:profile
    }];
  }}
};
(async()=>{
  const search=new SearchService(db);
  const all=await search.search(null,"top",{q:"xpen",limit:"12"});
  const byKind=Object.fromEntries(all.items.map(item=>[item.kind,item]));
  assert.deepEqual(new Set(Object.keys(byKind)),new Set(["person","post","service","product"]),
    "handle search must surface published profile, post, service and product");
  assert.equal(byKind.person.url,"/u/xpen");
  assert.equal(byKind.post.url,"/posts/fixture-post");
  assert.equal(byKind.service.url,"/services/fixture-service");
  assert.equal(byKind.product.url,"/products/fixture-product");
  for(const [tab,kind] of [["people","person"],["posts","post"],
    ["services","service"],["products","product"]]){
    const response=await search.search(null,tab,{q:"xpen",limit:"12"});
    assert.equal(response.items.length,1,tab+" should find creator content");
    assert.equal(response.items[0].kind,kind);
  }
  const publicPosts=await search.search(null,"posts",{q:"hello"});
  assert.equal(publicPosts.items.length,2,
    "search must find published client posts even before Hustler activation");
  const clientPost=publicPosts.items.find(item=>item.id==="fixture-client-post");
  assert.ok(clientPost,"published client content must be searchable");
  assert.equal(clientPost.owner.professionalProfile.headline,null,
    "unpublished professional headline must never leak");
  assert.equal(clientPost.owner.professionalProfile.primarySkill,null);
  assert.equal(clientPost.owner.professionalProfile.professionalSummary,null);
  assert.deepEqual(clientPost.owner.professionalProfile.secondarySkills,[]);
  assert.equal((await search.search(null,"top",{q:"PRIVATE UNPUBLISHED OFFER"})).zeroResults,true,
    "draft professional field must not match any public search");
  assert.equal((await search.search(null,"services",{q:"website"})).items[0].kind,"service");
  assert.equal((await search.search(null,"products",{q:"template"})).items[0].kind,"product");
  assert.equal((await search.search(null,"top",{q:"nonexistentzz"})).zeroResults,true);
  const whereByKind=Object.fromEntries(fields.map(x=>[x.kind,x.where]));
  for(const kind of ["post","service","product"]){
    assert.equal(whereByKind[kind].status,"PUBLISHED",kind+" must be publication-gated");
  }
  assert.equal(whereByKind.post.moderationState,"CLEAR",
    "moderated post holds cannot appear in search");
  for(const kind of ["service","product"]){
    assert.equal(whereByKind[kind].professionalProfile.is.status,"PUBLISHED",
      kind+" must require a published Hustler profile");
  }
  console.log("PASS UX020: handle matches all four kinds, public client posts are searchable without leaking draft profile data, and publication gates remain.");
})().catch(err=>{console.error(err);process.exitCode=1;});
