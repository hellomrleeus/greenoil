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
  const pageSize=Math.min(params.get('format')==='map'?5000:1000,size);
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
    const fields=['placeId','name','nameEn','region','address','phone','rating','reviews','price','status','openingHours','categoriesRaw','categories','latitude','longitude','hubId','hubName','mapsUrl','photoUrl','inKV','isVisited','lastOutcome','lastVisitTime'];
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
  const paths=entries.flatMap(([k,value])=>['$.'+k,JSON.stringify(value)]);
  const normKey=(key||'').trim().toLowerCase();
  const sql=`UPDATE restaurants SET data=json_set(data,${entries.map(()=> '?,json(?)').join(',')}) WHERE id=? OR name_key=?`;
  const results=await db.batch([db.prepare(sql).bind(...paths,key,normKey),stamp(db)]);
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
    db.prepare(`UPDATE sales SET data=json_set(data,${entries.map(()=> '?,json(?)').join(',')}) WHERE id=?`).bind(...entries.flatMap(([k,v])=>['$.'+k,JSON.stringify(v)]),id),stamp(db)
  ]);
  if(!results[0].meta.changes) return json({success:false,error:'Record not found'},headers,404);
  const row=await db.prepare('SELECT data FROM sales WHERE id=?').bind(id).first();
  return json({success:true,record:row?JSON.parse(row.data):null},headers);
}
export async function deleteSale(db,id,headers) {
  await db.batch([db.prepare('DELETE FROM sales WHERE id=?').bind(id),stamp(db)]);
  return json({success:true,id},headers);
}
export async function markSavedPlaces(db, places) {
  if(!places.length) return;
  const statements=places.map(p=>db.prepare(`SELECT r.data,s.id AS sale_id,s.outcome,s.visit_time ${joined} WHERE r.id=? OR r.name_key=? LIMIT 1`).bind(p.placeId||'',(p.name||'').trim().toLowerCase()));
  const results=await db.batch(statements);
  results.forEach((res,i)=>{
    const row=res.results[0];
    if(row) {
      try {
        const savedData = JSON.parse(row.data);
        if (savedData?.name) {
          if (!places[i].nameEn) places[i].nameEn = places[i].name;
          places[i].name = savedData.name;
          if (places[i]._raw) places[i]._raw["餐馆名称 (Name)"] = savedData.name;
        }
      } catch(e) {}
      Object.assign(places[i],{inKV:true,isVisited:!!row.sale_id,lastOutcome:row.sale_id?(row.outcome||'有意向/跟进中'):'未拜访',lastVisitTime:row.visit_time||''});
    }
  });
}

