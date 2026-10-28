"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMarketplacePage, getSearchPage, type PublicOwner, type SearchResult } from "../../lib/search";
import styles from "./search.module.css";

// These are SEARCH PROMPTS, not an assertion that a provider exists.
const promptTerms = [
  "Artist", "Apprenticeship", "Artisan", "Barber", "Beauty",
  "Catering", "Cleaning", "Digital marketing", "Electrician",
  "Fashion designer", "Hair stylist", "Home repairs",
  "Makeup artist", "Photography", "Plumber", "Tailor", "Web developer"
];

function heading(item:SearchResult):string{
  if(item.kind==="person") return item.person.displayName ?? item.person.username ?? "Hustler";
  if(item.kind==="post") return item.post.caption ?? item.post.category ?? "Published post";
  if(item.kind==="service") return item.service.title ?? "Published service";
  return item.product.title ?? "Published product";
}
function ownerOf(item:SearchResult):PublicOwner {
  return item.kind==="person" ? item.person : item.owner;
}

export function ExploreTypeahead({value,visible,onChoose,onDismiss}:{
  value:string;visible:boolean;onChoose:(term:string)=>void;onDismiss:()=>void;
}){
  const [recent,setRecent]=useState<string[]>([]);
  const [matches,setMatches]=useState<SearchResult[]>([]);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    try {
      const saved=JSON.parse(sessionStorage.getItem("hustle-search-recent")??"[]") as unknown;
      if(Array.isArray(saved))setRecent(saved.filter((s):s is string=>typeof s==="string").slice(0,5));
    }catch{/* session storage may be disabled */}
  },[]);
  useEffect(()=>{
    if(!visible)return;
    try{
      const saved=JSON.parse(sessionStorage.getItem("hustle-search-recent")??"[]") as unknown;
      if(Array.isArray(saved))setRecent(saved.filter((x):x is string=>typeof x==="string").slice(0,5));
    }catch{}
  },[visible]);
  useEffect(()=>{
    const term=value.trim();
    if(!visible || term.length<2){setMatches([]);setLoading(false);return;}
    let cancelled=false;
    setLoading(true);
    const timer=window.setTimeout(()=>{
      void getSearchPage("top",{q:term,limit:6})
        .then(page=>{if(!cancelled)setMatches(page.items);})
        .catch(()=>{if(!cancelled)setMatches([]);})
        .finally(()=>{if(!cancelled)setLoading(false);});
    },280);
    return ()=>{cancelled=true;window.clearTimeout(timer);};
  },[value,visible]);
  const prefix=value.trim().toLowerCase();
  const prompts=useMemo(()=>[...recent.filter(s=>s.toLowerCase().includes(prefix)),
    ...promptTerms.filter(s=>s.toLowerCase().startsWith(prefix))]
    .filter((item,index,array)=>array.findIndex(x=>x.toLowerCase()===item.toLowerCase())===index).slice(0,5),
    [prefix,recent]);
  if(!visible)return null;
  function select(term:string){
    const history=[term,...recent.filter(s=>s.toLowerCase()!==term.toLowerCase())].slice(0,5);
    setRecent(history);
    try{sessionStorage.setItem("hustle-search-recent",JSON.stringify(history));}catch{}
    onChoose(term);
  }
  return <section className={styles.suggestionPanel} id="hustle-explore-suggestions"
      aria-label="Search suggestions">
    {prompts.length>0 && <div className={styles.suggestionSection}>
      <div className={styles.suggestionHeading}><strong>{prefix?"Suggested searches":"Recent and suggested"}</strong>
        {!prefix && recent.length>0 && <button type="button" onClick={()=>{
          setRecent([]);try{sessionStorage.removeItem("hustle-search-recent");}catch{}
        }}>Clear recent</button>}</div>
      {prompts.map(term=><button key={term} type="button" className={styles.suggestionRow}
        onClick={()=>select(term)}>
        <span aria-hidden="true">⌕</span><span>{term}</span><span aria-hidden="true">↗</span>
      </button>)}
    </div>}
    {prefix.length>=2 && <div className={styles.suggestionSection}>
      <div className={styles.suggestionHeading}><strong>People, posts & offers</strong><span>{loading?"Searching…":"Published on Hustle"}</span></div>
      {matches.map(item=><Link key={item.kind+"-"+item.id} className={styles.suggestionRow}
        href={item.url??"/search"} onClick={onDismiss}>
        <span className={styles.suggestionKind}>{item.kind}</span>
        <span>{heading(item)}</span><span aria-hidden="true">↗</span>
      </Link>)}
      {!loading && !matches.length && <p className={styles.suggestionHint}>No published suggestions yet. Try the full search or a broader skill.</p>}
    </div>}
    {prefix && <button type="button" className={styles.suggestionAll} onClick={()=>select(value.trim())}>
      See all results for “{value.trim()}” <span aria-hidden="true">↗</span>
    </button>}
    {!prefix && prompts.length===0 && <p className={styles.suggestionHint}>Start typing a skill, service, or username.</p>}
  </section>;
}

