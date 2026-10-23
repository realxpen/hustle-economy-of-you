#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function compile(absolute, mocks = {}) {
  const transpiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const mod = new Module(absolute, module); mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const native = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : native(name);
  mod._compile(transpiled.outputText, absolute);
  return mod.exports;
}
const paths = {
  pipeline: path.join(root, "src/experience/mobile-post-publishing.ts"),
  screen: path.join(root, "src/experience/NativeCreate.tsx"),
  shell: path.join(root, "src/experience/MobileExperience.tsx"),
  staging: path.join(root, "../../apps/api/src/staging-request-policy.ts")
};
const requests = [];
const { normalizeCreatorPost, createCreatorPostStore, ownerPostApi } = compile(paths.pipeline, {
  "./feed-api": { api: async (...args) => { requests.push(args); return {}; } }
});
const { stagingRequestAllowed } = compile(paths.staging);
const screen = fs.readFileSync(paths.screen, "utf8");
const shell = fs.readFileSync(paths.shell, "utf8");
const oldGate = process.env.HUSTLE_STAGING_CONTENT_PUBLISH_ENABLED;
const input = { caption: "  A clean fade in Lagos  ", category: " Barbering ",
  location: " Lagos ", imageUrl: "https://work.example/portfolio/fade.jpg" };
let count = 0;
async function verify(name, fn) { await fn(); count++; console.log("PASS:", name); }
const post = (id, status = 'DRAFT', media = []) => ({ id, status,
  caption: input.caption.trim(), category: input.category.trim(),
  location: input.location.trim(), media });
