// İngilizce arayüz: sözlük geçerli mi ve kalıplı metinler doğru çevriliyor mu.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path"), vm = require("vm");

const ROOT = path.join(__dirname, "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "web/i18n/en.json"), "utf8"));

function load() {
  const store = { "zm-lang": "en" };
  const ctx = {
    location: { search: "", href: "http://x/" }, URLSearchParams, URL,
    localStorage: { getItem: k => store[k], setItem: (k, v) => { store[k] = v; } },
    document: { documentElement: {}, write() {}, addEventListener() {}, title: "", querySelectorAll: () => [], createTreeWalker: () => ({ nextNode: () => null }) },
    MutationObserver: class { observe() {} takeRecords() {} }, NodeFilter: {},
  };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "web/i18n.js"), "utf8"), ctx);
  ctx.I18N.ready(D);
  return ctx.I18N.t;
}

test("sözlükteki yer tutucular çeviride de var", () => {
  for (const [k, v] of Object.entries(D)) {
    if (v == null) continue;
    const a = (k.match(/\{\d+\}/g) || []).sort().join(), b = (v.match(/\{\d+\}/g) || []).sort().join();
    assert.strictEqual(b, a, k);
  }
});

test("metinler ve kalıplar çevrilir", () => {
  const t = load();
  assert.strictEqual(t("Karakterler"), "Characters");
  assert.strictEqual(t("6 gün önce"), "6 days ago");
  assert.strictEqual(t("DM: Cal · 0 oyuncu · Açık katılım"), "DM: Cal · 0 players · Open to join");
  // İki kalıp uyduğunda parçaları da çevrilebilen seçilir.
  assert.strictEqual(t("Gizli Şeyi Görme at"), "Roll Spot Hidden");
  // Bilinmeyen metin (oyuncu adı) olduğu gibi kalır.
  assert.strictEqual(t("Ayşe"), "Ayşe");
});
