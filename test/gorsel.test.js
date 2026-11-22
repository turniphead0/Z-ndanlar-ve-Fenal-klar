// Gerçekçi hazır haritalar (WebP) ve doku üreticisi (web/ext/doku.js).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createServer } = require("../server");
const K = require("../web/gorsel/katalog.js");

test("hazır haritalar gerçekçi WebP resimler; eski SVG adresleri yenisine yönlenir", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zm-"));
  const srv = createServer({ dataDir: dir, hesap: "zorunlu", smtp: null });
  const port = await srv.listen(0, "127.0.0.1"), B = `http://127.0.0.1:${port}`;
  try {
    assert.equal(K.harita.length, 11);
    for (const h of K.harita) {
      assert.match(h.url, /^\/gorsel\/harita-[a-z0-9-]+\.webp$/);
      const r = await fetch(B + h.url); assert.equal(r.status, 200, h.url); assert.equal(r.headers.get("content-type"), "image/webp");
      const b = Buffer.from(await r.arrayBuffer()); assert.equal(b.toString("ascii", 0, 4), "RIFF"); assert.equal(b.toString("ascii", 8, 12), "WEBP");
    }
    // Kayıtlı haritalardaki eski adres: kalıcı yönlendirme
    const r = await fetch(B + "/gorsel/harita-zindan.svg", { redirect: "manual" });
    assert.equal(r.status, 301); assert.equal(r.headers.get("location"), "/gorsel/harita-zindan.webp");
    assert.equal((await fetch(B + "/gorsel/harita-yok.svg", { redirect: "manual" })).status, 404);
    // Jetonlar SVG olarak kalır
    assert.equal((await fetch(B + "/gorsel/jeton-savasci.svg")).headers.get("content-type"), "image/svg+xml");
    // Doku üreticisi eklenti olarak yüklenir
    const ext = await fetch(B + "/ext/doku.js"); assert.equal(ext.status, 200);
    assert.match(await (await fetch(B + "/")).text(), /ext\/doku\.js\?v=/);
  } finally { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("doku üreticisi: karo kesintisiz gürültü ve renk yardımcıları", () => {
  const D = require("../web/ext/doku.js");
  for (const k of ["doku", "desen", "veri", "sprite", "kapi", "bulut", "karis"]) assert.equal(typeof D[k], "function", k);
  const n = D.gurultu(5);
  // Periyot 4: x ve x+4 aynı değer verir (dokular kenardan kesintisiz tekrar eder)
  for (const [x, y] of [[.3, .7], [1.9, 2.2], [3.99, .01]]) assert.ok(Math.abs(n(x, y, 4, 4) - n(x + 4, y + 8, 4, 4)) < 1e-9);
  const c = D.hucre(3, 5); const a = c(.1, .2), d1 = a.d1; assert.ok(Math.abs(c(1.1, 1.2).d1 - d1) < 1e-9);
  assert.deepEqual(D.rgb("#ff8000"), [255, 128, 0]); assert.deepEqual(D.rgb("rgb(1, 2, 3)"), [1, 2, 3]);
  assert.equal(D.karis("#000000", "#ffffff", .5), "rgb(128,128,128)");
});