/** Figma 6:2 discovery surface. A city is an editable textual location filter,
 *  not the device's GPS position. The graphic is decorative, NOT a live map. */
export function ExploreNearby({visible=true}: {visible?:boolean}){
  const [areaInput,setAreaInput]=useState("Lagos");
  const [area,setArea]=useState("Lagos");
  const [items,setItems]=useState<SearchResult[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setError(false);
    void getMarketplacePage("all",{limit:12,filters:{location:area}})
      .then(page=>{if(!cancelled)setItems(page.items);})
      .catch(()=>{if(!cancelled){setError(true);setItems([]);}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[area]);
  const featured=items.filter((item,index,all)=>{
    const owner=ownerOf(item);
    return !!owner.username && all.findIndex(v=>ownerOf(v).id===owner.id)===index;
  });
  if(!visible)return null;
  return <section className={styles.discoverySections} aria-label="Explore nearby and featured Hustlers">
    <div className={styles.sectionTitle}><h2>Explore nearby</h2>
      <button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?"Show less":"See all"} <span aria-hidden="true">↗</span></button>
    </div>
    <div className={styles.mapPreview} aria-label="Decorative map-style background, not a live GPS map">
      <div className={styles.mapBlock} aria-hidden="true"/>
      <span className={styles.mapRoadOne} aria-hidden="true"/>
      <span className={styles.mapRoadTwo} aria-hidden="true"/>
      <span className={styles.mapRoadThree} aria-hidden="true"/>
      <form className={styles.mapAreaPicker} onSubmit={e=>{
        e.preventDefault();if(areaInput.trim())setArea(areaInput.trim().slice(0,70));
      }}>
        <label htmlFor="explore-area">⌖</label>
        <input id="explore-area" aria-label="Area for published local work" value={areaInput}
          onChange={e=>setAreaInput(e.target.value)} maxLength={70} placeholder="City or area"/>
        <button type="submit" aria-label="Browse this area">Browse ↗</button>
      </form>
    </div>
    <p className={styles.nearbyCaveat}>Published work tagged “{area}” · Not live distance or a map</p>
    <div className={styles.sectionTitle}><h2>Featured Hustlers</h2></div>
    {loading && <p className={styles.nearbyMessage} role="status">Finding published work in {area}…</p>}
    {!loading && error && <p className={styles.nearbyMessage}>Local discovery is temporarily unavailable. Search still works.</p>}
    {!loading && !error && featured.length===0 && <p className={styles.nearbyMessage}>No published Hustlers found in {area} yet. Try another area.</p>}
    {!loading && !error && <div className={styles.featuredList}>
      {featured.slice(0,expanded?10:2).map(item=>{
        const owner=ownerOf(item);
        const name=owner.displayName??owner.username??"Hustler";
        return <Link key={owner.id} className={styles.featuredCard}
          href={owner.username?"/u/"+encodeURIComponent(owner.username):item.url??"/search"}>
          <span className={styles.featuredAvatar}>{owner.avatarUrl
            ? <img src={owner.avatarUrl} alt="" loading="lazy"/>:name.charAt(0).toUpperCase()}</span>
          <span className={styles.featuredText}><strong>{name}</strong>
            <small>{owner.professionalProfile.primarySkill??owner.professionalProfile.headline??"Published professional"} · {owner.location??area}</small>
            {owner.verified && <em>✓ Verified identity</em>}</span>
          <span aria-hidden="true">↗</span>
        </Link>;
      })}
    </div>}
  </section>;
}

export function ExploreNoMatch({term,related,onSearch}:{
  term:string;related:SearchResult[];onSearch:(term:string)=>void;
}){
  return <div className={styles.noMatch}>
    <h2>No matches for “{term}”</h2>
    <p>Try a broader skill or location. We won't insert unrelated people or pretend a result exists.</p>
    <div className={styles.noMatchPrompts}>
      {["Barber","Fashion designer","Web developer","Photography"].map(v=>
        <button type="button" key={v} onClick={()=>onSearch(v)}>{v} ↗</button>)}
    </div>
    {related.length>0 && <div className={styles.relatedHeader}>
      <h3>Other published results for “{term}”</h3><p>People, posts, services or products from the same search.</p>
    </div>}
  </div>;
}
