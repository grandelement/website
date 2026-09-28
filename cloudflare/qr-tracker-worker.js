export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Log only the actual QR landing-page request, not images/assets.
    if ((url.pathname === "/qr" || url.pathname === "/qr/") && env.QR_DB) {
      const cf = request.cf || {};
      const headers = request.headers;

      const record = {
        scannedAt: new Date().toISOString(),
        campaign: url.searchParams.get("c") || "main-sticker",
        ip: headers.get("CF-Connecting-IP") || "",
        country: cf.country || "",
        region: cf.region || "",
        regionCode: cf.regionCode || "",
        city: cf.city || "",
        postalCode: cf.postalCode || "",
        continent: cf.continent || "",
        timezone: cf.timezone || "",
        latitude: cf.latitude || "",
        longitude: cf.longitude || "",
        metroCode: cf.metroCode || "",
        colo: cf.colo || "",
        asn: cf.asn ? String(cf.asn) : "",
        asOrganization: cf.asOrganization || "",
        userAgent: headers.get("User-Agent") || "",
        acceptLanguage: headers.get("Accept-Language") || "",
        referer: headers.get("Referer") || "",
        cfRay: headers.get("CF-Ray") || ""
      };

      ctx.waitUntil(
        env.QR_DB.prepare(
          `INSERT INTO qr_scans (
            scanned_at, campaign, ip, country, region, region_code, city,
            postal_code, continent, timezone, latitude, longitude, metro_code,
            colo, asn, as_organization, user_agent, accept_language, referer, cf_ray
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          record.scannedAt,
          record.campaign,
          record.ip,
          record.country,
          record.region,
          record.regionCode,
          record.city,
          record.postalCode,
          record.continent,
          record.timezone,
          record.latitude,
          record.longitude,
          record.metroCode,
          record.colo,
          record.asn,
          record.asOrganization,
          record.userAgent,
          record.acceptLanguage,
          record.referer,
          record.cfRay
        ).run()
      );
    }

    // Continue to the existing GitHub-hosted page unchanged.
    return fetch(request);
  }
};
