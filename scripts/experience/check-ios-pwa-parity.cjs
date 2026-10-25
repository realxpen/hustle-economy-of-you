#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifestFile = path.join(root, "apps/web/app/manifest.ts");
const compiled = ts.transpileModule(fs.readFileSync(manifestFile, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const mod = new Module(manifestFile, module);
mod.filename = manifestFile;
mod.paths = Module._nodeModulePaths(path.dirname(manifestFile));
mod._compile(compiled.outputText, manifestFile);
// The same PWA source serves two independent Workers. Test BOTH manifest
// identities regardless of which deployment workflow environment calls us.
const savedPreview = process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW;
let manifest;
try {
  delete process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW;
  manifest = mod.exports.default();
  assert.equal(manifest.name, "Hustle — The Economy of You");
  assert.equal(manifest.short_name, "Hustle");
  assert.equal(manifest.start_url, "/home");
  assert.equal(manifest.id, "/home");

  process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW = "true";
  const awsManifest = mod.exports.default();
  assert.equal(awsManifest.name, "Hustle AWS Test — The Economy of You");
  assert.equal(awsManifest.short_name, "Hustle AWS");
  assert.equal(awsManifest.id, "/aws-test");
  assert.equal(awsManifest.start_url, "/home");
  assert.equal(awsManifest.scope, "/");
  assert.equal(awsManifest.display, "standalone");
  assert.deepEqual(awsManifest.shortcuts, manifest.shortcuts);
  assert.deepEqual(awsManifest.icons, manifest.icons);
} finally {
  if (savedPreview === undefined) delete process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW;
  else process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW = savedPreview;
}
assert.equal(manifest.scope, "/");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.theme_color, "#121714");
assert.equal(manifest.background_color, "#121714");
assert(manifest.icons.some(x=>x.src==="/icon.svg"&&x.type==="image/svg+xml"));
assert(manifest.icons.some(x=>x.src==="/apple-icon"&&x.type==="image/png"));
assert.deepEqual(manifest.shortcuts.map(x=>x.url),["/search","/posts/new","/messages"]);
const layout = read("apps/web/app/layout.tsx");
assert.match(layout,/manifest: "\/manifest\.webmanifest"/);
assert.match(layout,/appleWebApp: \{ capable: true/);
assert.match(layout,/viewportFit: "cover"/);
assert.match(layout,/statusBarStyle: "black-translucent"/);
const shell = read("apps/web/components/navigation/hustle-mobile-nav.tsx");
const list=shell.match(/const mobileAppItems:[\s\S]*?=\s*\[([\s\S]*?)\];/);
assert(list);
assert.deepEqual([...list[1].matchAll(/href: "([^"]+)"/g)].map(m=>m[1]),
  ["/home","/search","/posts/new","/messages","/account"]);
assert.match(shell,/icon: "create"/);
assert.match(shell,/aria-label="Hustle mobile application"/);
const dock=read("apps/web/components/navigation/hustle-mobile-nav.module.css");
assert.match(dock,/\(display-mode: standalone\)/);
assert.match(dock,/\.dock \{ display: none; \}/);
assert.match(dock,/grid-template-columns:\s*repeat\(5,/);
assert.match(dock,/background:\s*#121714/i);
assert.match(dock,/background:\s*#C9F26B/i);
assert.match(dock,/safe-area-inset-bottom/);
const home=read("apps/web/app/home/page.tsx");
const homeCss=read("apps/web/app/home/page.module.css");
assert.match(home,/className=\{styles\.appWordmark\}/);
assert.match(home,/getFeedPage/);
assert.match(homeCss,/\(display-mode:standalone\)/);
assert.match(homeCss,/\.postCanvas,\s*\.mediaRail/);

assert.match(home,/className=\{styles\.stateStage\}/, "Loading, empty and error must share one bounded feed stage");
assert.match(home,/<ExperienceState compact kind="empty"/, "No oversized full-height empty card");
assert.match(home,/href: "\/search"/, "Empty state must link to real Explore search");
assert.doesNotMatch(home,/Showing recently published work and relevant creators while your discoveries develop\./,
  "Do not promise recently published content in an empty staging feed");
assert.match(homeCss,/\.stateStage\s*\{/, "State panel must have its own grid sizing");
assert.match(homeCss,/\.stateStage > :global\(\[role="status"\]\)/);
assert.match(homeCss,/padding:\s*21px 19px calc\(86px \+ env\(safe-area-inset-bottom/,
  "PWA card must be kept above the iPhone Home indicator and dock");

const explore=read("apps/web/app/search/page.tsx");
const exploreCss=read("apps/web/app/search/search.module.css");
assert.match(explore,/pwaExploreTitle/);
assert.match(explore,/getSearchPage/);
assert.match(explore,/pwaSkills/);
assert.match(exploreCss,/\(display-mode:standalone\)/);
assert.match(exploreCss,/background:#F7F6F2/);
assert.match(exploreCss,/background:#DDF0B8/);

assert.match(explore,/className=\{styles\.filterToggle\}/, "Native Explore filters need an optional toggle");
assert.match(explore,/aria-expanded=\{filtersExpanded\}/, "Filter controls need accessible expanded state");
assert.match(explore,/aria-controls="hustle-explore-filters"/, "Toggle must own its filter controls");
assert.match(explore,/id="hustle-explore-filters"/, "Search filter panel ID must match toggle");
assert.match(explore,/runSearch\("top", null, false, emptyFilters, term\)/,
  "Skill shortcuts must issue an actual real backend search, not only mutate the URL");
assert.match(explore,/const normalized = term\.trim\(\)/,
  "Search request must use the explicitly chosen shortcut, not stale input state");
assert.match(exploreCss,/\.searchBar\s*\{[\s\S]*?flex-direction:\s*row/,
  "Installed iPhone search must be one row");
assert.match(exploreCss,/\.filters\s*\{\s*display:\s*none;\s*\}/,
  "Filters should initially collapse on standalone mobile");
assert.match(exploreCss,/\.filters\.filtersOpen\s*\{\s*display:\s*grid;/,
  "Expanded filters must be usable");
assert.match(exploreCss,/\.resultsWrap\s*\{[\s\S]*?safe-area-inset-bottom/,
  "Search results must clear the iPhone dock/home indicator");

const creatorCss = read("apps/web/app/products/product-editor.module.css");
const inboxCss = read("apps/web/app/messages/messages.module.css");
const youCss = read("apps/web/app/account/page.module.css");
for (const [name, css] of [["Create", creatorCss], ["Inbox", inboxCss], ["You", youCss]]) {
  assert.match(css, /\(display-mode:standalone\)/, name + " must follow installed native design");
  assert.match(css, /#F7F6F2/i, name + " must use cream utility surface");
  assert.match(css, /#C9F26B/i, name + " must use the lime brand accent");
}
const icon=read("apps/web/app/icon.svg");
assert.match(icon,/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(icon,/fill="#121714"/);
assert.match(icon,/fill="#C9F26B"/);
const apple=read("apps/web/app/apple-icon.tsx");
assert.match(apple,/ImageResponse/);
assert.match(apple,/width: 180, height: 180/);
assert.doesNotMatch(layout + shell + home + explore, /navigator\.serviceWorker\.register|caches\.open/);
console.log("PASS: 27+ native-Figma UX004 PWA installation, navigation, theme, iOS safe area and real API parity assertions.");