export async function queryNewRestaurants(db, params, headers, kv) {
  const period = params.get('period') || 'week';
  let days = parseInt(params.get('days'), 10);
  if (!Number.isFinite(days) || days <= 0) {
    if (period === 'day') days = 1;
    else if (period === 'week') days = 7;
    else if (period === 'month') days = 30;
    else if (period === 'quarter') days = 90;
    else if (period === 'all') days = 3650;
    else days = 7;
  }
  const limit = Math.min(parseInt(params.get('limit'), 10) || 1000, 5000);

  if (db) {
    try {
      let refDateStr = params.get('reference_date') || params.get('referenceDate');
      if (!refDateStr) {
        const maxRow = await db.prepare("SELECT MAX(first_inspection_date) as max_date FROM new_restaurants").first();
        const todayStr = new Date().toISOString().slice(0, 10);
        refDateStr = maxRow?.max_date && maxRow.max_date > todayStr ? maxRow.max_date : todayStr;
      }

      const refDate = new Date(refDateStr + "T00:00:00Z");
      const cutoffDate = new Date(refDate.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const rows = await db.prepare(
        "SELECT * FROM new_restaurants WHERE first_inspection_date >= ? AND first_inspection_date <= ? ORDER BY first_inspection_date DESC, id DESC LIMIT ?"
      ).bind(cutoffDate, refDateStr, limit).all();

      const data = rows.results.map(r => ({
        id: r.id,
        name: r.name,
        address: r.address,
        estimatedOpeningDate: r.first_inspection_date,
        firstInspectionDate: r.first_inspection_date,
        latestInspectionDate: r.latest_inspection_date,
        latitude: r.latitude,
        longitude: r.longitude,
        phone: r.phone || "",
        inspectionCount: r.inspection_count || 1,
        status: r.status || "Pass",
        data: r.data ? JSON.parse(r.data) : {}
      }));

      return json({
        success: true,
        period,
        days,
        referenceDate: refDateStr,
        cutoffDate,
        total: data.length,
        source: 'd1',
        data
      }, headers);
    } catch (err) {
      console.warn("D1 queryNewRestaurants failed, trying KV fallback:", err);
    }
  }

  if (kv) {
    try {
      const stored = await kv.get('dinesafe_new_restaurants', { type: 'json' });
      if (Array.isArray(stored)) {
        let refDateStr = params.get('reference_date') || params.get('referenceDate') || new Date().toISOString().slice(0, 10);
        const refDate = new Date(refDateStr + "T00:00:00Z");
        const cutoffDate = new Date(refDate.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        const filtered = stored.filter(r => {
          const d = r.firstInspectionDate || r.estimatedOpeningDate;
          return d && d >= cutoffDate && d <= refDateStr;
        }).slice(0, limit);

        return json({
          success: true,
          period,
          days,
          referenceDate: refDateStr,
          cutoffDate,
          total: filtered.length,
          source: 'kv',
          data: filtered
        }, headers);
      }
    } catch (e) {
      console.warn("KV queryNewRestaurants error:", e);
    }
  }

  return json({
    success: true,
    period,
    days,
    referenceDate: new Date().toISOString().slice(0, 10),
    cutoffDate: new Date().toISOString().slice(0, 10),
    total: 0,
    source: 'none',
    data: []
  }, headers);
}

export async function saveNewRestaurants(db, restaurants, headers, kv, options = {}) {
  if (!Array.isArray(restaurants) || restaurants.length === 0) {
    return json({ success: false, error: 'No restaurants provided' }, headers, 400);
  }
  const now = new Date().toISOString();
  const replace = options.replace === true;

  if (db) {
    try {
      if (replace) {
        await db.prepare("DELETE FROM new_restaurants").run();
      }
      const batchSize = 100;
      for (let i = 0; i < restaurants.length; i += batchSize) {
        const chunk = restaurants.slice(i, i + batchSize);
        const statements = chunk.map(r => {
          const id = String(r.id || r.estId || `${r.name}_${r.address}`).trim();
          const name = String(r.name || r.estName || "").trim();
          const address = String(r.address || "").trim();
          const firstDate = String(r.firstInspectionDate || r.estimatedOpeningDate || r.inspectionDate || "").trim();
          const latestDate = String(r.latestInspectionDate || firstDate).trim();
          const lat = r.latitude != null ? parseFloat(r.latitude) : null;
          const lng = r.longitude != null ? parseFloat(r.longitude) : null;
          const phone = String(r.phone || "").trim();
          const count = parseInt(r.inspectionCount, 10) || 1;
          const status = String(r.status || r.inspectionStatus || "Pass").trim();
          const dataJson = JSON.stringify(r);

          return db.prepare(`
            INSERT INTO new_restaurants (
              id, name, address, first_inspection_date, latest_inspection_date,
              latitude, longitude, phone, inspection_count, status, data, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              address = excluded.address,
              first_inspection_date = excluded.first_inspection_date,
              latest_inspection_date = excluded.latest_inspection_date,
              latitude = excluded.latitude,
              longitude = excluded.longitude,
              phone = excluded.phone,
              inspection_count = excluded.inspection_count,
              status = excluded.status,
              data = excluded.data,
              updated_at = excluded.updated_at
          `).bind(id, name, address, firstDate, latestDate, lat, lng, phone, count, status, dataJson, now);
        });

        await db.batch(statements);
      }
    } catch (err) {
      console.error("D1 saveNewRestaurants error:", err);
    }
  }

  if (kv) {
    try {
      let existing = replace ? [] : (await kv.get('dinesafe_new_restaurants', { type: 'json' }) || []);
      const map = new Map(existing.map(item => [item.id, item]));
      for (const r of restaurants) {
        const id = String(r.id || r.estId || `${r.name}_${r.address}`).trim();
        map.set(id, {
          id,
          name: r.name || r.estName || "",
          address: r.address || "",
          estimatedOpeningDate: r.firstInspectionDate || r.estimatedOpeningDate || r.inspectionDate,
          firstInspectionDate: r.firstInspectionDate || r.estimatedOpeningDate || r.inspectionDate,
          latestInspectionDate: r.latestInspectionDate || r.firstInspectionDate || r.estimatedOpeningDate,
          latitude: r.latitude != null ? parseFloat(r.latitude) : null,
          longitude: r.longitude != null ? parseFloat(r.longitude) : null,
          phone: r.phone || "",
          inspectionCount: parseInt(r.inspectionCount, 10) || 1,
          status: r.status || r.inspectionStatus || "Pass",
          data: r
        });
      }
      const merged = Array.from(map.values())
        .sort((a, b) => (b.firstInspectionDate || '').localeCompare(a.firstInspectionDate || ''))
        .slice(0, 3000);
      await kv.put('dinesafe_new_restaurants', JSON.stringify(merged));
      await kv.put('dinesafe_last_updated', now);
    } catch (e) {
      console.warn("KV saveNewRestaurants error:", e);
    }
  }

  return json({
    success: true,
    count: restaurants.length,
    message: `成功同步 ${restaurants.length} 家新开餐馆数据`,
    updatedAt: now
  }, headers);
}

