import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import service from "../service/masks.mjs";
import presets from "../app/transition-presets.json" with { type: "json" };

const sql = await readFile(new URL("../drizzle/0000_first_obadiah_stane.sql",import.meta.url),"utf8");
function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(sql);
  t.after(()=>sqlite.close());
  const db = {prepare(sql) {
    const statement = sqlite.prepare(sql);
    let args = [];
    return {bind(...values) { args = values; return this; },first() { return statement.get(...args) ?? null; },run() { return statement.run(...args); }};
  },async batch(statements) {
    sqlite.exec("BEGIN");
    try { const result = statements.map(s => s.run()); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  }};
  const password = crypto.randomUUID();
  const env = {DB:db,MASK_EDITOR_PASSWORD:password,MASK_ALLOWED_ORIGINS:"https://gb-films.github.io"};
  const call = (path,method="GET",data,token,origin="https://gb-films.github.io") => service.fetch(new Request(`https://service.test${path}`,{
    method,headers:{Origin:origin,"Content-Type":"application/json",...(token ? {Authorization:`Bearer ${token}`} : {})},
    ...(data === undefined ? {} : {body:JSON.stringify(data)}),
  }),env);
  const login = async () => { const response = await call("/session","POST",{password}); assert.equal(response.status,200); return (await response.json()).token; };
  return {call,login,password,sqlite,env};
}

test("anonymous readers get the published defaults, no credentials and explicit CORS",async t=>{
  const {call} = fixture(t);
  const response = await call("/masks");
  assert.equal(response.status,200);
  assert.equal(response.headers.get("access-control-allow-origin"),"https://gb-films.github.io");
  assert.equal(response.headers.get("cache-control"),"no-store");
  const data = await response.json();
  assert.equal(data.version,0);
  assert.equal(data.transitions.length,7);
  assert.equal(data.token,undefined);
  assert.equal((await call("/masks","PUT",{})).status,401);
  assert.equal((await call("/masks","GET",undefined,undefined,"https://other.test")).status,403);
  assert.equal((await call("/masks","OPTIONS")).status,204);
});

test("password checked server-side; sessions expire and logout revokes access",async t=>{
  const {call,login,sqlite} = fixture(t);
  assert.equal((await call("/session","POST",{password:"incorrect-test-password"})).status,401);
  const token = await login();
  assert.match(token,/^[a-f0-9]{64}$/);
  assert.notEqual(sqlite.prepare("SELECT token_hash FROM mask_sessions").get().token_hash,token);
  assert.equal((await call("/session","DELETE",undefined,token)).status,200);
  assert.equal((await call("/masks","PUT",{},token)).status,401);
  const expired = await login();
  sqlite.exec("UPDATE mask_sessions SET expires_at = 0");
  assert.equal((await call("/masks","PUT",{},expired)).status,401);
});

test("publication persists for every reader, preserves history, and refuses stale edits",async t=>{
  const {call,login,sqlite} = fixture(t);
  const token = await login();
  const request = {baseVersion:0,requestId:crypto.randomUUID(),transitions:structuredClone(presets)};
  request.transitions[0].portalX = 34;
  const first = await call("/masks","PUT",request,token);
  assert.equal(first.status,200);
  assert.equal((await first.json()).version,1);
  assert.equal((await (await call("/masks")).json()).transitions[0].portalX,34);
  assert.equal((await call("/masks","PUT",request,token)).status,200,"retry is idempotent");
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM mask_versions").get().count,1);
  assert.equal((await call("/masks","PUT",{...request,requestId:crypto.randomUUID()},token)).status,409);
  const second = await call("/masks","PUT",{...request,baseVersion:1,requestId:crypto.randomUUID()},token);
  assert.equal((await second.json()).version,2);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM mask_versions").get().count,2);
});

test("invalid geometry and oversized requests cannot change published masks",async t=>{
  const {call,login} = fixture(t);
  const token = await login();
  const invalid = structuredClone(presets);
  invalid[0].portalScale = 0;
  assert.equal((await call("/masks","PUT",{baseVersion:0,requestId:crypto.randomUUID(),transitions:invalid},token)).status,400);
  assert.equal((await call("/masks","PUT",{padding:"x".repeat(66000)},token)).status,400);
  assert.equal((await (await call("/masks")).json()).version,0);
});

test("repeated password attempts are throttled persistently",async t=>{
  const {call} = fixture(t);
  for(let i=0;i<10;i++) assert.equal((await call("/session","POST",{password:"wrong-test-value"})).status,401);
  assert.equal((await call("/session","POST",{password:"wrong-test-value"})).status,429);
});

test("missing configuration or a database failure fails closed",async t=>{
  const {env} = fixture(t);
  const request = new Request("https://service.test/masks");
  assert.equal((await service.fetch(request,{})).status,503);
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await service.fetch(request,{...env,DB:{prepare(){throw new Error("offline");}}})).status,503);
  } finally { console.error = original; }
});
