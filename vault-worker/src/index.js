const encoder = new TextEncoder();
const decoder = new TextDecoder();

function now() {
  return Math.floor(Date.now() / 1000);
}

function id(prefix = "id") {
  return prefix + "_" + crypto.randomUUID();
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  return allowedOrigins(env).has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "false",
        "vary": "Origin",
      }
    : {};
}

function constantTimeEqual(a, b) {
  a = String(a || "");
  b = String(b || "");
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function adminAuthorized(request, env) {
  const auth = String(request.headers.get("authorization") || "").trim();
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const expected = String(env.VAULT_ADMIN_TOKEN || "").trim();
  return !!expected && !!token && constantTimeEqual(token, expected);
}

// Private Back Room bridge credential: accepts only the access-code admin
// endpoints. It cannot authorize Vault analytics, users, playlists, ingest or
// other general administrator operations. Existing Vault admin token still works.
function accessCodesAuthorized(request,env){
  if(adminAuthorized(request,env))return true;
  const auth=String(request.headers.get("authorization")||"").trim();
  const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";
  const expected=String(env.VAULT_ACCESS_CODES_TOKEN||"").trim();
  return !!token&&!!expected&&constantTimeEqual(token,expected);
}
function ingestAuthorized(request, env) {
  return constantTimeEqual(
    String(request.headers.get("x-ge-vault-key") || "").trim(),
    String(env.VAULT_INGEST_TOKEN || "").trim(),
  );
}

function bytesToB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(value) {
  const raw = atob(String(value || ""));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacHex(value, secret) {
  if (!value) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(String(value))),
  );
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function encryptPrivate(value, env) {
  if (!value) return "";
  const rawKey = b64ToBytes(env.VAULT_ENCRYPTION_KEY_B64);
  if (rawKey.length !== 32) {
    throw new Error("VAULT_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(String(value)),
    ),
  );
  return bytesToB64(iv) + "." + bytesToB64(ciphertext);
}

function cleanJson(value, fallback = {}) {
  if (value == null) return JSON.stringify(fallback);
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return JSON.stringify({ value });
    }
  }
  return JSON.stringify(value);
}

function cfInfo(request) {
  const cf = request.cf || {};
  return {
    country: cf.country || null,
    region: cf.region || null,
    city: cf.city || null,
    timezone: cf.timezone || null,
    cf_colo: cf.colo || null,
    cf_asn: Number.isFinite(Number(cf.asn)) ? Number(cf.asn) : null,
    cf_as_org: cf.asOrganization || null,
  };
}

async function visitorIdentity(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  return {
    ip_hash: await hmacHex(ip, env.VAULT_HASH_KEY),
    ip_ciphertext: await encryptPrivate(ip, env),
    ...cfInfo(request),
  };
}

async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request body must be JSON.");
  }
}

async function audit(env, actor, action, targetType = "", targetId = "", details = {}) {
  await env.VAULT_DB.prepare(
    `INSERT INTO audit_log
      (id,occurred_at,actor,action,target_type,target_id,details_json)
     VALUES (?,?,?,?,?,?,?)`,
  )
    .bind(id("audit"), now(), actor, action, targetType, targetId, cleanJson(details))
    .run();
}

async function upsertFan(env, body, geo) {
  const fanId = String(body.fan_id || body.id || id("fan"));
  const t = now();
  const existing = await env.VAULT_DB.prepare(
    "SELECT id,created_at,first_seen_at FROM fans WHERE id=?",
  ).bind(fanId).first();

  await env.VAULT_DB.prepare(
    `INSERT INTO fans
      (id,created_at,updated_at,first_seen_at,last_seen_at,display_name,email,phone,country,region,city,timezone,consent_analytics,consent_contact,notes,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       updated_at=excluded.updated_at,
       last_seen_at=excluded.last_seen_at,
       display_name=COALESCE(excluded.display_name,fans.display_name),
       email=COALESCE(excluded.email,fans.email),
       phone=COALESCE(excluded.phone,fans.phone),
       country=COALESCE(excluded.country,fans.country),
       region=COALESCE(excluded.region,fans.region),
       city=COALESCE(excluded.city,fans.city),
       timezone=COALESCE(excluded.timezone,fans.timezone),
       consent_analytics=MAX(fans.consent_analytics,excluded.consent_analytics),
       consent_contact=MAX(fans.consent_contact,excluded.consent_contact),
       notes=COALESCE(excluded.notes,fans.notes),
       metadata_json=excluded.metadata_json`,
  )
    .bind(
      fanId,
      existing?.created_at || t,
      t,
      existing?.first_seen_at || t,
      t,
      body.display_name || null,
      body.email || null,
      body.phone || null,
      body.country || geo.country || null,
      body.region || geo.region || null,
      body.city || geo.city || null,
      body.timezone || geo.timezone || null,
      body.consent_analytics ? 1 : 0,
      body.consent_contact ? 1 : 0,
      body.notes || null,
      cleanJson(body.metadata),
    )
    .run();
  return fanId;
}

async function ingestFan(request, env) {
  if (!ingestAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const fan = body.fan && typeof body.fan === "object" ? body.fan : body;
  const geo = {
    country: fan.country || null,
    region: fan.region || null,
    city: fan.city || null,
    timezone: fan.timezone || null,
  };
  const fanId = await upsertFan(env, fan, geo);
  await audit(env, "trusted-ingest", "fan.upsert", "fan", fanId, {
    source: String(body.source || fan.source || "first-party").slice(0, 80),
  });
  return json({ ok: true, id: fanId }, 201);
}

async function ingestListener(request, env) {
  if (!ingestAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const visitor = await visitorIdentity(request, env);
  const eventId = id("listen");
  const t = now();

  let fanId = body.fan_id ? String(body.fan_id) : null;
  if (body.fan && typeof body.fan === "object") {
    fanId = await upsertFan(env, { ...body.fan, fan_id: fanId }, visitor);
  }

  await env.VAULT_DB.prepare(
    `INSERT INTO listener_events
      (id,occurred_at,fan_id,anon_id,session_id,event_type,track_id,track_title,playlist_id,ip_hash,ip_ciphertext,user_agent,referrer,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      eventId,
      t,
      fanId,
      body.anon_id || null,
      body.session_id || null,
      String(body.event_type || "listen"),
      body.track_id || null,
      body.track_title || null,
      body.playlist_id || null,
      visitor.ip_hash || null,
      visitor.ip_ciphertext || null,
      request.headers.get("user-agent") || null,
      body.referrer || request.headers.get("referer") || null,
      visitor.country,
      visitor.region,
      visitor.city,
      visitor.timezone,
      visitor.cf_colo,
      visitor.cf_asn,
      visitor.cf_as_org,
      cleanJson(body.metadata),
    )
    .run();

  return json({ ok: true, id: eventId }, 201);
}

async function ingestComment(request, env) {
  if (!ingestAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const text = String(body.body || "").trim();
  if (!text) return json({ ok: false, error: "Comment is empty." }, 400);
  if (text.length > 10000) return json({ ok: false, error: "Comment is too long." }, 400);

  const visitor = await visitorIdentity(request, env);
  let fanId = body.fan_id ? String(body.fan_id) : null;
  if (body.fan && typeof body.fan === "object") {
    fanId = await upsertFan(env, { ...body.fan, fan_id: fanId }, visitor);
  }

  const commentId = id("comment");
  const t = now();
  await env.VAULT_DB.prepare(
    `INSERT INTO comments
      (id,created_at,updated_at,fan_id,anon_id,source,body,status,ip_hash,ip_ciphertext,country,region,city,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      commentId,
      t,
      t,
      fanId,
      body.anon_id || null,
      String(body.source || "website").slice(0, 80),
      text,
      "visible",
      visitor.ip_hash || null,
      visitor.ip_ciphertext || null,
      visitor.country,
      visitor.region,
      visitor.city,
      cleanJson(body.metadata),
    )
    .run();

  return json({ ok: true, id: commentId }, 201);
}



function cleanEventName(value) {
  const name = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._:-]{0,63}$/.test(name) ? name : "";
}

function safePath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const u = new URL(text, "https://example.invalid");
    return (u.pathname || "/").slice(0, 500);
  } catch {
    return text.split("?")[0].split("#")[0].slice(0, 500);
  }
}

function safeReferrer(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const u = new URL(text);
    return (u.origin + (u.pathname || "/")).slice(0, 700);
  } catch {
    return text.split("?")[0].split("#")[0].slice(0, 700);
  }
}

