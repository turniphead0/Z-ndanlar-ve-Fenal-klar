const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// saldiri.js tarayıcı eklentisidir; burada yalnızca hasar türü ve savunma hesabı denenir.
function load() {
  const win = { render() {}, addEventListener() {} };
  const ctx = { window: win, document: { addEventListener() {} }, S: {}, G: {}, console };
  vm.createContext(ctx); ctx.window = ctx; ctx.render = win.render;
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../web/ext/saldiri.js"), "utf8"), ctx);
  return ctx.ATTACK;
}

test("hasar türleri Türkçe ve İngilizce tanınır", () => {
  const A = load();
  assert.deepStrictEqual([...A.typeKeys("delici")], ["piercing"]);
  assert.deepStrictEqual([...A.typeKeys("Fire")], ["fire"]);
  assert.deepStrictEqual([...A.typeKeys("büyüsüz fiziksel")], ["physical"]);
  assert.deepStrictEqual([...A.typeKeys("")], []);
});

test("5e: direnç yarı, zayıflık iki kat, bağışıklık sıfır", () => {
  const A = load();
  assert.strictEqual(A.defend("dnd5e", 9, "slashing", { res: "kesici, ateş" }).amt, 4);
  assert.strictEqual(A.defend("dnd5e", 9, "piercing", { vuln: "delici" }).amt, 18);
  assert.strictEqual(A.defend("dnd5e", 9, "poison", { immun: "zehir" }).amt, 0);
  assert.strictEqual(A.defend("dnd5e", 9, "slashing", { res: "fiziksel" }).amt, 4);
  assert.strictEqual(A.defend("dnd5e", 9, "cold", { res: "ateş" }).amt, 9);
});

test("PF2e: direnç ve zayıflık miktarla işler", () => {
  const A = load();
  assert.strictEqual(A.defend("pf2e", 10, "cold", { res: "soğuk 5" }).amt, 5);
  assert.strictEqual(A.defend("pf2e", 3, "cold", { res: "soğuk 5" }).amt, 0);
  assert.strictEqual(A.defend("pf2e", 10, "fire", { vuln: "ateş 5", res: "tümü 2" }).amt, 13);
  assert.strictEqual(A.defend("pf2e", 10, "slashing", { res: "fiziksel 3; ateş 10" }).amt, 7);
});
