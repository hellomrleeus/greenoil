import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import worker from '../worker/index.js';
import {restaurantQuery} from '../worker/database.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'greenoil-db-test-'));
const dbpath=path.join(dir,'test.sqlite');
const python=`import sqlite3,json,sys
c=sqlite3.connect(sys.argv[1]);c.row_factory=sqlite3.Row
req=json.load(sys.stdin)
if 'schema' in req:c.executescript(req['schema'])
output=[]
with c:
 for item in req.get('statements',[]):
  before=c.total_changes
  rows=c.execute(item['sql'],item['args'])
  output.append({'results':[dict(r) for r in rows.fetchall()],'meta':{'changes':c.total_changes-before}})
print(json.dumps(output))`;
function run(req){const r=spawnSync('python3',['-c',python,dbpath],{input:JSON.stringify(req),encoding:'utf8'});if(r.status) throw new Error(r.stderr);return JSON.parse(r.stdout)}
run({schema:fs.readFileSync('worker/migrations/0001_restaurants.sql','utf8')});
const db={prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this},async all(){return run({statements:[this]})[0]},async first(){return (await this.all()).results[0]||null},async run(){return this.all()}}},async batch(statements){return run({statements})}};
const env={WORKER_USERNAME:"fixture",DB:db,RESTAURANTS_KV:{get(){throw Error('D1 path must not read KV')},put(){throw Error('D1 path must not write KV')}}};
const headers={Authorization:`Bearer ${btoa(JSON.stringify({user:'fixture',timestamp:Date.now()}))}`,'Content-Type':'application/json'};
const request=async (route,method='GET',body)=>worker.fetch(new Request('https://example.test'+route,{method,headers,body:body?JSON.stringify(body):undefined}),env);
try {
 const restaurants=Array.from({length:45},(_,i)=>({placeId:`r${String(i).padStart(2,'0')}`,name:`Restaurant ${i}`,latitude:i<30?43.86:44.0,longitude:-79.3,region:'Markham',rating:4,reviews:10,categories:['Chicken'],address:'A'}));
 let r=await request('/api/restaurants/batch-add','POST',{restaurants});assert.equal(r.status,200);
 const first=await (await request('/api/restaurants?bbox=-79.4,43.8,-79.2,43.9&pageSize=10')).json();
 const second=await (await request('/api/restaurants?bbox=-79.4,43.8,-79.2,43.9&pageSize=10&page=2')).json();
 assert.equal(first.total,30);assert.equal(first.data.length,10);assert.equal(first.source,'d1');assert(!second.data.some(r=>first.data.some(p=>p.placeId===r.placeId)));
 assert.equal((await request('/api/restaurants?bbox=oops')).status,400);
 assert.equal((await request('/api/restaurants?page=NaN')).status,400);
 const bad=await (await request('/api/restaurants?keyword='+encodeURIComponent("' OR 1=1 --"))).json();assert.equal(bad.total,0);
 r=await request('/api/restaurants/update','POST',{placeId:'r00',updates:{name:'Updated',latitude:44,phone:null}});assert.equal(r.status,200);
 assert.equal((await (await request('/api/restaurants?bbox=-79.4,43.8,-79.2,43.9')).json()).total,29);
 r=await request('/api/sales','POST',{record:{id:'v1',restaurantId:'r00',restaurantName:'Updated',outcome:'interested',visitTime:'2026-09-14T10:00'}});assert.equal(r.status,200);
 let visited=await (await request('/api/restaurants?visited=visited')).json();assert.equal(visited.total,1);assert.equal(visited.data[0].placeId,'r00');
 await request('/api/sales','PUT',{id:'v1',updates:{outcome:'contract_signed'}});
 visited=await (await request('/api/restaurants?outcome=contract_signed')).json();assert.equal(visited.total,1);
 await request('/api/sales?id=v1','DELETE');
 assert.equal((await (await request('/api/restaurants?visited=visited')).json()).total,0);
 assert.equal((await request('/api/restaurants/update','POST',{placeId:'missing',updates:{name:'Missing'}})).status,404);
 const q=restaurantQuery(new URLSearchParams('bbox=-79.4,43.8,-79.2,43.9'));
 const explain=run({statements:[{sql:'EXPLAIN QUERY PLAN '+q.select,args:[...q.values,20,0]}]});
 assert(JSON.stringify(explain).includes('restaurants_lat_lng'));
 const unauth=await worker.fetch(new Request('https://example.test/api/restaurants'),env);assert.equal(unauth.status,401);
 console.log('PASS: real SQLite queries, stable paging, bbox index, SQL injection, restaurant + visit CRUD, auth, no KV reads/writes');
} finally {fs.rmSync(dir,{recursive:true,force:true})}