function transport(opts = {}) {
  const logs = [], own = post('post_12');
  return {
    logs,
    mine: async () => { logs.push('mine'); return [own]; },
    get: async id => { logs.push('get:' + id); return opts.get ? opts.get() : own; },
    create: async data => {
      logs.push('create'); assert.equal(data.caption, input.caption.trim());
      if (opts.failCreate) throw Error("network");
      return own;
    },
    image: async (id, url) => { logs.push('image:' + id); assert.equal(url, input.imageUrl);
      if (opts.failImage) throw Error("network"); return own;
    },
    publish: async id => { logs.push('publish:' + id);
      if (opts.failPublish) throw Error("network"); return post(id, 'PUBLISHED'); }
  };
}
(async () => {
  try {
    await verify('Normalize real skill caption and public HTTPS image, disallow unsafe addresses', () => {
      assert.deepEqual(normalizeCreatorPost(input), { caption: "A clean fade in Lagos",
        category: "Barbering", location: "Lagos", imageUrl: input.imageUrl });
      for (const url of ["http://work.example/a.jpg", "https://localhost/a.png",
        "https://127.0.0.1/x", "https://192.168.1.3/a.png", "https://bad.example:pw@work.example/a",
        "ftp://files.example/image", "something"]) {
        assert.throws(() => normalizeCreatorPost({ ...input, imageUrl: url }), /HTTPS|public/);
      }
      assert.throws(() => normalizeCreatorPost({ ...input, caption: " " }), /Describe/);
    });
    await verify('Publish performs owned draft create -> re-read -> media -> publish once', async () => {
      const api = transport(), store = createCreatorPostStore(api);
      await store.publish(input);
      assert.equal(store.snapshot().phase, "published");
      assert.equal(store.snapshot().postId, "post_12");
      assert.deepEqual(api.logs, ["create", "get:post_12", "image:post_12", "publish:post_12"]);
      await store.publish(input);
      assert.equal(api.logs.length, 4, "never create a second post on double tap");
    });
    await verify('Preexisting image never attaches twice while resuming a draft', async () => {
      const api = transport({get:()=>post('post_12', 'DRAFT', [{ id:'img_1',type:'IMAGE',mediaUrl:input.imageUrl }])});
      const store = createCreatorPostStore(api);
      store.resume(post('post_12'));
      await store.publish(input);
      assert.equal(store.snapshot().phase, "published");
      assert.deepEqual(api.logs, ["get:post_12", "publish:post_12"]);
    });
    await verify('Uncertain creation blocks retry until canonical owner list reviewed', async () => {
      const api = transport({failCreate:true});
      const store = createCreatorPostStore(api);
      await store.publish(input);
      assert.equal(store.snapshot().phase,"review");
      await store.publish(input);
      assert.deepEqual(api.logs, ["create"]);
      await store.list();
      assert.deepEqual(api.logs, ["create","mine"]);
      store.resume(post("post_12"));
      assert.equal(store.snapshot().phase,"idle");
      assert.equal(store.snapshot().postId,"post_12");
    });
    await verify('Uncertain media or publish never repeats automatically', async () => {
      for(const key of ["failImage","failPublish"]) {
        const api=transport({[key]:true}), store=createCreatorPostStore(api);
        await store.publish(input);
        assert.equal(store.snapshot().phase,"review");
        const calls=api.logs.slice();
        await store.publish(input);
        assert.deepEqual(api.logs,calls);
        assert.equal(store.snapshot().postId,"post_12");
      }
    });
    await verify('A published canonical post is never republished or reattached', async () => {
      const api=transport({get:()=>post('post_12','PUBLISHED')});
      const store=createCreatorPostStore(api);store.resume(post('post_12'));
      await store.publish(input);
      assert.equal(store.snapshot().phase,"published");
      assert.deepEqual(api.logs,["get:post_12"]);
    });
    await verify('API adapter uses bearer-authorized canonical owner routes', async () => {
      const adapter=ownerPostApi("disposable-fixture-session");
      await adapter.mine();await adapter.get("a/b");await adapter.create({caption:"x",category:"Barbering"});
      await adapter.image("a/b",input.imageUrl);await adapter.publish("a/b");
      assert.deepEqual(requests.map(r=>r[1]),[
        "/posts/mine","/posts/mine/a%2Fb","/posts","/posts/a%2Fb/media","/posts/a%2Fb/publish"
      ]);
      assert(requests.every(r=>r[0]==="disposable-fixture-session"));
      assert.deepEqual(requests.map(r=>r[2]),["GET","GET","POST","POST","POST"]);
    });
    await verify('Staging publishing gate defaults DENY including unlisted writes', () => {
      delete process.env.HUSTLE_STAGING_CONTENT_PUBLISH_ENABLED;
      for(const p of ["/api/v1/posts","/api/v1/posts/post_12/media",
        "/api/v1/posts/post_12/publish","/api/v1/posts/post_12/archive"]) {
        assert.equal(stagingRequestAllowed("POST",p),false,p);
      }
      assert.equal(stagingRequestAllowed("POST","/api/v1/messaging/conversations/direct"),true);
    });
    await verify('Explicit staging creator flag narrowly allows posts, media, publish only', () => {
      process.env.HUSTLE_STAGING_CONTENT_PUBLISH_ENABLED="true";
      for(const p of ["/api/v1/posts","/api/v1/posts/post_12/media","/api/v1/posts/post_12/publish"])
        assert.equal(stagingRequestAllowed("POST",p),true,p);
      for(const p of ["/api/v1/booking","/api/v1/payments",
        "/api/v1/posts/post_12/archive", "/api/v1/posts/post_12/likes", "/api/v1/posts/post_12/media/secret"])
        assert.equal(stagingRequestAllowed("POST",p),false,p);
      assert.equal(stagingRequestAllowed("DELETE","/api/v1/posts/post_12/media/1"),false);
    });
    await verify('Central Create tab mounts authentic composer and feed refresh', () => {
      assert.match(shell,/import \{ NativeCreate \} from '\.\/NativeCreate'/);
      assert.match(shell,/type Screen = 'Home' \| 'Explore' \| 'Create'/);
      assert.match(shell,/<NativeCreate/);
      assert.doesNotMatch(shell,/mobile publishing workflow is being connected/);
      assert.match(screen,/ownerPostApi/);
      assert.match(screen,/My posts \/ Review drafts/);
      assert.match(screen,/Review My posts before continuing/);
      assert.doesNotMatch(screen,/SUPABASE_SERVICE_ROLE|BETTER_AUTH_SECRET|real payment/i);
    });
    console.log("PASS:",count,"native creator and staging write-isolation cases (fixture only)");
  } finally {
    if(oldGate===undefined) delete process.env.HUSTLE_STAGING_CONTENT_PUBLISH_ENABLED;
    else process.env.HUSTLE_STAGING_CONTENT_PUBLISH_ENABLED=oldGate;
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
