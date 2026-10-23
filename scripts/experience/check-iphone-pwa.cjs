const assert = require("node:assert/strict");

const base = process.env.HUSTLE_WEB_TEST_URL || "http://127.0.0.1:3001";
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function get(path) {
  const response = await fetch(new URL(path, base), { redirect: "error" });
  assert.equal(response.status, 200, `${path} must respond with HTTP 200`);
  return response;
}

(async () => {
  const manifestRes = await get("/manifest.webmanifest");
  assert.match(manifestRes.headers.get("content-type") || "", /json/i);
  const manifest = await manifestRes.json();
  assert.equal(manifest.short_name, "Hustle");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/home");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.id, "/home");
  assert.equal(manifest.icons.length, 2);

  const homeRes = await get("/home");
  assert.match(homeRes.headers.get("content-type") || "", /text\/html/i);
  const html = await homeRes.text();
  assert.match(html, /rel="manifest"/i, "Home must link the manifest");
  assert.match(html, /apple-mobile-web-app-capable/i, "Home must support iOS standalone mode");
  assert.match(html, /apple-touch-icon/i, "Home must have an Apple touch icon");

  for (const [path, size] of [["/apple-icon", 192], ["/icon", 512]]) {
    const res = await get(path);
    assert.match(res.headers.get("content-type") || "", /image\/png/i);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.subarray(0, 8).equals(pngMagic), `${path} must be PNG`);
    assert.equal(buf.readUInt32BE(16), size, `${path} image width`);
    assert.equal(buf.readUInt32BE(20), size, `${path} image height`);
  }

  console.log("Hustle iPhone PWA: manifest, standalone metadata, discovery start route and both PNG icons passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
