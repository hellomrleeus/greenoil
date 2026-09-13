const json = (data, headers, status = 200) => Response.json(data, {status, headers:{...headers,'Cache-Control':'private, no-store'}});
const stamp = db => db.prepare("INSERT INTO metadata(key,value) VALUES('last_updated',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(new Date().toISOString());
const joined = `FROM restaurants r LEFT JOIN sales s ON s.id = coalesce(
 (SELECT id FROM sales WHERE restaurant_id = lower(r.id) ORDER BY visit_time DESC,id DESC LIMIT 1),
 (SELECT id FROM sales WHERE restaurant_name = r.name_key ORDER BY visit_time DESC,id DESC LIMIT 1))`;

export function restaurantQuery(params) {
  const clauses=[], values=[];
  const add=(sql,...args)=>{clauses.push(sql);values.push(...args)};
  const page = Number(params.get('page') || 1), size=Number(params.get('pageSize') || 20);
  if (!Number.isInteger(page)||page<1||!Number.isInteger(size)||size<1) throw new Error('Invalid pagination');
  const pageSize=Math.min(params.get('format')==='map'?200:1000,size);
  if(params.has('bbox')) {
    const raw=params.get('bbox').split(',');
    const box=raw.map(Number);
    if(raw.length!==4||raw.some(x=>!x.trim())||!box.every(Number.isFinite)||box[0]<-180||box[2]>180||box[1]<-90||box[3]>90||box[0]>box[2]||box[1]>box[3]) throw new Error('Invalid bbox');
    add('r.latitude BETWEEN ? AND ? AND r.longitude BETWEEN ? AND ?',box[1],box[3],box[0],box[2]);
  }
  const region=params.get('region'), hub=params.get('hub');
  if(region&&region!=='全部 (All GTA)') {
    const regionClause = `(r.region = ? OR (r.region != '' AND (instr(r.region,?)>0 OR instr(?,r.region)>0)))`;
    if(hub&&!['all','全部'].includes(hub)) add('('+regionClause+' OR r.hub_id=?)',region,region,region,hub);
    else add(regionClause,region,region,region);
  }
  if(hub&&!['all','全部'].includes(hub)) add("(r.hub_id = ? OR instr(lower(coalesce(json_extract(r.data,'$.hubName'),'') || ' ' || coalesce(json_extract(r.data,'$.hubNameEn'),'') || ' ' || coalesce(json_extract(r.data,'$.hubNameKo'),'')),lower(?)) > 0)",hub,hub);
  const category=params.get('category');
  if(category&&category!=='全部') add("EXISTS (SELECT 1 FROM json_each(r.data,'$.categories') WHERE instr(value,?)>0)",category);
  if(params.get('visited')==='visited') add('s.id IS NOT NULL');
  if(params.get('visited')==='unvisited') add('s.id IS NULL');
  const outcome=params.get('outcome');
  if(outcome&&!['all','全部'].includes(outcome)) add("instr(coalesce(s.outcome,'未拜访'),?)>0",outcome);
  const keyword=params.get('keyword')?.trim().toLowerCase();
  if(keyword) {
    const fields=['name','address','phone','keywordsRaw','primaryType','categoriesRaw','hubName','hubNameEn','hubNameKo'];
    add(`instr(lower(${fields.map(f=>`coalesce(json_extract(r.data,'$.${f}'),'')`).join(" || ' ' || ")}),?)>0`,keyword);
  }
  const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
  const order={rating:'r.rating DESC,r.reviews DESC,r.id',reviews:'r.reviews DESC,r.id',name:'r.name,r.id'}[params.get('sort')]||'r.rating DESC,r.reviews DESC,r.id';
  return {page,pageSize,values,count:`SELECT count(*) AS total ${joined}${where}`,select:`SELECT r.data,s.id AS sale_id,s.outcome,s.visit_time ${joined}${where} ORDER BY ${order} LIMIT ? OFFSET ?`};
}
export async function queryRestaurants(db,params,headers) {
  let q;try {q=restaurantQuery(params)} catch(e){return json({success:false,error:e.message},headers,400)}
  const [count,rows,updated]=await db.batch([
    db.prepare(q.count).bind(...q.values),
    db.prepare(q.select).bind(...q.values,q.pageSize,(q.page-1)*q.pageSize),
    db.prepare("SELECT value FROM metadata WHERE key='last_updated'")
  ]);
  let data=rows.results.map(row=>({...JSON.parse(row.data),inKV:true,isVisited:!!row.sale_id,lastOutcome:row.sale_id?(row.outcome||'有意向/跟进中'):'未拜访',lastVisitTime:row.visit_time||''}));
  if (params.get('format') === 'map') {
    const fields=['placeId','name','region','address','phone','rating','reviews','price','status','categoriesRaw','categories','latitude','longitude','hubId','hubName','mapsUrl','photoUrl','inKV','isVisited','lastOutcome','lastVisitTime'];
    data=data.map(r=>Object.fromEntries(fields.filter(k=>r[k]!==undefined).map(k=>[k,r[k]])));
  }
  const total=count.results[0].total;
  return json({success:true,source:'d1',page:q.page,pageSize:q.pageSize,total,totalPages:Math.ceil(total/q.pageSize)||1,lastUpdated:updated.results[0]?.value||'',data},headers);
}
export async function saveRestaurants(db, restaurants, headers) {
  // Each row is independent; a batch is committed atomically.
  if(restaurants.length>200) return json({success:false,error:'At most 200 restaurants per batch'},headers,400);
  const statements=restaurants.map(r=>db.prepare('INSERT INTO restaurants(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(r.placeId||r.name,JSON.stringify(r)));
  await db.batch([...statements,stamp(db)]);
  return json({success:true,count:restaurants.length,restaurant:restaurants[0],restaurants,message:'餐馆已保存'},headers);
}
export async function updateRestaurant(db,key,updates,headers) {
  // json_set keeps explicit null values and updates only the requested fields.
  const patch={...updates,updatedAt:new Date().toISOString()};
  delete patch.placeId;
  const entries=Object.entries(patch);
  if (!entries.length) return json({success:false,error:'No updates provided'},headers,400);
  const paths=entries.flatMap(([key,value])=>['$.'+JSON.stringify(key),JSON.stringify(value)]);
  const sql=`UPDATE restaurants SET data=json_set(data,${entries.map(()=> '?,json(?)').join(',')}) WHERE id=?`;
  const results=await db.batch([db.prepare(sql).bind(...paths,key),stamp(db)]);
  if(!results[0].meta.changes) return json({success:false,error:'Restaurant not found'},headers,404);
  return json({success:true,key,updates:patch},headers);
}
export async function getSales(db,headers) {
  const rows=await db.prepare('SELECT data FROM sales ORDER BY visit_time DESC,id DESC').all();
  return json({success:true,total:rows.results.length,data:rows.results.map(r=>JSON.parse(r.data))},headers);
}
export async function createSale(db,record,headers) {
  await db.batch([db.prepare('INSERT INTO sales(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(record.id,JSON.stringify(record)),stamp(db)]);
  return json({success:true,record},headers);
}
export async function updateSale(db,id,updates,headers) {
  const patch={...updates,updatedAt:new Date().toISOString()};delete patch.id;
  const entries=Object.entries(patch);
  if (!entries.length) return json({success:false,error:'No updates provided'},headers,400);
  const results=await db.batch([
    db.prepare(`UPDATE sales SET data=json_set(data,${entries.map(()=> '?,json(?)').join(',')}) WHERE id=? RETURNING data`).bind(...entries.flatMap(([k,v])=>['$.'+JSON.stringify(k),JSON.stringify(v)]),id),stamp(db)
  ]);
  if(!results[0].results.length) return json({success:false,error:'Record not found'},headers,404);
  return json({success:true,record:JSON.parse(results[0].results[0].data)},headers);
}
export async function deleteSale(db,id,headers) {
  await db.batch([db.prepare('DELETE FROM sales WHERE id=?').bind(id),stamp(db)]);
  return json({success:true,id},headers);
}
export async function markSavedPlaces(db, places) {
  if(!places.length) return;
  const statements=places.map(p=>db.prepare(`SELECT r.data,s.id AS sale_id,s.outcome,s.visit_time ${joined} WHERE r.id=? OR r.name_key=? LIMIT 1`).bind(p.placeId||'',(p.name||'').trim().toLowerCase()));
  const results=await db.batch(statements);
  results.forEach((res,i)=>{const row=res.results[0];if(row) Object.assign(places[i],{inKV:true,isVisited:!!row.sale_id,lastOutcome:row.sale_id?(row.outcome||'有意向/跟进中'):'未拜访',lastVisitTime:row.visit_time||''});});
}
