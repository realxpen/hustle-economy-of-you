#!/usr/bin/env node
'use strict';
// Static consumer token/drift contract, NOT a screenshot-pixel parity test.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const native = read('apps/mobile/src/ux004/theme/colors.ts');
const css = read('apps/web/app/figma-mobile-v1.css');
const nav = read('apps/web/components/navigation/hustle-mobile-nav.module.css');
const layout = read('apps/web/app/layout.tsx');
const connected = read('apps/mobile/src/experience/MobileExperience.tsx');
const demo = read('apps/mobile/src/experience/DemoExperience.tsx');
const palette = {
  paper: ['#F7F6F2','paper'], surface: ['#FFFFFF','card'],
  raised: ['#E4EFD7','raised'], darkBase: ['#0E1210','dark'],
  darkCard: ['#27372C','dark-card'], ink: ['#18281E','ink'],
  textPrimaryLight: ['#181A18','text'], textSecondaryLight: ['#778074','muted'],
  textSecondaryDark: ['#BCD0BF','dark-muted'], lime: ['#C9F26B','accent'],
  line: ['#E3E8DF','border'], darkLine: ['#405046','dark-border']
};
const errors = [];
const must=(ok,message)=>{ if(!ok)errors.push(message); };
for(const [name,[hex,alias]] of Object.entries(palette)) {
  must(native.includes(name+': "'+hex+'"'),'Native token '+name+' should be '+hex);
  must(css.includes('--hf-'+alias+':'+hex+';'),'Web token '+name+' should be '+hex);
}
must(layout.includes('import "./figma-mobile-v1.css";'),'Web layout missing Figma stylesheet');
must(css.includes('main:is(.h-adaptive,.h-experience-shell)'),'Consumer styling should be scoped');
must(css.includes('main.h-discover-immersive'),'Mobile immersive feed needs dark semantics');
must(!/main\.h-experience-shell.*\*/.test(css),'Avoid broad invasive selectors');
must(/#C9F26B/i.test(nav)&&/#0E1210/i.test(nav),'Floating nav colors drifted');
must(connected.includes('dark: colors.darkBase'),'Connected native does not use shared colors');
must(demo.includes('ink: colors.ink'),'Offline demo does not use shared colors');
must(connected.includes('minHeight: layout.minTapTarget'),'Connected native nav tap target below threshold');
const navSource=read('apps/web/components/navigation/hustle-mobile-nav.tsx');
for(const route of ['/home','/search','/marketplace','/messages','/notifications','/account'])must(navSource.includes('href: "'+route+'"'),'Missing canonical browser route '+route);
must(navSource.includes('"/posts/new"'),'Installed five-tab app create route missing');
const radii=read('apps/mobile/src/ux004/theme/spacing.ts');
must(radii.includes('card: 20,')&&radii.includes('button: 16,'),'Native card/button radii drifted');
if(errors.length){console.error('FAIL Figma Mobile V1 consistency:\n'+errors.map(s=>' - '+s).join('\n'));process.exit(1)}
console.log('PASS Figma palette, hybrid routing, native/web nav, and component radii. Visual acceptance remains separate.');