async function savePublicFanEvent(request, env) {
  const body = await readBody(request);
  const eventType = cleanEventName(body.event_type);
  if (!eventType) return json({ ok: false, error: "Invalid event type." }, 400);

  const visitor = await visitorIdentity(request, env);
  const t = now();
  const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (visitor.ip_hash) {
    const recent = await env.VAULT_DB.prepare(
      "SELECT COUNT(*) AS n FROM fan_events WHERE ip_hash=? AND occurred_at>?",
    ).bind(visitor.ip_hash, t - 600).first();
    if (Number(recent?.n || 0) >= 600) {
      return json({ ok: false, error: "Event rate limit reached." }, 429);
    }
  }

  const eventId = id("event");
  await env.VAULT_DB.prepare(
    `INSERT INTO fan_events
      (id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_url,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,ip_hash,ip_ciphertext,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    eventId,
    t,
    null,
    String(body.anon_id || "").slice(0, 160) || null,
    String(body.session_id || "").slice(0, 160) || null,
    String(body.surface || "website").slice(0, 80) || "website",
    eventType,
    safePath(body.page_url || body.page_path || ""),
    safePath(body.page_path || ""),
    String(body.track_id || meta.track_id || meta.src || "").slice(0, 300) || null,
    String(body.track_title || meta.track_title || meta.title || "").slice(0, 300) || null,
    String(body.album || meta.album || "").slice(0, 160) || null,
    String(body.playlist_id || meta.playlist_id || "").slice(0, 160) || null,
    String(body.share_target || meta.share_target || meta.method || "").slice(0, 120) || null,
    safeReferrer(body.referrer || request.headers.get("referer") || ""),
    String(body.utm_source || meta.utm_source || "").slice(0, 160) || null,
    String(body.utm_medium || meta.utm_medium || "").slice(0, 160) || null,
    String(body.utm_campaign || meta.utm_campaign || "").slice(0, 200) || null,
    String(body.utm_content || meta.utm_content || "").slice(0, 200) || null,
    String(body.utm_term || meta.utm_term || "").slice(0, 200) || null,
    visitor.ip_hash || null,
    visitor.ip_ciphertext || null,
    request.headers.get("user-agent") || null,
    String(body.language || meta.language || "").slice(0, 80) || null,
    visitor.country,
    visitor.region,
    visitor.city,
    visitor.timezone,
    visitor.cf_colo,
    visitor.cf_asn,
    visitor.cf_as_org,
    cleanJson(meta),
  ).run();

  return json({ ok: true, id: eventId }, 201);
}

function publicGameScore(row) {
  let record = {};
  try { record = JSON.parse(row.record_json || "{}"); } catch {}
  return {
    ...record,
    id: row.id,
    name: row.player_name,
    score: Number(row.score || 0),
    target: Number(row.target || 0),
    winningThrows: Number(row.winning_throws || 0),
    players: Number(row.players || 1),
    completedAt: row.completed_at || record.completedAt || "",
    gameType: row.game_type || record.gameType || "points",
  };
}

async function listPublicGameScores(env, url) {
  const limit = Math.max(1, Math.min(250, Number(url.searchParams.get("limit") || 100)));
  const gameType = String(url.searchParams.get("game_type") || "").trim().slice(0, 40);
  let result;
  if (gameType) {
    result = await env.VAULT_DB.prepare(
      "SELECT * FROM game_scores WHERE game_type=? ORDER BY CASE WHEN winning_throws>0 THEN winning_throws ELSE 2147483647 END ASC, score DESC, updated_at DESC LIMIT ?",
    ).bind(gameType, limit).all();
  } else {
    result = await env.VAULT_DB.prepare(
      "SELECT * FROM game_scores ORDER BY CASE WHEN winning_throws>0 THEN winning_throws ELSE 2147483647 END ASC, score DESC, updated_at DESC LIMIT ?",
    ).bind(limit).all();
  }
  return (result.results || []).map(publicGameScore);
}

async function savePublicGameScore(request, env) {
  const body = await readBody(request);
  const scoreId = String(body.id || "").trim();
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(scoreId)) {
    return json({ ok: false, error: "Invalid score ID." }, 400);
  }

  const name = String(body.name || "Anonymous").trim().slice(0, 32) || "Anonymous";
  const score = Math.max(0, Math.min(1000000000, Number(body.score) || 0));
  const target = Math.max(0, Math.min(1000000000, Number(body.target) || 0));
  const winningThrows = Math.max(0, Math.min(1000000, Math.floor(Number(body.winningThrows) || 0)));
  const players = Math.max(0, Math.min(64, Math.floor(Number(body.players) || 1)));
  const gameType = String(body.gameType || body.game_type || "points").trim().slice(0, 40) || "points";
  const completedAt = String(body.completedAt || "").slice(0, 80);
  const visitor = await visitorIdentity(request, env);
  const t = now();

  if (visitor.ip_hash) {
    const recent = await env.VAULT_DB.prepare(
      "SELECT COUNT(*) AS n FROM game_score_versions WHERE ip_hash=? AND recorded_at>?",
    ).bind(visitor.ip_hash, t - 600).first();
    if (Number(recent?.n || 0) >= 60) {
      return json({ ok: false, error: "Score rate limit reached." }, 429);
    }
  }

  const recordJson = cleanJson({
    ...body,
    id: scoreId,
    name,
    score,
    target,
    winningThrows,
    players,
    gameType,
    completedAt,
  });

  const existing = await env.VAULT_DB.prepare(
    "SELECT id,created_at FROM game_scores WHERE id=?",
  ).bind(scoreId).first();

  await env.VAULT_DB.batch([
    env.VAULT_DB.prepare(
      `INSERT INTO game_scores
        (id,created_at,updated_at,game_type,player_name,score,target,winning_throws,players,completed_at,anon_id,ip_hash,ip_ciphertext,country,region,city,record_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         updated_at=excluded.updated_at,
         game_type=excluded.game_type,
         player_name=excluded.player_name,
         score=excluded.score,
         target=excluded.target,
         winning_throws=excluded.winning_throws,
         players=excluded.players,
         completed_at=excluded.completed_at,
         anon_id=COALESCE(excluded.anon_id,game_scores.anon_id),
         ip_hash=COALESCE(excluded.ip_hash,game_scores.ip_hash),
         ip_ciphertext=COALESCE(excluded.ip_ciphertext,game_scores.ip_ciphertext),
         country=COALESCE(excluded.country,game_scores.country),
         region=COALESCE(excluded.region,game_scores.region),
         city=COALESCE(excluded.city,game_scores.city),
         record_json=excluded.record_json`,
    ).bind(
      scoreId,
      existing?.created_at || t,
      t,
      gameType,
      name,
      score,
      target,
      winningThrows,
      players,
      completedAt || null,
      String(body.anon_id || "").slice(0, 160) || null,
      visitor.ip_hash || null,
      visitor.ip_ciphertext || null,
      visitor.country,
      visitor.region,
      visitor.city,
      recordJson,
    ),
    env.VAULT_DB.prepare(
      "INSERT INTO game_score_versions (version_id,score_id,recorded_at,ip_hash,record_json) VALUES (?,?,?,?,?)",
    ).bind(id("scorev"), scoreId, t, visitor.ip_hash || null, recordJson),
  ]);

  return json({ ok: true, id: scoreId, updated: !!existing }, existing ? 200 : 201);
}

function publicReflectionRow(row) {
  let meta = {};
  try { meta = JSON.parse(row.metadata_json || "{}"); } catch {}
  return {
    id: row.id,
    text: row.body || "",
    created: new Date(Number(row.created_at || 0) * 1000).toISOString(),
    updated: new Date(Number(row.updated_at || row.created_at || 0) * 1000).toISOString(),
    universe: Math.max(0, Math.min(31, Number(meta.universe || 0))),
    x: Math.max(2, Math.min(98, Number(meta.x || 50))),
    y: Math.max(3, Math.min(97, Number(meta.y || 50))),
    locationLabel: meta.share_location ? String(meta.location_label || "").slice(0, 80) : "",
    lat: meta.share_location && Number.isFinite(Number(meta.lat)) ? Number(meta.lat) : null,
    lon: meta.share_location && Number.isFinite(Number(meta.lon)) ? Number(meta.lon) : null,
    track: String(meta.track || "").slice(0, 160),
  };
}

async function listPublicReflections(env, url) {
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 300)));
  const rows = await env.VAULT_DB.prepare(
    "SELECT id,created_at,updated_at,body,metadata_json FROM comments WHERE source='radio-soul-reflection' AND status='visible' ORDER BY created_at DESC LIMIT ?",
  ).bind(limit).all();
  return (rows.results || []).map(publicReflectionRow);
}

async function savePublicReflection(request, env) {
  const body = await readBody(request);
  const text = String(body.text || body.body || "").trim();
  if (!text) return json({ ok: false, error: "Reflection is empty." }, 400);
  if (text.length > 5000) return json({ ok: false, error: "Reflection is too long." }, 400);

  const anonId = String(body.anon_id || "").trim();
  if (!/^[A-Za-z0-9._:-]{24,160}$/.test(anonId)) {
    return json({ ok: false, error: "Missing reflection owner token." }, 400);
  }

  const visitor = await visitorIdentity(request, env);
  const requestedId = String(body.id || "").trim();
  const t = now();
  const universe = Math.max(0, Math.min(31, Number(body.universe || 0)));
  const x = Math.max(2, Math.min(98, Number(body.x || 50)));
  const y = Math.max(3, Math.min(97, Number(body.y || 50)));
  const shareLocation = !!body.share_location;
  const lat = shareLocation && Number.isFinite(Number(body.lat))
    ? Math.round(Number(body.lat) * 10) / 10
    : null;
  const lon = shareLocation && Number.isFinite(Number(body.lon))
    ? Math.round(Number(body.lon) * 10) / 10
    : null;
  const metadata = {
    universe,
    x,
    y,
    share_location: shareLocation,
    location_label: shareLocation ? String(body.location_label || "").trim().slice(0, 80) : "",
    lat,
    lon,
    track: String(body.track || "").trim().slice(0, 160),
  };

  let existing = null;
  if (requestedId) {
    existing = await env.VAULT_DB.prepare(
      "SELECT id,anon_id,created_at FROM comments WHERE id=? AND source='radio-soul-reflection'",
    ).bind(requestedId).first();
    if (existing && !constantTimeEqual(existing.anon_id || "", anonId)) {
      return json({ ok: false, error: "This reflection belongs to a different visitor." }, 403);
    }
  }
  if (!existing) {
    existing = await env.VAULT_DB.prepare(
      "SELECT id,anon_id,created_at FROM comments WHERE anon_id=? AND source='radio-soul-reflection' ORDER BY created_at DESC LIMIT 1",
    ).bind(anonId).first();
  }

  if (existing) {
    await env.VAULT_DB.prepare(
      `UPDATE comments SET
        updated_at=?,body=?,status='visible',ip_hash=?,ip_ciphertext=?,country=?,region=?,city=?,metadata_json=?
       WHERE id=? AND anon_id=? AND source='radio-soul-reflection'`,
    ).bind(
      t,
      text,
      visitor.ip_hash || null,
      visitor.ip_ciphertext || null,
      visitor.country,
      visitor.region,
      visitor.city,
      cleanJson(metadata),
      existing.id,
      anonId,
    ).run();
    return json({ ok: true, id: existing.id, updated: true });
  }

  // Public endpoint protection: no more than 6 new reflections from one
  // network identity in ten minutes. Edits to an existing reflection are not
  // counted as new posts.
  if (visitor.ip_hash) {
    const recent = await env.VAULT_DB.prepare(
      "SELECT COUNT(*) AS n FROM comments WHERE source='radio-soul-reflection' AND ip_hash=? AND created_at>?",
    ).bind(visitor.ip_hash, t - 600).first();
    if (Number(recent?.n || 0) >= 6) {
      return json({ ok: false, error: "Please wait before placing another reflection." }, 429);
    }
  }

  const commentId = id("soul");
  await env.VAULT_DB.prepare(
    `INSERT INTO comments
      (id,created_at,updated_at,fan_id,anon_id,source,body,status,ip_hash,ip_ciphertext,country,region,city,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    commentId,
    t,
    t,
    null,
    anonId,
    "radio-soul-reflection",
    text,
    "visible",
    visitor.ip_hash || null,
    visitor.ip_ciphertext || null,
    visitor.country,
    visitor.region,
    visitor.city,
    cleanJson(metadata),
  ).run();

  return json({ ok: true, id: commentId, created: true }, 201);
}


function safeText(value, max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function safeAnonId(value) {
  value = safeText(value, 160);
  return /^[A-Za-z0-9._:-]{16,160}$/.test(value) ? value : "";
}

function safeSessionId(value) {
  value = safeText(value, 160);
  return /^[A-Za-z0-9._:-]{8,160}$/.test(value) ? value : "";
}

function allowedPublicEventType(value) {
  const type = safeText(value, 80).toLowerCase();
  const allowed = new Set([
    "page_view","session_start","session_end","qr_scan",
    "radio_open","radio_play","radio_pause","radio_stop","radio_live",
    "track_start","track_pause","track_resume","track_progress","track_complete","track_stop","track_skip","track_seek",
    "audio_play","audio_pause","audio_end",
    "share_open","share_complete","share_copy","share_track","track_share",
    "download","offline_enable","offline_disable",
    "ship_open","ship_arrival","gate_open","gate_unlock","access_request",
    "soul_reflection","soul_reflection_open","soul_reflection_place","comment_submit",
    "playlist_view","background_change","button_click","control_change","form_submit","internal_link","external_link",
    "game_start","game_complete"
  ]);
  return allowed.has(type) ? type : "";
}

async function ingestPublicFanEvent(request, env) {
  const body = await readBody(request);
  const eventType = allowedPublicEventType(body.event_type);
  if (!eventType) return json({ ok: false, error: "Unsupported event type." }, 400);

  const anonId = safeAnonId(body.anon_id);
  if (!anonId) return json({ ok: false, error: "Missing anonymous visitor ID." }, 400);

  const sessionId = safeSessionId(body.session_id);
  const surface = safeText(body.surface || "website", 40).toLowerCase();
  if (!["website","radio","ship","studio","dj"].includes(surface)) {
    return json({ ok: false, error: "Unsupported surface." }, 400);
  }

  const visitor = await visitorIdentity(request, env);
  const t = now();

  // Abuse ceiling for anonymous browser telemetry. This is intentionally high
  // enough for real media events but blocks runaway loops and scripted floods.
  if (visitor.ip_hash) {
    const recent = await env.VAULT_DB.prepare(
      "SELECT COUNT(*) AS n FROM fan_events WHERE ip_hash=? AND occurred_at>?"
    ).bind(visitor.ip_hash, t - 60).first();
    if (Number(recent?.n || 0) >= 180) {
      return json({ ok: false, error: "Event rate limit reached." }, 429);
    }
  }

  const pageUrl = safeText(body.page_url, 1500);
  let pagePath = safeText(body.page_path, 500);
  let utm = {
    source: safeText(body.utm_source, 120),
    medium: safeText(body.utm_medium, 120),
    campaign: safeText(body.utm_campaign, 160),
    content: safeText(body.utm_content, 160),
    term: safeText(body.utm_term, 160),
  };
  try {
    if (pageUrl) {
      const parsed = new URL(pageUrl);
      if (!pagePath) pagePath = parsed.pathname.slice(0, 500);
      utm.source ||= safeText(parsed.searchParams.get("utm_source"), 120);
      utm.medium ||= safeText(parsed.searchParams.get("utm_medium"), 120);
      utm.campaign ||= safeText(parsed.searchParams.get("utm_campaign"), 160);
      utm.content ||= safeText(parsed.searchParams.get("utm_content"), 160);
      utm.term ||= safeText(parsed.searchParams.get("utm_term"), 160);
    }
  } catch {}

  const eventId = id("event");
  await env.VAULT_DB.prepare(
    `INSERT INTO fan_events
      (id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_url,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,ip_hash,ip_ciphertext,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    eventId,
    t,
    null,
    anonId,
    sessionId || null,
    surface,
    eventType,
    pageUrl || null,
    pagePath || null,
    safeText(body.track_id, 240) || null,
    safeText(body.track_title, 300) || null,
    safeText(body.album, 200) || null,
    safeText(body.playlist_id, 160) || null,
    safeText(body.share_target, 160) || null,
    safeText(body.referrer || request.headers.get("referer"), 1500) || null,
    utm.source || null,
    utm.medium || null,
    utm.campaign || null,
    utm.content || null,
    utm.term || null,
    visitor.ip_hash || null,
    visitor.ip_ciphertext || null,
    safeText(request.headers.get("user-agent"), 1000) || null,
    safeText(body.language || request.headers.get("accept-language"), 200) || null,
    visitor.country,
    visitor.region,
    visitor.city,
    visitor.timezone,
    visitor.cf_colo,
    visitor.cf_asn,
    visitor.cf_as_org,
    cleanJson(body.metadata),
  ).run();

  return json({ ok: true, id: eventId }, 201);
}

async function saveStationPerformance(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const title = safeText(body.track_title || body.title, 300);
  if (!title) return json({ ok: false, error: "Missing track title." }, 400);
  const t = Number(body.occurred_at || now());
  const eventId = id("station");
  const metadata = {
    ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
    server_side: true,
    station: "Grand Element Radio",
  };
  await env.VAULT_DB.prepare(
    `INSERT INTO fan_events
      (id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_url,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,ip_hash,ip_ciphertext,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    eventId,
    t,
    null,
    "ge-radio-station",
    safeText(body.session_id || "station-radio", 160),
    "radio",
    "station_performance",
    null,
    null,
    safeText(body.track_id || body.path, 240) || null,
    title,
    safeText(body.album, 200) || null,
    safeText(body.playlist_id, 160) || null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "GE Radio Automation",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    cleanJson(metadata),
  ).run();
  return json({ ok: true, id: eventId }, 201);
}

async function linkFanIdentity(request, env) {
  if (!ingestAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const anonId = safeAnonId(body.anon_id);
  if (!anonId) return json({ ok: false, error: "Missing anonymous visitor ID." }, 400);
  const visitor = await visitorIdentity(request, env);
  const fanId = await upsertFan(env, {
    fan_id: body.fan_id,
    display_name: safeText(body.display_name, 200) || null,
    email: safeText(body.email, 320) || null,
    phone: safeText(body.phone, 80) || null,
    consent_analytics: !!body.consent_analytics,
    consent_contact: !!body.consent_contact,
    notes: safeText(body.notes, 2000) || null,
    metadata: body.metadata || {},
  }, visitor);

  await env.VAULT_DB.prepare(
    "UPDATE fan_events SET fan_id=? WHERE anon_id=? AND fan_id IS NULL"
  ).bind(fanId, anonId).run();
  await env.VAULT_DB.prepare(
    "UPDATE comments SET fan_id=? WHERE anon_id=? AND fan_id IS NULL"
  ).bind(fanId, anonId).run();
  await env.VAULT_DB.prepare(
    "UPDATE listener_events SET fan_id=? WHERE anon_id=? AND fan_id IS NULL"
  ).bind(fanId, anonId).run();

  await audit(env, "ingest", "fan.link_identity", "fan", fanId, { anon_id: anonId });
  return json({ ok: true, fan_id: fanId });
}

// The public Radio MUSIC menu reads the original GE DJ playlists from the
// same Vault tables used by the authenticated BLITZ DJ. Public output
// additionally requires an explicit PUBLISH LIVE selection by the owner.
// GE MUSIC V4: playlists are read directly from the permanent D1 Vault.
// The publication flag is owner-controlled and never depends on BLITZ.
// Previously published Bangers in an original ge-radio record is retained.
// Uploaded audio remains PRIVATE until a separate verified release process.
// This endpoint records an asset receipt; it never publishes a recording.
async function saveMusicAssetReceipt(request,env){
 if(!adminAuthorized(request,env))return json({ok:false,error:"Owner authorization required."},401);
 const body=await readBody(request);
 const a=body?.asset||{};
 const album=String(a.album_folder||"").trim(),title=String(a.track_title||"").trim();
 const name=String(a.original_filename||"").trim(),key=String(a.storage_key||"");
 const mime=String(a.media_type||"").toLowerCase(),bytes=Number(a.bytes||0);
 const id=String(a.id||"").trim();
 if(!/^music-[a-f0-9-]{36}$/i.test(id)||album.length>150||album.length<4||
    title.length<1||title.length>180||name.length>190||!name||
    !/^staged\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+\.(mp3|m4a|wav|ogg)$/i.test(key)||
    !["audio/mpeg","audio/mp4","audio/wav","audio/x-wav","audio/ogg","application/ogg"].includes(mime)||
    !Number.isSafeInteger(bytes)||bytes<1||bytes>60*1024*1024)
   return json({ok:false,error:"Invalid private audio receipt."},400);
 const t=now();
 await env.VAULT_DB.prepare(
  "INSERT INTO music_assets (id,album_folder,track_title,original_filename,storage_key,media_type,bytes,status,created_at,updated_at,metadata_json) VALUES (?,?,?,?,?,?,?,'staged',?,?,?) ON CONFLICT(id) DO NOTHING"
 ).bind(id,album,title,name,key,mime,bytes,t,t,JSON.stringify({source:"ge-backroom-album-upload",private:true})).run();
 return json({ok:true,id,status:"staged",private:true},200);
}
async function listPublicMusicPlaylists(env){
  const rows=await env.VAULT_DB.prepare(
    "SELECT id,name,updated_at,metadata_json FROM playlists ORDER BY updated_at DESC LIMIT 200"
  ).all();
  const items=[];
  for(const p of rows.results||[]){
    let meta={};try{meta=JSON.parse(p.metadata_json||"{}")}catch(_){}
    const legacyBangers=meta.public===undefined&&String(p.name||"").trim().toLowerCase()==="bangers"&&meta.source==="ge-radio";
    if(meta.public!==true&&!legacyBangers)continue;
    const tracks=await env.VAULT_DB.prepare(
      "SELECT track_path FROM playlist_tracks WHERE playlist_id=? ORDER BY position"
    ).bind(p.id).all();
    const songs=(tracks.results||[]).map(x=>String(x.track_path||"")).filter(path=>
      path.startsWith("ge-music/music/")&&!path.includes("..")&&
      ["mp3","m4a","wav","ogg","flac"].includes(path.split(".").pop().toLowerCase())
    );
    if(!songs.length)continue;
    items.push({id:String(p.id),name:String(p.name),songs,updated_at:Number(p.updated_at)||0});
  }
  return items;
}

async function listPublicDJPlaylists(env){
  // The DJ library is private by default. Only playlists explicitly selected
  // and PUBLISHED by the owner in site-live.json are visible to listeners.
  // Fail closed if the published configuration cannot be verified.
  let permitted,permittedNames=new Set();
  try{
    const configUrl=String(env.GE_PUBLIC_SITE_CONFIG_URL||"https://grandelement.com/config/site-live.json");
    const response=await fetch(configUrl,{cache:"no-store"});
    if(!response.ok)throw new Error("Published config unavailable");
    const config=await response.json();
    // Explicit publication may identify the live original DJ Bangers by name;
    // this follows the real DJ record when the playlist ID changes.
    // Never publish arbitrary private DJ lists or unrelated songs.
    permittedNames=new Set((Array.isArray(config?.music?.publicDJPlaylistNames)?
      config.music.publicDJPlaylistNames:[])
      .filter(name=>typeof name==="string"&&name.trim().toLowerCase()==="bangers")
      .map(name=>name.trim().toLowerCase()));
    permitted=new Map((Array.isArray(config?.music?.publicPlaylists)?
      config.music.publicPlaylists:[]).filter(entry=>
      entry&&typeof entry.id==="string"&&Array.isArray(entry.songs)
    ).map(entry=>[entry.id,new Set(entry.songs.filter(path=>
      typeof path==="string"&&/^ge-music\/music\//.test(path)&&
      !path.includes("..")&&/\.(mp3|m4a|wav|ogg|flac)$/i.test(path)
    ))]));
  }catch(error){
    console.warn("DJ public playlist config check failed",error);
    return [];
  }
  if(!permitted.size&&!permittedNames.size)return [];
  const rows=await env.VAULT_DB.prepare(
    "SELECT id,name,metadata_json FROM playlists ORDER BY active DESC,updated_at DESC LIMIT 200"
  ).all();
  const items=[];
  for(const playlist of rows.results||[]){
    const publishedSongs=permitted.get(String(playlist.id));
    const publishedByName=permittedNames.has(String(playlist.name||"").trim().toLowerCase());
    if(!publishedSongs?.size&&!publishedByName)continue;
    let meta={};
    try{meta=JSON.parse(playlist.metadata_json||"{}")}catch(_e){}
    if(meta.source!=="ge-radio")continue;
    const tracks=await env.VAULT_DB.prepare(
      "SELECT track_path FROM playlist_tracks WHERE playlist_id=? ORDER BY position"
    ).bind(playlist.id).all();
    const songs=(tracks.results||[]).map(row=>String(row.track_path||"")).filter(path=>
      /^ge-music\/music\/.+\.(mp3|m4a|wav|ogg|flac)$/i.test(path)&&
      !path.includes("..")&&(publishedByName||publishedSongs?.has(path)));
    if(songs.length)items.push({id:String(playlist.id),name:String(playlist.name),songs});
  }
  return items;
}

async function listPlaylists(env) {
  const rows = await env.VAULT_DB.prepare(
    "SELECT * FROM playlists ORDER BY active DESC, updated_at DESC",
  ).all();
  const out = [];
  for (const p of rows.results || []) {
    const tracks = await env.VAULT_DB.prepare(
      "SELECT position,track_path,track_title,album FROM playlist_tracks WHERE playlist_id=? ORDER BY position",
    ).bind(p.id).all();
    out.push({ ...p, tracks: tracks.results || [] });
  }
  return out;
}

async function savePlaylist(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const playlistId = String(body.id || id("playlist"));
  const name = String(body.name || "").trim();
  if (!name) return json({ ok: false, error: "Playlist name is required." }, 400);
  const tracks = Array.isArray(body.tracks) ? body.tracks : [];
  const t = now();
  const existing = await env.VAULT_DB.prepare("SELECT created_at,metadata_json FROM playlists WHERE id=?").bind(playlistId).first();
  // Track updates from older clients must not revoke owner publication.
  let prior={};try{prior=JSON.parse(existing?.metadata_json||"{}")}catch(_){}
  const given=body.metadata&&typeof body.metadata==="object"&&!Array.isArray(body.metadata)?body.metadata:{};
  const metadata={...prior,...given};
  if(typeof metadata.public!=="boolean")metadata.public=false;
  const statements = [
    env.VAULT_DB.prepare(
      `INSERT INTO playlists (id,name,created_at,updated_at,active,locked,notes,metadata_json)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         updated_at=excluded.updated_at,
         active=excluded.active,
         locked=excluded.locked,
         notes=excluded.notes,
         metadata_json=excluded.metadata_json`,
    ).bind(
      playlistId,
      name,
      existing?.created_at || t,
      t,
      body.active ? 1 : 0,
      body.locked ? 1 : 0,
      body.notes || null,
      cleanJson(metadata),
    ),
    env.VAULT_DB.prepare("DELETE FROM playlist_tracks WHERE playlist_id=?").bind(playlistId),
  ];

  tracks.forEach((track, index) => {
    statements.push(
      env.VAULT_DB.prepare(
        "INSERT INTO playlist_tracks (playlist_id,position,track_path,track_title,album) VALUES (?,?,?,?,?)",
      ).bind(
        playlistId,
        index,
        String(track.track_path || track.path || ""),
        track.track_title || track.title || null,
        track.album || null,
      ),
    );
  });

  if (body.active) {
    statements.unshift(
      env.VAULT_DB.prepare("UPDATE playlists SET active=0 WHERE active=1"),
    );
  }
  await env.VAULT_DB.batch(statements);
  await env.VAULT_DB.prepare(
    "INSERT INTO playlist_versions (version_id,playlist_id,recorded_at,action,snapshot_json) VALUES (?,?,?,?,?)"
  ).bind(
    id("playlistv"),
    playlistId,
    t,
    existing ? "update" : "create",
    cleanJson({ id: playlistId, name, active: !!body.active, locked: !!body.locked, notes: body.notes || null, metadata, tracks }),
  ).run();
  await audit(env, "admin", "playlist.save", "playlist", playlistId, { name, tracks: tracks.length });
  return json({ ok: true, id: playlistId });
}

async function deletePlaylist(request, env, playlistId) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const row = await env.VAULT_DB.prepare("SELECT * FROM playlists WHERE id=?").bind(playlistId).first();
  if (!row) return json({ ok: false, error: "Playlist not found." }, 404);
  if (row.locked) return json({ ok: false, error: "Playlist is locked." }, 409);
  const tracks = await env.VAULT_DB.prepare(
    "SELECT position,track_path,track_title,album FROM playlist_tracks WHERE playlist_id=? ORDER BY position"
  ).bind(playlistId).all();
  const t = now();
  await env.VAULT_DB.prepare(
    "INSERT INTO playlist_versions (version_id,playlist_id,recorded_at,action,snapshot_json) VALUES (?,?,?,?,?)"
  ).bind(id("playlistv"), playlistId, t, "delete", cleanJson({ ...row, tracks: tracks.results || [] })).run();
  await env.VAULT_DB.prepare("DELETE FROM playlists WHERE id=?").bind(playlistId).run();
  await audit(env, "admin", "playlist.delete", "playlist", playlistId);
  return json({ ok: true, history_retained: true });
}

async function listEffectPresets(env, url) {
  const surface = String(url.searchParams.get("surface") || "dj").trim().slice(0, 40);
  const includeArchived = url.searchParams.get("archived") === "1";
  const sql = includeArchived
    ? "SELECT id,surface,name,archived,created_at,updated_at,settings_json FROM effect_presets WHERE surface=? ORDER BY archived ASC,name COLLATE NOCASE ASC"
    : "SELECT id,surface,name,archived,created_at,updated_at,settings_json FROM effect_presets WHERE surface=? AND archived=0 ORDER BY name COLLATE NOCASE ASC";
  const rows = await env.VAULT_DB.prepare(sql).bind(surface).all();
  return (rows.results || []).map((row) => {
    let settings = {};
    try { settings = JSON.parse(row.settings_json || "{}"); } catch {}
    return { ...row, archived: !!row.archived, settings };
  });
}

async function saveEffectPreset(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const surface = String(body.surface || "dj").trim().slice(0, 40);
  const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!surface || !name) return json({ ok: false, error: "Surface and preset name are required." }, 400);
  const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
  const settingsJson = cleanJson(settings);
  const t = now();

  const existingByName = await env.VAULT_DB.prepare(
    "SELECT id,created_at FROM effect_presets WHERE surface=? AND lower(name)=lower(?) LIMIT 1"
  ).bind(surface, name).first();

  const presetId = String(body.id || existingByName?.id || id("fxpreset")).slice(0, 160);
  const existingById = existingByName || await env.VAULT_DB.prepare(
    "SELECT id,created_at FROM effect_presets WHERE id=?"
  ).bind(presetId).first();

  await env.VAULT_DB.batch([
    env.VAULT_DB.prepare(
      `INSERT INTO effect_presets (id,surface,name,archived,created_at,updated_at,settings_json)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         surface=excluded.surface,
         name=excluded.name,
         archived=0,
         updated_at=excluded.updated_at,
         settings_json=excluded.settings_json`
    ).bind(presetId, surface, name, 0, existingById?.created_at || t, t, settingsJson),
    env.VAULT_DB.prepare(
      "INSERT INTO effect_preset_versions (version_id,preset_id,recorded_at,action,settings_json) VALUES (?,?,?,?,?)"
    ).bind(id("fxver"), presetId, t, existingById ? "update" : "create", settingsJson),
  ]);

  await audit(env, "admin", "effect_preset.save", "effect_preset", presetId, { surface, name });
  return json({ ok: true, id: presetId, name, surface });
}

async function archiveEffectPreset(request, env, presetId) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const row = await env.VAULT_DB.prepare(
    "SELECT id,surface,name,settings_json FROM effect_presets WHERE id=?"
  ).bind(presetId).first();
  if (!row) return json({ ok: false, error: "Preset not found." }, 404);
  const t = now();
  await env.VAULT_DB.batch([
    env.VAULT_DB.prepare("UPDATE effect_presets SET archived=1,updated_at=? WHERE id=?").bind(t, presetId),
    env.VAULT_DB.prepare(
      "INSERT INTO effect_preset_versions (version_id,preset_id,recorded_at,action,settings_json) VALUES (?,?,?,?,?)"
    ).bind(id("fxver"), presetId, t, "archive", row.settings_json || "{}"),
  ]);
  await audit(env, "admin", "effect_preset.archive", "effect_preset", presetId, { surface: row.surface, name: row.name });
  return json({ ok: true, id: presetId });
}

async function listVaultValues(env, url) {
  const kind = url.searchParams.get("kind");
  const scope = url.searchParams.get("scope");
  let sql = "SELECT kind,scope,key,value_text,value_json,locked,sensitivity,version,created_at,updated_at FROM vault_values WHERE 1=1";
  const args = [];
  if (kind) { sql += " AND kind=?"; args.push(kind); }
  if (scope) { sql += " AND scope=?"; args.push(scope); }
  sql += " ORDER BY kind,scope,key";
  const result = await env.VAULT_DB.prepare(sql).bind(...args).all();
  return result.results || [];
}

async function saveVaultValue(request, env) {
  if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const body = await readBody(request);
  const kind = String(body.kind || "");
  if (!["setting", "location", "instruction"].includes(kind)) {
    return json({ ok: false, error: "kind must be setting, location, or instruction." }, 400);
  }
  const scope = String(body.scope || "").trim();
  const key = String(body.key || "").trim();
  if (!scope || !key) return json({ ok: false, error: "scope and key are required." }, 400);

  const existing = await env.VAULT_DB.prepare(
    "SELECT locked,version,created_at FROM vault_values WHERE kind=? AND scope=? AND key=?",
  ).bind(kind, scope, key).first();

  if (existing?.locked && !body.force) {
    return json({ ok: false, error: "This Vault value is locked. Send force=true for an intentional replacement." }, 409);
  }

  const t = now();
  const version = Number(existing?.version || 0) + 1;
  await env.VAULT_DB.prepare(
    `INSERT INTO vault_values
      (kind,scope,key,value_text,value_json,locked,sensitivity,version,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(kind,scope,key) DO UPDATE SET
       value_text=excluded.value_text,
       value_json=excluded.value_json,
       locked=excluded.locked,
       sensitivity=excluded.sensitivity,
       version=excluded.version,
       updated_at=excluded.updated_at`,
  )
    .bind(
      kind,
      scope,
      key,
      body.value_text == null ? null : String(body.value_text),
      body.value_json == null ? null : cleanJson(body.value_json),
      body.locked ? 1 : 0,
      String(body.sensitivity || "private"),
      version,
      existing?.created_at || t,
      t,
    )
    .run();

  await audit(env, "admin", "vault_value.save", kind, scope + "/" + key, { version, locked: !!body.locked });
  return json({ ok: true, kind, scope, key, version });
}

async function adminSummary(env) {
  const names = ["fans", "fan_events", "listener_events", "comments", "playlists", "playlist_versions", "effect_presets", "effect_preset_versions", "vault_values", "audit_log"];
  const counts = {};
  for (const name of names) {
    const row = await env.VAULT_DB.prepare(`SELECT COUNT(*) AS n FROM ${name}`).first();
    counts[name] = Number(row?.n || 0);
  }
  return { ok: true, counts };
}

function parseStoredJson(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function bumpCount(map, key, amount = 1) {
  key = String(key || "").trim();
  if (!key) return;
  map.set(key, Number(map.get(key) || 0) + amount);
}

function topCountRows(map, limit = 25) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function parseEpochParam(value) {
  value = String(value || "").trim();
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric > 1e12 ? numeric / 1000 : numeric);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.round(parsed / 1000) : null;
}

function analyticsWindow(url, defaultDays = 30) {
  const current = now();
  let until = parseEpochParam(url.searchParams.get("end")) || current;
  let since = parseEpochParam(url.searchParams.get("start"));
  let mode = "days";
  if (since != null) {
    mode = "custom";
  } else if (url.searchParams.get("minutes")) {
    const minutes = Math.max(1, Math.min(5256000, Number(url.searchParams.get("minutes")) || 10));
    since = until - Math.round(minutes * 60);
    mode = "minutes";
  } else if (url.searchParams.get("hours")) {
    const hours = Math.max(1 / 60, Math.min(87600, Number(url.searchParams.get("hours")) || 1));
    since = until - Math.round(hours * 3600);
    mode = "hours";
  } else {
    const days = Math.max(1 / 1440, Math.min(3650, Number(url.searchParams.get("days") || defaultDays)));
    since = until - Math.round(days * 86400);
    mode = "days";
  }
  if (until > current + 86400) until = current + 86400;
  if (since > until) [since, until] = [until, since];
  const maxSpan = 3650 * 86400;
  if (until - since > maxSpan) since = until - maxSpan;
  return {
    since,
    until,
    mode,
    range_seconds: Math.max(0, until - since),
    days: Number(((until - since) / 86400).toFixed(6)),
  };
}

function mergeOwnerUxCounts(map, value) {
  if (!value || typeof value !== "object") return;
  for (const [rawName, rawCount] of Object.entries(value).slice(0, 160)) {
    const name = String(rawName || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const count = Math.max(0, Math.min(1000000, Number(rawCount) || 0));
    if (!name || !count) continue;
    bumpCount(map, name, count);
  }
}

async function adminOwnerUxSummary(env, url) {
  const range = analyticsWindow(url, 14);
  const { since, until, days } = range;
  const rows = await env.VAULT_DB.prepare(
    "SELECT occurred_at,anon_id,session_id,metadata_json FROM fan_events WHERE event_type='owner_ux_batch' AND occurred_at>=? AND occurred_at<=? ORDER BY occurred_at ASC LIMIT 50000",
  ).bind(since, until).all();

  const maps = {
    clicks: new Map(),
    changes: new Map(),
    transitions: new Map(),
    backtracks: new Map(),
    repeats: new Map(),
    errors: new Map(),
  };
  const sessions = new Set();
  const anonIds = new Set();
  let lastEventAt = 0;
  let batches = 0;

  for (const row of rows.results || []) {
    const meta = parseStoredJson(row.metadata_json);
    if (!meta.owner_ux) continue;
    batches += 1;
    if (row.session_id) sessions.add(String(row.session_id));
    if (row.anon_id) anonIds.add(String(row.anon_id));
    lastEventAt = Math.max(lastEventAt, Number(row.occurred_at || 0));
    for (const key of Object.keys(maps)) mergeOwnerUxCounts(maps[key], meta[key]);
  }

  const top = (key, limit = 12) => topCountRows(maps[key], limit);
  const signals = [];
  for (const row of top("backtracks", 6)) {
    if (row.count >= 3) signals.push({ kind: "backtrack", ...row, note: "Frequent website back-and-forth navigation." });
  }
  for (const row of top("repeats", 6)) {
    if (row.count >= 3) signals.push({ kind: "repeat", ...row, note: "The same website control was used repeatedly in a short period." });
  }
  for (const row of top("errors", 6)) {
    if (row.count >= 1) signals.push({ kind: "error", ...row, note: "The website reported a JavaScript error while owner UX mode was active." });
  }

  return {
    ok: true,
    days,
    since,
    until,
    last_event_at: lastEventAt,
    session_count: sessions.size,
    owner_device_count: anonIds.size,
    event_batches: batches,
    top_clicks: top("clicks"),
    top_changes: top("changes"),
    top_transitions: top("transitions"),
    top_backtracks: top("backtracks"),
    top_repeats: top("repeats"),
    top_errors: top("errors"),
    signals: signals.slice(0, 12),
  };
}

function analyticsCanonicalTrackTitle(trackTitle, trackId) {
  const current = safeText(trackTitle, 300);
  if (current && !/^(grand element(?: radio)?|radio|unknown)$/i.test(current)) return current;
  let raw = String(trackId || "");
  if (!raw) return current;
  try { raw = decodeURIComponent(raw); } catch {}
  try {
    if (/^https?:\/\//i.test(raw)) raw = new URL(raw).pathname;
  } catch {}
  let base = raw.split(/[\\/]/).pop() || "";
  base = base.split("?")[0].split("#")[0].replace(/\.[A-Za-z0-9]{2,5}$/i, "");
  base = base.replace(/^.*?_\d{1,3}_/, "").replace(/^\d{1,3}[ ._-]+/, "");
  base = base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return safeText(base || current, 300);
}

function analyticsCanonicalAlbum(album, trackId) {
  const current = safeText(album, 200);
  if (current && !/^(grand element|grand element radio|unknown)$/i.test(current)) return current;
  let raw = String(trackId || "");
  try { raw = decodeURIComponent(raw); } catch {}
  const match = raw.match(/ge-music\/music\/Grand Element - \d{4} - ([^/]+)/i);
  if (match && match[1]) return safeText(match[1], 200);
  return current;
}

function analyticsCentralDay(epochSeconds) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(Number(epochSeconds || 0) * 1000));
    const out = {};
    for (const part of parts) if (part.type !== "literal") out[part.type] = part.value;
    return [out.year, out.month, out.day].filter(Boolean).join("-");
  } catch {
    return new Date(Number(epochSeconds || 0) * 1000).toISOString().slice(0, 10);
  }
}

function analyticsEventCategory(eventType) {
  const t = String(eventType || "").toLowerCase();
  if (!t) return "OTHER";
  if (t === "qr_scan") return "QR / ACQUISITION";
  if (t.startsWith("track_") || t.startsWith("audio_")) return "MUSIC";
  if (t.startsWith("radio_")) return "RADIO";
  if (t.startsWith("game_")) return "GAMES";
  if (t.startsWith("share_") || t === "track_share" || t === "download") return "SHARING";
  if (t === "button_click" || t === "control_change" || t === "form_submit") return "CONTROLS";
  if (t === "page_view" || t === "session_start" || t === "session_end" || t === "internal_link" || t === "external_link") return "NAVIGATION";
  if (t.includes("reflection") || t === "comment_submit") return "COMMUNITY";
  if (t.includes("gate") || t.includes("access") || t.includes("offline")) return "ACCESS";
  return "OTHER";
}

async function adminAnalytics(env, url) {
  const range = analyticsWindow(url, 30);
  const { since, until, days } = range;
  const rows = await env.VAULT_DB.prepare(
    "SELECT id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_path,track_id,track_title,album,referrer,utm_source,utm_medium,utm_campaign,user_agent,language,country,region,city,timezone,cf_asn,cf_as_org,metadata_json FROM fan_events WHERE occurred_at>=? AND occurred_at<=? ORDER BY occurred_at ASC LIMIT 50000",
  ).bind(since, until).all();
  const items = rows.results || [];
  const profileRows = await env.VAULT_DB.prepare(
    "SELECT id,display_name,email,phone,country,region,city,timezone,consent_analytics,consent_contact,notes,metadata_json FROM fans"
  ).all();
  const profiles = new Map((profileRows.results || []).map((row) => [String(row.id || ""), row]));

  const visitors = new Set();
  const sessions = new Set();
  const eventCounts = new Map();
  const campaigns = new Map();
  const countries = new Map();
  const regions = new Map();
  const cities = new Map();
  const sources = new Map();
  const qrIds = new Map();
  const placements = new Map();
  const networks = new Map();
  const languages = new Map();
  const referrers = new Map();
  const fanMap = new Map();
  const categories = new Map();
  const surfaces = new Map();
  const activityDays = new Map();

  const mediaSessions = new Map();
  const stationTracks = new Map();

  for (const row of items) {
    if (row.anon_id && row.anon_id !== "ge-radio-station") visitors.add(String(row.anon_id));
    if (row.session_id && row.event_type !== "station_performance") sessions.add(String(row.session_id));
    bumpCount(eventCounts, row.event_type);
    bumpCount(categories, analyticsEventCategory(row.event_type));
    bumpCount(surfaces, row.surface || "website");
    if (row.occurred_at) {
      const day = analyticsCentralDay(row.occurred_at);
      bumpCount(activityDays, day);
    }
    bumpCount(campaigns, row.utm_campaign);
    bumpCount(sources, row.utm_source);
    bumpCount(countries, row.country);
    bumpCount(regions, [row.country, row.region].filter(Boolean).join(" / "));
    bumpCount(cities, [row.region, row.city].filter(Boolean).join(" / "));
    bumpCount(networks, row.cf_as_org || (row.cf_asn ? "ASN " + row.cf_asn : ""));
    bumpCount(languages, row.language);
    if (row.referrer) {
      try { bumpCount(referrers, new URL(row.referrer).host); }
      catch { bumpCount(referrers, row.referrer); }
    }

    const meta = parseStoredJson(row.metadata_json);
    bumpCount(qrIds, meta.qr_id);
    bumpCount(placements, meta.qr_placement || meta.placement);

    if (row.anon_id && row.anon_id !== "ge-radio-station") {
      const anon = String(row.anon_id);
      let fan = fanMap.get(anon);
      if (!fan) {
        fan = {
          anon_id: anon,
          fan_id: row.fan_id || "",
          display_name: "",
          notes: "",
          first_seen_at: row.occurred_at,
          last_seen_at: row.occurred_at,
          events: 0,
          sessions: new Set(),
          page_views: 0,
          qr_scans: 0,
          radio_opens: 0,
          game_completions: 0,
          country: "",
          region: "",
          city: "",
          timezone: "",
          language: "",
          network: "",
          user_agent: "",
          campaign: "",
          qr_id: "",
          placement: "",
          listened_seconds: 0,
          tracks: new Set(),
          event_types: new Map(),
          surfaces: new Map(),
          locations: new Map(),
        };
        fanMap.set(anon, fan);
      }
      fan.first_seen_at = Math.min(Number(fan.first_seen_at || row.occurred_at), Number(row.occurred_at || 0));
      fan.last_seen_at = Math.max(Number(fan.last_seen_at || row.occurred_at), Number(row.occurred_at || 0));
      fan.events += 1;
      bumpCount(fan.event_types, row.event_type);
      bumpCount(fan.surfaces, row.surface || "website");
      bumpCount(fan.locations, [row.city,row.region,row.country].filter(Boolean).join(", "));
      if (row.fan_id) fan.fan_id = String(row.fan_id);
      if (row.session_id) fan.sessions.add(String(row.session_id));
      if (row.event_type === "page_view") fan.page_views += 1;
      if (row.event_type === "qr_scan") fan.qr_scans += 1;
      if (row.event_type === "radio_open") fan.radio_opens += 1;
      if (row.event_type === "game_complete") fan.game_completions += 1;
      if (row.country) fan.country = row.country;
      if (row.region) fan.region = row.region;
      if (row.city) fan.city = row.city;
      if (row.timezone) fan.timezone = row.timezone;
      if (row.language) fan.language = row.language;
      if (row.cf_as_org || row.cf_asn) fan.network = row.cf_as_org || ("ASN " + row.cf_asn);
      if (row.user_agent) fan.user_agent = row.user_agent;
      if (row.utm_campaign) fan.campaign = row.utm_campaign;
      if (meta.qr_id) fan.qr_id = String(meta.qr_id);
      if (meta.qr_placement || meta.placement) fan.placement = String(meta.qr_placement || meta.placement);
    }

    if (row.event_type === "station_performance") {
      const stationTitle = analyticsCanonicalTrackTitle(row.track_title, row.track_id);
      const stationAlbum = analyticsCanonicalAlbum(row.album, row.track_id);
      const stationKey = [row.track_id || "", stationTitle || "", stationAlbum || ""].join("|");
      let st = stationTracks.get(stationKey);
      if (!st) {
        st = {
          track_id: row.track_id || "",
          track_title: stationTitle || "",
          album: stationAlbum || "",
          performances: 0,
          first_played_at: row.occurred_at,
          last_played_at: row.occurred_at,
          ascap_work_id: String(meta.ascap_work_id || ""),
          ascap_title: String(meta.ascap_title || ""),
          ascap_status: String(meta.ascap_status || ""),
          iswc: String(meta.iswc || ""),
          writer: String(meta.writer || ""),
          publisher: String(meta.publisher || ""),
        };
        stationTracks.set(stationKey, st);
      }
      st.performances += 1;
      st.first_played_at = Math.min(Number(st.first_played_at || row.occurred_at), Number(row.occurred_at || 0));
      st.last_played_at = Math.max(Number(st.last_played_at || row.occurred_at), Number(row.occurred_at || 0));
      st.ascap_work_id ||= String(meta.ascap_work_id || "");
      st.ascap_title ||= String(meta.ascap_title || "");
      st.ascap_status ||= String(meta.ascap_status || "");
      st.iswc ||= String(meta.iswc || "");
      st.writer ||= String(meta.writer || "");
      st.publisher ||= String(meta.publisher || "");
      continue;
    }

    if (!String(row.event_type || "").startsWith("track_") &&
        !["audio_play","audio_pause","audio_end"].includes(String(row.event_type || ""))) continue;

    const mediaId = String(meta.media_session_id || row.id || "");
    const key = mediaId || [row.anon_id,row.session_id,row.track_id,row.track_title,row.occurred_at].join("|");
    let s = mediaSessions.get(key);
    if (!s) {
      s = {
        media_session_id: mediaId,
        anon_id: row.anon_id || "",
        track_id: row.track_id || "",
        track_title: analyticsCanonicalTrackTitle(row.track_title, row.track_id),
        album: analyticsCanonicalAlbum(row.album, row.track_id),
        source: String(meta.source || row.surface || ""),
        station_id: !!meta.station_id,
        ascap_work_id: String(meta.ascap_work_id || ""),
        ascap_title: String(meta.ascap_title || ""),
        ascap_status: String(meta.ascap_status || ""),
        iswc: String(meta.iswc || ""),
        writer: String(meta.writer || ""),
        publisher: String(meta.publisher || ""),
        country: row.country || "",
        region: row.region || "",
        city: row.city || "",
        started_at: row.occurred_at,
        ended_at: row.occurred_at,
        listened_seconds: 0,
        completion_pct: null,
        started: false,
        completed: false,
        stopped: false,
      };
      mediaSessions.set(key, s);
    }
    s.track_id ||= row.track_id || "";
    s.track_title ||= analyticsCanonicalTrackTitle(row.track_title, row.track_id);
    s.album ||= analyticsCanonicalAlbum(row.album, row.track_id);
    s.source ||= String(meta.source || row.surface || "");
    s.station_id = s.station_id || !!meta.station_id;
    s.ascap_work_id ||= String(meta.ascap_work_id || "");
    s.ascap_title ||= String(meta.ascap_title || "");
    s.ascap_status ||= String(meta.ascap_status || "");
    s.iswc ||= String(meta.iswc || "");
    s.writer ||= String(meta.writer || "");
    s.publisher ||= String(meta.publisher || "");
    s.ended_at = Math.max(Number(s.ended_at || 0), Number(row.occurred_at || 0));
    s.listened_seconds = Math.max(Number(s.listened_seconds || 0), Number(meta.listened_seconds || 0));
    if (meta.completion_pct != null && Number.isFinite(Number(meta.completion_pct))) {
      s.completion_pct = Math.max(Number(s.completion_pct || 0), Number(meta.completion_pct));
    }
    if (row.event_type === "track_start" || row.event_type === "audio_play") s.started = true;
    if (row.event_type === "track_complete" || row.event_type === "audio_end") s.completed = true;
    if (row.event_type === "track_stop") s.stopped = true;
  }

  const trackMap = new Map();
  for (const s of mediaSessions.values()) {
    if (s.anon_id && s.anon_id !== "ge-radio-station") {
      const fan = fanMap.get(String(s.anon_id));
      if (fan) {
        fan.listened_seconds += Number(s.listened_seconds || 0);
        if (s.track_title || s.track_id) fan.tracks.add(String(s.track_title || s.track_id));
      }
    }
    const key = [s.track_id || "", s.track_title || "", s.album || ""].join("|");
    let t = trackMap.get(key);
    if (!t) {
      t = {
        track_id: s.track_id,
        track_title: s.track_title,
        album: s.album,
        source: s.source,
        station_id: !!s.station_id,
        ascap_work_id: s.ascap_work_id,
        ascap_title: s.ascap_title,
        ascap_status: s.ascap_status,
        iswc: s.iswc,
        writer: s.writer,
        publisher: s.publisher,
        performances: 0,
        completed: 0,
        stopped: 0,
        total_listened_seconds: 0,
        completion_total: 0,
        completion_samples: 0,
        listeners: new Set(),
      };
      trackMap.set(key, t);
    }
    if (s.started) t.performances += 1;
    if (s.completed) t.completed += 1;
    if (s.stopped) t.stopped += 1;
    t.total_listened_seconds += Number(s.listened_seconds || 0);
    if (s.completion_pct != null) {
      t.completion_total += Number(s.completion_pct);
      t.completion_samples += 1;
    }
    if (s.anon_id) t.listeners.add(String(s.anon_id));
    t.ascap_work_id ||= s.ascap_work_id;
    t.ascap_title ||= s.ascap_title;
    t.ascap_status ||= s.ascap_status;
    t.iswc ||= s.iswc;
    t.writer ||= s.writer;
    t.publisher ||= s.publisher;
  }

  const fans = [...fanMap.values()].map((fan) => {
    const profile = fan.fan_id ? profiles.get(String(fan.fan_id)) : null;
    return {
    anon_id: fan.anon_id,
    fan_id: fan.fan_id || "",
    display_name: String(profile?.display_name || ""),
    email: String(profile?.email || ""),
    phone: String(profile?.phone || ""),
    consent_analytics: !!profile?.consent_analytics,
    consent_contact: !!profile?.consent_contact,
    notes: String(profile?.notes || ""),
    profile_metadata: parseStoredJson(profile?.metadata_json),
    identified: !!fan.fan_id,
    first_seen_at: fan.first_seen_at,
    last_seen_at: fan.last_seen_at,
    events: fan.events,
    sessions: fan.sessions.size,
    page_views: fan.page_views,
    qr_scans: fan.qr_scans,
    radio_opens: fan.radio_opens,
    game_completions: fan.game_completions,
    country: fan.country,
    region: fan.region,
    city: fan.city,
    timezone: fan.timezone,
    language: fan.language,
    network: fan.network,
    user_agent: fan.user_agent,
    campaign: fan.campaign,
    qr_id: fan.qr_id,
    placement: fan.placement,
    listened_seconds: Number(fan.listened_seconds.toFixed(2)),
    unique_tracks: fan.tracks.size,
    event_types: topCountRows(fan.event_types, 30),
    surfaces: topCountRows(fan.surfaces, 20),
    locations: topCountRows(fan.locations, 20),
  };
  }).sort((a, b) => b.last_seen_at - a.last_seen_at);

  const stationMusic = [...stationTracks.values()]
    .sort((a, b) => b.performances - a.performances || b.last_played_at - a.last_played_at);

  const music = [...trackMap.values()].map((t) => ({
    track_id: t.track_id,
    track_title: t.track_title,
    album: t.album,
    source: t.source,
    station_id: t.station_id,
    ascap_work_id: t.ascap_work_id,
    ascap_title: t.ascap_title,
    ascap_status: t.ascap_status,
    iswc: t.iswc,
    writer: t.writer,
    publisher: t.publisher,
    performances: t.performances,
    completed: t.completed,
    stopped: t.stopped,
    unique_listeners: t.listeners.size,
    total_listened_seconds: Number(t.total_listened_seconds.toFixed(2)),
    average_listened_seconds: t.performances ? Number((t.total_listened_seconds / t.performances).toFixed(2)) : 0,
    average_completion_pct: t.completion_samples ? Number((t.completion_total / t.completion_samples).toFixed(2)) : null,
  })).sort((a, b) => b.total_listened_seconds - a.total_listened_seconds || b.performances - a.performances);

  const totalListenedSeconds = music.reduce((sum, row) => sum + Number(row.total_listened_seconds || 0), 0);
  const identifiedFans = fans.filter((row) => row.identified).length;
  const actionEvents = ["button_click","control_change","form_submit","internal_link","external_link"]
    .reduce((sum, name) => sum + Number(eventCounts.get(name) || 0), 0);

  const stationPerformanceEvents = items
    .filter((row) => row.event_type === "station_performance")
    .map((row) => {
      const meta = parseStoredJson(row.metadata_json);
      return {
        occurred_at: Number(row.occurred_at || 0),
        track_id: row.track_id || "",
        track_title: analyticsCanonicalTrackTitle(row.track_title, row.track_id),
        album: analyticsCanonicalAlbum(row.album, row.track_id),
        artist: String(meta.artist || "Grand Element"),
        ascap_work_id: String(meta.ascap_work_id || ""),
        ascap_title: String(meta.ascap_title || ""),
        ascap_status: String(meta.ascap_status || ""),
        iswc: String(meta.iswc || ""),
        writer: String(meta.writer || ""),
        publisher: String(meta.publisher || ""),
        source: String(meta.source || "ge-radio-automation"),
      };
    });

  return {
    ok: true,
    days,
    since,
    until,
    range_mode: range.mode,
    range_seconds: range.range_seconds,
    generated_at: now(),
    display_time_zone: "America/Chicago",
    display_time_zone_label: "Kansas City Central Time",
    totals: {
      events: items.length,
      unique_visitors: visitors.size,
      sessions: sessions.size,
      qr_scans: Number(eventCounts.get("qr_scan") || 0),
      page_views: Number(eventCounts.get("page_view") || 0),
      radio_opens: Number(eventCounts.get("radio_open") || 0),
      station_performances: Number(eventCounts.get("station_performance") || 0),
      game_completions: Number(eventCounts.get("game_complete") || 0),
      soul_reflections: Number(eventCounts.get("soul_reflection") || 0) + Number(eventCounts.get("soul_reflection_place") || 0),
      identified_fans: identifiedFans,
      anonymous_fans: Math.max(0, visitors.size - identifiedFans),
      total_listened_seconds: Number(totalListenedSeconds.toFixed(2)),
      interaction_actions: actionEvents,
      countries: countries.size,
      cities: cities.size,
    },
    event_counts: topCountRows(eventCounts, 100),
    activity_groups: topCountRows(categories, 30),
    surfaces: topCountRows(surfaces, 30),
    activity_by_day: [...activityDays.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([name,count]) => ({name,count})),
    acquisition: {
      campaigns: topCountRows(campaigns),
      sources: topCountRows(sources),
      qr_ids: topCountRows(qrIds),
      placements: topCountRows(placements),
    },
    geography: {
      countries: topCountRows(countries),
      regions: topCountRows(regions),
      cities: topCountRows(cities),
    },
    technology: {
      networks: topCountRows(networks),
      languages: topCountRows(languages),
      referrers: topCountRows(referrers),
    },
    fans,
    music,
    station_music: stationMusic,
    station_performance_events: stationPerformanceEvents,
  };
}

async function adminFanDetail(env, url) {
  const anonId = safeAnonId(url.searchParams.get("anon_id"));
  if (!anonId) return { ok: false, error: "Missing anonymous fan ID." };
  const range = analyticsWindow(url, 3650);
  const { since, until, days } = range;
  const rows = await env.VAULT_DB.prepare(
    "SELECT id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json FROM fan_events WHERE anon_id=? AND occurred_at>=? AND occurred_at<=? ORDER BY occurred_at DESC LIMIT 2000",
  ).bind(anonId, since, until).all();
  const events = (rows.results || []).map((row) => ({
    ...row,
    track_title: analyticsCanonicalTrackTitle(row.track_title, row.track_id),
    album: analyticsCanonicalAlbum(row.album, row.track_id),
    metadata: parseStoredJson(row.metadata_json),
    metadata_json: undefined,
  }));
  const fanId = String(events.find((x) => x.fan_id)?.fan_id || "");
  const profile = fanId
    ? await env.VAULT_DB.prepare("SELECT id,display_name,email,phone,country,region,city,timezone,consent_analytics,consent_contact,notes,metadata_json FROM fans WHERE id=?").bind(fanId).first()
    : null;
  const eventCounts = new Map(), surfaceCounts = new Map(), categoryCounts = new Map(), locationCounts = new Map(), sessions = new Set(), tracks = new Set();
  for (const event of events) {
    bumpCount(eventCounts, event.event_type);
    bumpCount(surfaceCounts, event.surface || "website");
    bumpCount(categoryCounts, analyticsEventCategory(event.event_type));
    bumpCount(locationCounts, [event.city,event.region,event.country].filter(Boolean).join(", "));
    if (event.session_id) sessions.add(String(event.session_id));
    if (event.track_title || event.track_id) tracks.add(String(event.track_title || event.track_id));
  }
  return {
    ok: true, anon_id: anonId, fan_id: fanId, profile: profile ? {...profile, metadata: parseStoredJson(profile.metadata_json), metadata_json: undefined} : null,
    days, since, until, events,
    summary: {
      events: events.length,
      sessions: sessions.size,
      unique_tracks: tracks.size,
      event_types: topCountRows(eventCounts, 50),
      surfaces: topCountRows(surfaceCounts, 20),
      activity_groups: topCountRows(categoryCounts, 20),
      locations: topCountRows(locationCounts, 20),
    }
  };
}

async function adminSetFanLabel(request, env) {
  const body = await readBody(request);
  const anonId = safeAnonId(body.anon_id);
  if (!anonId) return json({ ok: false, error: "Missing anonymous fan ID." }, 400);
  const displayName = safeText(body.display_name, 200) || null;
  const notes = safeText(body.notes, 2000) || null;
  const latest = await env.VAULT_DB.prepare(
    "SELECT fan_id,country,region,city,timezone FROM fan_events WHERE anon_id=? ORDER BY occurred_at DESC LIMIT 1"
  ).bind(anonId).first();
  if (!latest) return json({ ok: false, error: "Fan was not found." }, 404);

  let fanId = String(latest.fan_id || "");
  if (!fanId) {
    const linked = await env.VAULT_DB.prepare(
      "SELECT fan_id FROM fan_events WHERE anon_id=? AND fan_id IS NOT NULL AND fan_id<>'' LIMIT 1"
    ).bind(anonId).first();
    fanId = String(linked?.fan_id || id("fan"));
  }
  const existing = await env.VAULT_DB.prepare(
    "SELECT metadata_json FROM fans WHERE id=?"
  ).bind(fanId).first();
  await upsertFan(env, {
    fan_id: fanId,
    display_name: displayName,
    notes,
    metadata: parseStoredJson(existing?.metadata_json),
  }, {
    country: latest.country || null,
    region: latest.region || null,
    city: latest.city || null,
    timezone: latest.timezone || null,
  });

  await env.VAULT_DB.prepare("UPDATE fan_events SET fan_id=? WHERE anon_id=?").bind(fanId, anonId).run();
  await env.VAULT_DB.prepare("UPDATE comments SET fan_id=? WHERE anon_id=? AND fan_id IS NULL").bind(fanId, anonId).run();
  await env.VAULT_DB.prepare("UPDATE listener_events SET fan_id=? WHERE anon_id=? AND fan_id IS NULL").bind(fanId, anonId).run();
  await audit(env, "admin", "fan.label", "fan", fanId, { anon_id: anonId, display_name: displayName || "" });
  return json({ ok: true, anon_id: anonId, fan_id: fanId, display_name: displayName || "", notes: notes || "" });
}

async function adminExport(env) {
  const values = await env.VAULT_DB.prepare("SELECT * FROM vault_values ORDER BY kind,scope,key").all();
  const playlists = await listPlaylists(env);
  const fans = await env.VAULT_DB.prepare("SELECT * FROM fans ORDER BY created_at").all();
  const fanEvents = await env.VAULT_DB.prepare("SELECT id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_url,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json FROM fan_events ORDER BY occurred_at").all();
  const comments = await env.VAULT_DB.prepare("SELECT * FROM comments ORDER BY created_at").all();
  return {
    format: "ge-studios-vault-export-v1",
    exported_at: now(),
    values: values.results || [],
    playlists,
    fans: fans.results || [],
    fan_events: fanEvents.results || [],
    comments: comments.results || [],
  };
}


/* All Radio Gate codes live in D1, including migrated legacy LOVE. */
const GE_ACCESS_SCOPES = new Set(["website","radio","music","albums","games"]);
function accessNormalizeCode(raw) {
  // Preserve all previously issued GE-XXXX 32-hex secrets. Only remove a GE
  // prefix when followed by a separator, not from owner codes like GENTLE123.
  return String(raw || "").trim().toUpperCase().replace(/^GE[\s-]+/, "").replace(/[\s-]/g, "");
}
async function accessCodeHash(raw, env) {
  const code = accessNormalizeCode(raw);
  // The original 32-hex codes remain valid; owner-chosen alphanumeric codes
  // use the same keyed HMAC and require a longer minimum for online safety.
  // Existing short LOVE is the sole exception; newly issued codes require 12–64 characters.
  if (code !== "LOVE" && !/^[A-Z0-9]{12,64}$/.test(code)) return null;
  if (!String(env.VAULT_HASH_KEY || "").trim()) throw new Error("Vault code hashing secret is not configured.");
  return hmacHex("ge-access-v1:" + code, env.VAULT_HASH_KEY);
}
function accessAssignments(body) {
  const rawPlaylists=Array.isArray(body.playlist_ids)?body.playlist_ids:[];
  const rawTracks=Array.isArray(body.track_paths)?body.track_paths:[];
  if(rawPlaylists.length>40||rawTracks.length>250)return {error:"Too many content assignments."};
  const playlist_ids=[...new Set(rawPlaylists.map(String).map(x=>x.trim()))];
  const track_paths=[...new Set(rawTracks.map(String).map(x=>x.trim()))];
  if(playlist_ids.some(x=>!/^[a-zA-Z0-9_-]{1,100}$/.test(x)))
    return {error:"Invalid playlist identifier."};
  if(track_paths.some(x=>x.length>600||!/^ge-music\/music\//.test(x)||!/\.(mp3|m4a|wav|ogg|flac)$/i.test(x)))
    return {error:"Invalid song assignment."};
  const scopes=Array.isArray(body.scopes)?body.scopes:[];
  if((playlist_ids.length||track_paths.length)&&!scopes.some(x=>["website","radio","music","albums"].includes(x)))
    return {error:"Song and playlist assignments require a music or radio permission."};
  return {playlist_ids,track_paths};
}
function accessPublicRow(row) {
  if (!row) return null;
  return {
    id: row.id,label:row.label,code_hint:row.code_hint,
    scopes:JSON.parse(row.scopes_json || "[]"),duration_mode:row.duration_mode,
    duration_seconds:row.duration_seconds,fixed_expires_at:row.fixed_expires_at,
    expires_at:row.expires_at,activated_at:row.activated_at,first_used_at:row.first_used_at,
    max_uses:row.max_uses,use_count:row.use_count,enabled:!!row.enabled,
    revoked:!!row.revoked_at,created_at:row.created_at,updated_at:row.updated_at,
    playlist_ids:JSON.parse(row.playlist_ids_json||"[]"),track_paths:JSON.parse(row.track_paths_json||"[]")
  };
}
// One-time migration on authenticated owner code-list request. An existing,
// suspended, revoked or deleted record is never recreated.
// Minimal additive D1 schema repair, performed ONLY after a successful
// server-side owner/Access Codes authorization. Wrangler's public D1 API
// token has Workers deploy permission but may not have D1 Edit permission;
// the already-bound Vault Worker has narrowly scoped database access.
// These exact definitions match migrations/20261021_access_codes.sql.
// All commands are IF NOT EXISTS / INSERT OR IGNORE: no DROP, DELETE,
// replacement, or modification of existing code records.
async function ensureAccessCodeTables(env){
  const required=[
    "SELECT id FROM access_code_policy LIMIT 1",
    "SELECT id FROM access_codes LIMIT 1",
    "SELECT code_id FROM access_code_content LIMIT 1",
    "SELECT code_id FROM access_code_deletions LIMIT 1"
  ];
  let allPresent=true;
  for(const query of required){
    try{await env.VAULT_DB.prepare(query).first()}
    catch(_){allPresent=false;break}
  }
  if(allPresent)return false;
  const statements=[
    `CREATE TABLE IF NOT EXISTS access_code_policy (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )`,
    "INSERT OR IGNORE INTO access_code_policy (id,enabled,updated_at) VALUES (1,1,0)",
    `CREATE TABLE IF NOT EXISTS access_codes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      code_hash TEXT NOT NULL UNIQUE,
      code_hint TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      duration_mode TEXT NOT NULL CHECK (duration_mode IN ('activation','first_use','fixed','none')),
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      fixed_expires_at INTEGER,
      expires_at INTEGER,
      activated_at INTEGER,
      first_used_at INTEGER,
      max_uses INTEGER NOT NULL DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 0,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_access_codes_created ON access_codes(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_access_codes_hash ON access_codes(code_hash)",
    `CREATE TABLE IF NOT EXISTS access_code_content (
      code_id TEXT PRIMARY KEY,
      playlist_ids_json TEXT NOT NULL DEFAULT '[]',
      track_paths_json TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (code_id) REFERENCES access_codes(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS access_code_deletions (
      code_id TEXT PRIMARY KEY,
      deleted_at INTEGER NOT NULL,
      FOREIGN KEY (code_id) REFERENCES access_codes(id) ON DELETE CASCADE
    )`
  ];
  await env.VAULT_DB.batch(statements.map(statement=>env.VAULT_DB.prepare(statement)));
  // D1 created these tables in an atomic batch. This query must succeed
  // before LOVE is ever imported or any code is created.
  for(const query of required)await env.VAULT_DB.prepare(query).first();
  return true;
}
async function ensureLegacyLoveRecord(env){
  const hash=await accessCodeHash("LOVE",env);
  const existing=await env.VAULT_DB.prepare("SELECT id FROM access_codes WHERE code_hash=?").bind(hash).first();
  if(existing)return {id:existing.id,created:false};
  const t=now(),codeId="access_legacy_love_v1";
  await env.VAULT_DB.batch([
    env.VAULT_DB.prepare(
      "INSERT OR IGNORE INTO access_codes (id,label,code_hash,code_hint,scopes_json,duration_mode,duration_seconds,fixed_expires_at,expires_at,activated_at,max_uses,use_count,enabled,revoked_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(codeId,"LOVE · Original Radio Gate",hash,"LOVE",JSON.stringify(["radio"]),"none",0,null,null,t,0,0,1,null,t,t),
    env.VAULT_DB.prepare(
      "INSERT OR IGNORE INTO access_code_content(code_id,playlist_ids_json,track_paths_json,updated_at) VALUES(?,?,?,?)"
    ).bind(codeId,"[]","[]",t)
  ]);
  await audit(env,"system","access.legacy-love-migrate","access_code",codeId,{
    source:"original_radio_gate",scope:"radio",short_legacy_code:true
  });
  return {id:codeId,created:true};
}
async function accessAdminGet(request, env) {
  if (!accessCodesAuthorized(request, env)) return json({ok:false,error:"Unauthorized"},401);
  await ensureAccessCodeTables(env);
  await ensureLegacyLoveRecord(env);
  const [policy,rows]=await Promise.all([
    env.VAULT_DB.prepare("SELECT enabled FROM access_code_policy WHERE id=1").first(),
    env.VAULT_DB.prepare("SELECT a.*,COALESCE(c.playlist_ids_json,'[]') AS playlist_ids_json,COALESCE(c.track_paths_json,'[]') AS track_paths_json FROM access_codes a LEFT JOIN access_code_content c ON c.code_id=a.id LEFT JOIN access_code_deletions d ON d.code_id=a.id WHERE d.code_id IS NULL ORDER BY a.created_at DESC LIMIT 500").all()
  ]);
  return json({ok:true,master_enabled:policy?.enabled!==0,items:(rows.results||[]).map(accessPublicRow)});
}
async function accessAdminChange(request,env){
  if (!accessCodesAuthorized(request, env)) return json({ok:false,error:"Unauthorized"},401);
  await ensureAccessCodeTables(env);
  const body=await readBody(request), action=String(body.action||"");
  const t=now();
  if(action==="master"){
    const enabled=!!body.enabled;
    await env.VAULT_DB.prepare("INSERT INTO access_code_policy(id,enabled,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at").bind(enabled?1:0,t).run();
    await audit(env,"admin","access.master","access_policy","1",{enabled});
    return json({ok:true,master_enabled:enabled});
  }
  if(action==="issue"){
    const label=String(body.label||"").trim().slice(0,100);
    if(!label)return json({ok:false,error:"Enter a code label."},400);
    const scopes=Array.isArray(body.scopes)?[...new Set(body.scopes.map(String).filter(x=>GE_ACCESS_SCOPES.has(x)))]:[];
    if(!scopes.length)return json({ok:false,error:"Choose at least one permission."},400);
    const mode=String(body.duration_mode||"first_use");
    if(!["activation","first_use","fixed","none"].includes(mode))return json({ok:false,error:"Invalid expiration mode."},400);
    const hours=Number(body.duration_hours)||0;
    if(["activation","first_use"].includes(mode)&&(!Number.isFinite(hours)||hours<=0||hours>24*365*5))return json({ok:false,error:"Duration must be between 1 hour and 5 years."},400);
    const seconds=["activation","first_use"].includes(mode)?Math.round(hours*3600):0;
    const fixed=mode==="fixed"?Math.floor(Number(body.fixed_expires_at)||0):null;
    if(mode==="fixed"&&(!fixed||fixed<=t||fixed>t+10*365*24*3600))return json({ok:false,error:"Choose a future expiration date."},400);
    const maxUses=Math.floor(Number(body.max_uses)||0);
    if(maxUses<0||maxUses>1000000)return json({ok:false,error:"Max uses must be 0 to 1,000,000."},400);
    const assignments=accessAssignments(body);
    if(assignments.error)return json({ok:false,error:assignments.error},400);
    const requested=String(body.requested_code||"").trim().toUpperCase();
    if(requested&&(!/^[A-Z0-9-]{12,64}$/.test(requested)||
        !/^[A-Z0-9]{12,64}$/.test(accessNormalizeCode(requested))))
      return json({ok:false,error:"Use 12–64 letters, numbers or dashes after the optional GE prefix."},400);
    const codeBytes=crypto.getRandomValues(new Uint8Array(16));
    const hex=Array.from(codeBytes,b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
    const code=requested||("GE-"+hex.match(/.{4}/g).join("-"));
    const hash=await accessCodeHash(code,env);
    if(!hash)return json({ok:false,error:"Invalid access code."},400);
    // Code hashes are unique: never replace the secret or assignment of an
    // existing access code with a different person's typed value.
    const collision=await env.VAULT_DB.prepare("SELECT id FROM access_codes WHERE code_hash=?").bind(hash).first();
    if(collision)return json({ok:false,error:"This access code already exists. Enter a different code."},409);
    const hint=code.replace(/-/g,"").slice(-4);
    const activate=body.activate_now!==false;
    const activatedAt=activate?t:null;
    const expiry=mode==="fixed"?fixed:mode==="activation"&&activate?t+seconds:null;
    const newId=id("access");
    await env.VAULT_DB.batch([
      env.VAULT_DB.prepare(
        "INSERT INTO access_codes (id,label,code_hash,code_hint,scopes_json,duration_mode,duration_seconds,fixed_expires_at,expires_at,activated_at,max_uses,use_count,enabled,revoked_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(newId,label,hash,hint,JSON.stringify(scopes),mode,seconds,fixed,expiry,activatedAt,maxUses,0,activate?1:0,null,t,t),
      env.VAULT_DB.prepare("INSERT INTO access_code_content (code_id,playlist_ids_json,track_paths_json,updated_at) VALUES(?,?,?,?)")
        .bind(newId,JSON.stringify(assignments.playlist_ids),JSON.stringify(assignments.track_paths),t)
    ]);
    await audit(env,"admin","access.issue","access_code",newId,{label,scopes,mode,max_uses:maxUses,playlist_ids:assignments.playlist_ids,track_count:assignments.track_paths.length});
    return json({ok:true,id:newId,code,record:{id:newId,label,code_hint:hint,scopes,duration_mode:mode,activated_at:activatedAt,expires_at:expiry,max_uses:maxUses,use_count:0,enabled:activate,revoked:false}});
  }
  if(action==="edit"){
    const codeId=String(body.id||"").slice(0,100);
    const existing=await env.VAULT_DB.prepare("SELECT * FROM access_codes WHERE id=? AND NOT EXISTS(SELECT 1 FROM access_code_deletions WHERE code_id=access_codes.id)").bind(codeId).first();
    if(!existing)return json({ok:false,error:"Access code not found."},404);
    if(existing.revoked_at)return json({ok:false,error:"Revoked codes cannot be edited."},409);
    const label=String(body.label||"").trim().slice(0,100);
    if(!label)return json({ok:false,error:"Enter a code label."},400);
    const scopes=Array.isArray(body.scopes)?[...new Set(body.scopes.map(String).filter(x=>GE_ACCESS_SCOPES.has(x)))]:[];
    if(!scopes.length)return json({ok:false,error:"Choose at least one permission."},400);
    const mode=String(body.duration_mode||"first_use");
    if(!["activation","first_use","fixed","none"].includes(mode))return json({ok:false,error:"Invalid expiration mode."},400);
    const hours=Number(body.duration_hours)||0;
    if(["activation","first_use"].includes(mode)&&(!Number.isFinite(hours)||hours<=0||hours>24*365*5))return json({ok:false,error:"Duration must be 1 hour to 5 years."},400);
    const seconds=["activation","first_use"].includes(mode)?Math.round(hours*3600):0;
    const fixed=mode==="fixed"?Math.floor(Number(body.fixed_expires_at)||0):null;
    if(mode==="fixed"&&(!fixed||fixed<=t||fixed>t+10*365*24*3600))return json({ok:false,error:"Choose a future expiration date."},400);
    const maxUses=Math.floor(Number(body.max_uses)||0);
    if(maxUses<0||maxUses>1000000)return json({ok:false,error:"Max uses must be 0 to 1,000,000."},400);
    const assignments=accessAssignments({...body,scopes});
    if(assignments.error)return json({ok:false,error:assignments.error},400);
    for(const playlistId of assignments.playlist_ids){
      const match=await env.VAULT_DB.prepare("SELECT id FROM playlists WHERE id=?").bind(playlistId).first();
      if(!match)return json({ok:false,error:"One assigned playlist no longer exists."},400);
    }
    // Editing never replaces the secret, clears existing usage, or restarts elapsed time.
    const expiry=mode==="fixed"?fixed:mode==="activation"&&existing.activated_at?existing.activated_at+seconds
      :mode==="first_use"&&existing.first_used_at?existing.first_used_at+seconds:null;
    await env.VAULT_DB.batch([
      env.VAULT_DB.prepare("UPDATE access_codes SET label=?,scopes_json=?,duration_mode=?,duration_seconds=?,fixed_expires_at=?,expires_at=?,max_uses=?,updated_at=? WHERE id=?")
        .bind(label,JSON.stringify(scopes),mode,seconds,fixed,expiry,maxUses,t,codeId),
      env.VAULT_DB.prepare("INSERT INTO access_code_content(code_id,playlist_ids_json,track_paths_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(code_id) DO UPDATE SET playlist_ids_json=excluded.playlist_ids_json,track_paths_json=excluded.track_paths_json,updated_at=excluded.updated_at")
        .bind(codeId,JSON.stringify(assignments.playlist_ids),JSON.stringify(assignments.track_paths),t)
    ]);
    await audit(env,"admin","access.edit","access_code",codeId,{label,scopes,mode,playlist_ids:assignments.playlist_ids,track_count:assignments.track_paths.length});
    return json({ok:true,id:codeId,action:"edit"});
  }
  if(action==="activate"||action==="suspend"||action==="revoke"||action==="delete"){
    const codeId=String(body.id||"").slice(0,100);
    const existing=await env.VAULT_DB.prepare("SELECT * FROM access_codes WHERE id=? AND NOT EXISTS(SELECT 1 FROM access_code_deletions WHERE code_id=access_codes.id)").bind(codeId).first();
    if(!existing)return json({ok:false,error:"Access code not found."},404);
    if(existing.revoked_at&&action!=="delete")return json({ok:false,error:"Revoked codes cannot be reactivated. Issue a new code."},409);
    if(action==="activate"){
      const activatedAt=existing.activated_at||t;
      const exp=existing.duration_mode==="activation"?activatedAt+existing.duration_seconds:existing.expires_at;
      if(exp&&exp<=t)return json({ok:false,error:"Code is expired. Issue a new one."},409);
      await env.VAULT_DB.prepare("UPDATE access_codes SET enabled=1,activated_at=?,expires_at=?,updated_at=? WHERE id=?").bind(activatedAt,exp,t,codeId).run();
    }else if(action==="suspend"){
      await env.VAULT_DB.prepare("UPDATE access_codes SET enabled=0,updated_at=? WHERE id=?").bind(t,codeId).run();
    }else if(action==="revoke"){
      await env.VAULT_DB.prepare("UPDATE access_codes SET enabled=0,revoked_at=?,updated_at=? WHERE id=?").bind(t,t,codeId).run();
    }else{
      await env.VAULT_DB.batch([
        env.VAULT_DB.prepare("UPDATE access_codes SET enabled=0,revoked_at=COALESCE(revoked_at,?),updated_at=? WHERE id=?").bind(t,t,codeId),
        env.VAULT_DB.prepare("INSERT OR IGNORE INTO access_code_deletions(code_id,deleted_at) VALUES(?,?)").bind(codeId,t)
      ]);
    }
    await audit(env,"admin","access."+action,"access_code",codeId,{});
    return json({ok:true,id:codeId,action});
  }
  return json({ok:false,error:"Unknown access-code action."},400);
}
// Dedicated MUSIC code sessions use the existing secure code records and D1.
// Redeeming consumes one allowed use. Subsequent track verifications do not
// increment uses. Suspension/revocation are checked on every verification.
// This DOES NOT turn Radio 1/2 into personalized broadcasts.
async function accessMusicSession(request,env){
  const policy=await env.VAULT_DB.prepare("SELECT enabled FROM access_code_policy WHERE id=1").first();
  if(policy?.enabled===0)return json({ok:false,error:"Access codes are disabled."},403);
  const body=await readBody(request),action=String(body.action||"redeem"),t=now();
  const query=String.raw`SELECT a.*,COALESCE(c.playlist_ids_json,'[]') AS playlist_ids_json,
   COALESCE(c.track_paths_json,'[]') AS track_paths_json,d.deleted_at
   FROM access_codes a LEFT JOIN access_code_content c ON c.code_id=a.id
   LEFT JOIN access_code_deletions d ON d.code_id=a.id`;
  let row,sessionExpires=0;
  if(action==="redeem"){
    const hash=await accessCodeHash(body.code,env);
    if(!hash)return json({ok:false,error:"Invalid Music code."},403);
    row=await env.VAULT_DB.prepare(query+" WHERE a.code_hash=?").bind(hash).first();
  }else if(action==="verify"){
    const token=String(body.token||""),parts=token.split(".");
    if(parts.length!==4||!/^access_[0-9a-f-]{36}$/.test(parts[0])||
       !/^[0-9]{10}$/.test(parts[1])||!/^[0-9a-f]{32}$/.test(parts[2])||
       !/^[0-9a-f]{64}$/.test(parts[3]))
      return json({ok:false,error:"Music session invalid."},403);
    const [codeId,until,nonce,sig]=parts;
    sessionExpires=Number(until);
    if(sessionExpires<=t||sessionExpires>t+3600)
      return json({ok:false,error:"Music session expired."},403);
    const expected=await hmacHex("ge-music-session-v1:"+codeId+"."+until+"."+nonce,env.VAULT_HASH_KEY);
    if(!constantTimeEqual(sig,expected))
      return json({ok:false,error:"Music session invalid."},403);
    row=await env.VAULT_DB.prepare(query+" WHERE a.id=?").bind(codeId).first();
  }else return json({ok:false,error:"Unknown Music session action."},400);
  if(!row||!row.enabled||row.revoked_at||row.deleted_at)
    return json({ok:false,error:"Music access code inactive."},403);
  const scopes=JSON.parse(row.scopes_json||"[]");
  if(!scopes.some(scope=>["music","albums","website"].includes(scope)))
    return json({ok:false,error:"This code does not permit Music."},403);
  const playlistIds=JSON.parse(row.playlist_ids_json||"[]");
  const allowedPaths=[...new Set(JSON.parse(row.track_paths_json||"[]"))];
  // The old D1 playlist IDs are NOT the new GitHub IDs. Disallow mutable
  // playlist-only grants until explicitly converted to track paths by owner.
  if(playlistIds.length&&!allowedPaths.length)
    return json({ok:false,error:"Owner must update the song assignments for this code."},403);
  const expires=row.expires_at||null;
  if(expires&&Number(expires)<=t)
    return json({ok:false,error:"Music code expired."},403);
  if(action==="verify"){
    if(expires&&sessionExpires>Number(expires))
      return json({ok:false,error:"Music session expired."},403);
    const track=String(body.track_path||"");
    if(!/^ge-music\/music\/.+\.(mp3|m4a|wav|ogg|flac)$/i.test(track)||track.includes(".."))
      return json({ok:false,error:"Invalid song path."},400);
    if(allowedPaths.length&&!allowedPaths.includes(track))
      return json({ok:false,error:"This code does not include that song."},403);
    return json({ok:true,authorized:true,track_path:track,session_expires_at:sessionExpires});
  }
  if(row.max_uses>0&&row.use_count>=row.max_uses)
    return json({ok:false,error:"Code usage limit reached."},403);
  const newExpires=row.duration_mode==="first_use"?
    (expires||t+Number(row.duration_seconds)):expires;
  if(newExpires&&Number(newExpires)<=t)
    return json({ok:false,error:"Music code expired."},403);
  const update=await env.VAULT_DB.prepare(
    "UPDATE access_codes SET use_count=use_count+1,first_used_at=COALESCE(first_used_at,?),expires_at=COALESCE(expires_at,?),updated_at=? WHERE id=? AND enabled=1 AND revoked_at IS NULL AND (max_uses=0 OR use_count<max_uses) AND (expires_at IS NULL OR expires_at>?)"
  ).bind(t,newExpires,t,row.id,t).run();
  if(!update.meta?.changes)return json({ok:false,error:"Music code no longer active."},403);
  sessionExpires=Math.min(t+3600,Number(newExpires||t+3600));
  const random=crypto.getRandomValues(new Uint8Array(16));
  const nonce=Array.from(random,b=>b.toString(16).padStart(2,"0")).join("");
  const unsigned=row.id+"."+sessionExpires+"."+nonce;
  const sig=await hmacHex("ge-music-session-v1:"+unsigned,env.VAULT_HASH_KEY);
  await audit(env,"public","access.music-session","access_code",row.id,{
    restricted:allowedPaths.length>0,track_count:allowedPaths.length
  });
  return json({ok:true,token:unsigned+"."+sig,session_expires_at:sessionExpires,
    restricted:allowedPaths.length>0,allowed_tracks:allowedPaths});
}

async function accessRedeem(request,env){
  const policy=await env.VAULT_DB.prepare("SELECT enabled FROM access_code_policy WHERE id=1").first();
  if(policy?.enabled===0)return json({ok:false,error:"Access codes are disabled."},403);
  const body=await readBody(request);
  // Backwards-compatible first use: migrate the historic LOVE code into the
  // same D1 table BEFORE checking it, without requiring an owner to sign in
  // first. The migration never revives a revoked/suspended/deleted code.
  if(accessNormalizeCode(body.code)==="LOVE")await ensureLegacyLoveRecord(env);
  const hash=await accessCodeHash(body.code,env);
  if(!hash)return json({ok:false,error:"Invalid or expired code."},403);
  const row=await env.VAULT_DB.prepare("SELECT a.*,COALESCE(c.playlist_ids_json,'[]') AS playlist_ids_json,COALESCE(c.track_paths_json,'[]') AS track_paths_json,d.deleted_at FROM access_codes a LEFT JOIN access_code_content c ON c.code_id=a.id LEFT JOIN access_code_deletions d ON d.code_id=a.id WHERE a.code_hash=?").bind(hash).first();
  if(!row||!row.enabled||row.revoked_at||row.deleted_at)return json({ok:false,error:"Invalid or expired code."},403);
  const scope=String(body.scope||"radio");
  const scopes=JSON.parse(row.scopes_json||"[]");
  if(!scopes.includes(scope)&&!scopes.includes("website"))return json({ok:false,error:"Code does not permit this content."},403);
  const playlist_ids=JSON.parse(row.playlist_ids_json||"[]"),track_paths=JSON.parse(row.track_paths_json||"[]");
  if(playlist_ids.length||track_paths.length){
    const playlistId=String(body.playlist_id||""),trackPath=String(body.track_path||"");
    if(!(playlistId&&playlist_ids.includes(playlistId))&&!(trackPath&&track_paths.includes(trackPath)))
      return json({ok:false,error:"This code is assigned to different music content."},403);
  }
  const t=now();
  const expiration=row.duration_mode==="fixed"?row.fixed_expires_at
    :row.duration_mode==="activation"?row.expires_at
    :row.duration_mode==="first_use"&&row.first_used_at?row.expires_at:null;
  if(expiration&&expiration<=t)return json({ok:false,error:"Invalid or expired code."},403);
  if(row.max_uses>0&&row.use_count>=row.max_uses)return json({ok:false,error:"Code usage limit reached."},403);
  const firstUsed=row.first_used_at||t;
  const expires=row.duration_mode==="first_use"?(row.expires_at||firstUsed+row.duration_seconds):expiration;
  const update=await env.VAULT_DB.prepare(
    "UPDATE access_codes SET use_count=use_count+1,first_used_at=COALESCE(first_used_at,?),expires_at=COALESCE(expires_at,?),updated_at=? WHERE id=? AND enabled=1 AND revoked_at IS NULL AND (max_uses=0 OR use_count<max_uses) AND (expires_at IS NULL OR expires_at>?)"
  ).bind(t,expires,t,row.id,t).run();
  if(!update.meta?.changes)return json({ok:false,error:"Invalid or expired code."},403);
  await audit(env,"public","access.redeem","access_code",row.id,{scope});
  // No long-lived auth cookie is issued here. Public applications must implement
  // server-verified scoped entitlement before using this as a paid access gate.
  return json({ok:true,scope,scopes,expires_at:expires||null,uses_remaining:row.max_uses>0?Math.max(0,row.max_uses-row.use_count-1):null});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers": "Authorization,Content-Type,X-GE-Vault-Key",
          "access-control-max-age": "86400",
        },
      });
    }

    try {
      if (url.pathname === "/health") {
        // A Worker process can respond while its D1 binding or migrations are
        // missing. Health must verify the real permanent playlist storage.
        if (!env.VAULT_DB) return json({
          ok: false, service: "GE Studios Vault", storage: "D1 NOT BOUND", time: now(),
        }, 503, cors);
        try {
          await env.VAULT_DB.prepare("SELECT id FROM playlists LIMIT 1").first();
        } catch (_error) {
          return json({
            ok: false, service: "GE Studios Vault", storage: "PLAYLIST TABLE UNAVAILABLE",
            time: now(),
          }, 503, cors);
        }
        let accessCodesReady = true;
        try {
          await env.VAULT_DB.prepare("SELECT id FROM access_codes LIMIT 1").first();
        } catch (_error) {
          accessCodesReady = false;
        }
        return json({
          ok: true, service: "GE Studios Vault", storage: "READY",
          access_codes_ready: accessCodesReady, time: now(),
        }, 200, cors);
      }

      if (url.pathname === "/v1/public/access/music-session" && request.method === "POST") {
        const response=await accessMusicSession(request,env);
        Object.entries(cors).forEach(([k,v])=>response.headers.set(k,v));
        return response;
      }
      if (url.pathname === "/v1/public/access/redeem" && request.method === "POST") {
        const response=await accessRedeem(request,env);
        Object.entries(cors).forEach(([k,v])=>response.headers.set(k,v));
        return response;
      }
      if (url.pathname === "/v1/admin/access-codes" && request.method === "GET") {
        const response=await accessAdminGet(request,env);
        Object.entries(cors).forEach(([k,v])=>response.headers.set(k,v));
        return response;
      }
      if (url.pathname === "/v1/admin/access-codes" && request.method === "POST") {
        const response=await accessAdminChange(request,env);
        Object.entries(cors).forEach(([k,v])=>response.headers.set(k,v));
        return response;
      }

      if (url.pathname === "/v1/public/game-scores" && request.method === "GET") {
        return json({ ok: true, items: await listPublicGameScores(env, url) }, 200, cors);
      }

      if (url.pathname === "/v1/public/game-scores" && request.method === "POST") {
        const response = await savePublicGameScore(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/public/event" && request.method === "POST") {
        const response = await ingestPublicFanEvent(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/public/reflections" && request.method === "GET") {
        return json({ ok: true, items: await listPublicReflections(env, url) }, 200, cors);
      }

      if (url.pathname === "/v1/public/reflections" && request.method === "POST") {
        const response = await savePublicReflection(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/ingest/listener" && request.method === "POST") {
        const response = await ingestListener(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/ingest/comment" && request.method === "POST") {
        const response = await ingestComment(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/admin/station-performance" && request.method === "POST") {
        const response = await saveStationPerformance(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/ingest/fan" && request.method === "POST") {
        const response = await linkFanIdentity(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/admin/summary" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminSummary(env), 200, cors);
      }

      if (url.pathname === "/v1/admin/owner-ux-summary" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminOwnerUxSummary(env, url), 200, cors);
      }

      if (url.pathname === "/v1/admin/analytics" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminAnalytics(env, url), 200, cors);
      }

      if (url.pathname === "/v1/admin/fan-detail" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminFanDetail(env, url), 200, cors);
      }

      if (url.pathname === "/v1/admin/fan-label" && request.method === "POST") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        const response = await adminSetFanLabel(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/admin/export" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminExport(env), 200, cors);
      }

      if (url.pathname === "/v1/admin/fans" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        const rows = await env.VAULT_DB.prepare(
          "SELECT * FROM fans ORDER BY last_seen_at DESC LIMIT 1000",
        ).all();
        return json({ ok: true, items: rows.results || [] }, 200, cors);
      }

      if (url.pathname === "/v1/admin/comments" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        const rows = await env.VAULT_DB.prepare(
          "SELECT * FROM comments ORDER BY created_at DESC LIMIT 1000",
        ).all();
        return json({ ok: true, items: rows.results || [] }, 200, cors);
      }

      if (url.pathname === "/v1/admin/listeners" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        const rows = await env.VAULT_DB.prepare(
          "SELECT * FROM listener_events ORDER BY occurred_at DESC LIMIT 2000",
        ).all();
        return json({ ok: true, items: rows.results || [] }, 200, cors);
      }

      if (url.pathname === "/v1/admin/game-scores" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        const rows = await env.VAULT_DB.prepare(
          "SELECT * FROM game_scores ORDER BY updated_at DESC LIMIT 2000",
        ).all();
        return json({ ok: true, items: rows.results || [] }, 200, cors);
      }

      if (url.pathname === "/v1/admin/events" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        const rows = await env.VAULT_DB.prepare(
          "SELECT id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_url,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json FROM fan_events ORDER BY occurred_at DESC LIMIT 5000",
        ).all();
        return json({ ok: true, items: rows.results || [] }, 200, cors);
      }

      if(url.pathname==="/v1/admin/music-assets"&&request.method==="POST"){
        const response=await saveMusicAssetReceipt(request,env);
        Object.entries(cors).forEach(([k,v])=>response.headers.set(k,v));
        return response;
      }

      if (url.pathname === "/v1/public/music-playlists" && request.method === "GET") {
        return json({ok:true,format:"ge-music-playlists-v1",items:await listPublicMusicPlaylists(env)},200,cors);
      }

      if (url.pathname === "/v1/public/dj-playlists" && request.method === "GET") {
        return json({ok:true,format:"ge-public-dj-playlists-v1",items:await listPublicDJPlaylists(env)},200,cors);
      }

      if (url.pathname === "/v1/playlists" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json({ ok: true, items: await listPlaylists(env) }, 200, cors);
      }

      if (url.pathname === "/v1/playlists" && ["POST", "PUT"].includes(request.method)) {
        const response = await savePlaylist(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      const playlistMatch = url.pathname.match(/^\/v1\/playlists\/([^/]+)$/);
      if (playlistMatch && request.method === "DELETE") {
        const response = await deletePlaylist(request, env, decodeURIComponent(playlistMatch[1]));
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/effect-presets" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json({ ok: true, items: await listEffectPresets(env, url) }, 200, cors);
      }

      if (url.pathname === "/v1/effect-presets" && ["POST", "PUT"].includes(request.method)) {
        const response = await saveEffectPreset(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      const fxPresetMatch = url.pathname.match(/^\/v1\/effect-presets\/([^/]+)$/);
      if (fxPresetMatch && request.method === "DELETE") {
        const response = await archiveEffectPreset(request, env, decodeURIComponent(fxPresetMatch[1]));
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      if (url.pathname === "/v1/vault" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json({ ok: true, items: await listVaultValues(env, url) }, 200, cors);
      }

      if (url.pathname === "/v1/vault" && ["POST", "PUT"].includes(request.method)) {
        const response = await saveVaultValue(request, env);
        Object.entries(cors).forEach(([k, v]) => response.headers.set(k, v));
        return response;
      }

      return json({ ok: false, error: "Not found." }, 404, cors);
    } catch (error) {
      return json({ ok: false, error: String(error?.message || error) }, 500, cors);
    }
  },
};
