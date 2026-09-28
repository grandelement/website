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
  return constantTimeEqual(token, expected);
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
    "playlist_view","background_change","button_click","external_link",
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
  const existing = await env.VAULT_DB.prepare("SELECT created_at FROM playlists WHERE id=?").bind(playlistId).first();

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
      cleanJson(body.metadata),
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
    cleanJson({ id: playlistId, name, active: !!body.active, locked: !!body.locked, notes: body.notes || null, metadata: body.metadata || {}, tracks }),
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

async function adminAnalytics(env, url) {
  const days = Math.max(1, Math.min(3650, Number(url.searchParams.get("days") || 30)));
  const since = now() - Math.round(days * 86400);
  const rows = await env.VAULT_DB.prepare(
    "SELECT id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_path,track_id,track_title,album,referrer,utm_source,utm_medium,utm_campaign,user_agent,language,country,region,city,timezone,cf_asn,cf_as_org,metadata_json FROM fan_events WHERE occurred_at>=? ORDER BY occurred_at ASC LIMIT 50000",
  ).bind(since).all();
  const items = rows.results || [];

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

  const mediaSessions = new Map();
  const stationTracks = new Map();

  for (const row of items) {
    if (row.anon_id && row.anon_id !== "ge-radio-station") visitors.add(String(row.anon_id));
    if (row.session_id && row.event_type !== "station_performance") sessions.add(String(row.session_id));
    bumpCount(eventCounts, row.event_type);
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
        };
        fanMap.set(anon, fan);
      }
      fan.first_seen_at = Math.min(Number(fan.first_seen_at || row.occurred_at), Number(row.occurred_at || 0));
      fan.last_seen_at = Math.max(Number(fan.last_seen_at || row.occurred_at), Number(row.occurred_at || 0));
      fan.events += 1;
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
      const stationKey = [row.track_id || "", row.track_title || "", row.album || ""].join("|");
      let st = stationTracks.get(stationKey);
      if (!st) {
        st = {
          track_id: row.track_id || "",
          track_title: row.track_title || "",
          album: row.album || "",
          performances: 0,
          first_played_at: row.occurred_at,
          last_played_at: row.occurred_at,
          ascap_work_id: String(meta.ascap_work_id || ""),
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
        track_title: row.track_title || "",
        album: row.album || "",
        source: String(meta.source || row.surface || ""),
        station_id: !!meta.station_id,
        ascap_work_id: String(meta.ascap_work_id || ""),
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
    s.track_title ||= row.track_title || "";
    s.album ||= row.album || "";
    s.source ||= String(meta.source || row.surface || "");
    s.station_id = s.station_id || !!meta.station_id;
    s.ascap_work_id ||= String(meta.ascap_work_id || "");
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
    t.iswc ||= s.iswc;
    t.writer ||= s.writer;
    t.publisher ||= s.publisher;
  }

  const fans = [...fanMap.values()].map((fan) => ({
    anon_id: fan.anon_id,
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
  })).sort((a, b) => b.last_seen_at - a.last_seen_at);

  const stationMusic = [...stationTracks.values()]
    .sort((a, b) => b.performances - a.performances || b.last_played_at - a.last_played_at);

  const music = [...trackMap.values()].map((t) => ({
    track_id: t.track_id,
    track_title: t.track_title,
    album: t.album,
    source: t.source,
    station_id: t.station_id,
    ascap_work_id: t.ascap_work_id,
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

  return {
    ok: true,
    days,
    since,
    generated_at: now(),
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
    },
    event_counts: topCountRows(eventCounts, 100),
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
  };
}

async function adminFanDetail(env, url) {
  const anonId = safeAnonId(url.searchParams.get("anon_id"));
  if (!anonId) return { ok: false, error: "Missing anonymous fan ID." };
  const days = Math.max(1, Math.min(3650, Number(url.searchParams.get("days") || 3650)));
  const since = now() - Math.round(days * 86400);
  const rows = await env.VAULT_DB.prepare(
    "SELECT id,occurred_at,fan_id,anon_id,session_id,surface,event_type,page_path,track_id,track_title,album,playlist_id,share_target,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,user_agent,language,country,region,city,timezone,cf_colo,cf_asn,cf_as_org,metadata_json FROM fan_events WHERE anon_id=? AND occurred_at>=? ORDER BY occurred_at DESC LIMIT 2000",
  ).bind(anonId, since).all();
  const events = (rows.results || []).map((row) => ({
    ...row,
    metadata: parseStoredJson(row.metadata_json),
    metadata_json: undefined,
  }));
  return { ok: true, anon_id: anonId, days, events };
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
        return json({ ok: true, service: "GE Studios Vault", time: now() }, 200, cors);
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

      if (url.pathname === "/v1/admin/analytics" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminAnalytics(env, url), 200, cors);
      }

      if (url.pathname === "/v1/admin/fan-detail" && request.method === "GET") {
        if (!adminAuthorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, cors);
        return json(await adminFanDetail(env, url), 200, cors);
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
