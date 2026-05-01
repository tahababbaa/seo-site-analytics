import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { SOURCE_CASE } from '../stats/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range  = (searchParams.get('range') || '30d').toLowerCase();
    const domain = searchParams.get('domain') || '';

    let interval = "30 days";
    if (range === '24h') interval = '24 hours';
    else if (range === '7d')  interval = '7 days';
    else if (range === '30d') interval = '30 days';
    else if (range === '90d') interval = '90 days';
    else if (range === 'all') interval = '';

    const params: string[] = [];
    let where = interval ? `created_at >= NOW() - INTERVAL '${interval}'` : 'TRUE';
    if (domain) {
      params.push(domain);
      where += ` AND domain = $${params.length}`;
    }

    const searchWhere = `${where} AND ${SOURCE_CASE} IN ('google','bing','yandex','search_other')`;

    const [searchLandings, searchReferrers, otherReferrers, topPaths, ipBreakdown, hourly] = await Promise.all([
      // Most-visited landing pages from search engines (the SEO winners)
      pool.query(`
        SELECT domain, path, ${SOURCE_CASE} AS source, COUNT(*) AS cnt
          FROM global_pageviews WHERE ${searchWhere}
         GROUP BY domain, path, ${SOURCE_CASE}
         ORDER BY cnt DESC LIMIT 30`, params),

      // Actual search-engine referer URLs (may include keyword in some)
      pool.query(`
        SELECT referrer, ${SOURCE_CASE} AS source, COUNT(*) AS cnt
          FROM global_pageviews WHERE ${searchWhere}
         GROUP BY referrer, ${SOURCE_CASE}
         ORDER BY cnt DESC LIMIT 25`, params),

      // Non-search referrers (filtered out from primary view)
      pool.query(`
        SELECT referrer, COUNT(*) AS cnt, ${SOURCE_CASE} AS source
          FROM global_pageviews
         WHERE ${where}
           AND ${SOURCE_CASE} IN ('social','referral')
           AND referrer IS NOT NULL AND referrer <> ''
         GROUP BY referrer, ${SOURCE_CASE}
         ORDER BY cnt DESC LIMIT 25`, params),

      // Top paths overall (humans only — excludes bots)
      pool.query(`
        SELECT domain, path, COUNT(*) AS cnt,
               COUNT(*) FILTER (WHERE ${SOURCE_CASE} IN ('google','bing','yandex','search_other')) AS search_cnt
          FROM global_pageviews WHERE ${where} AND is_bot = false
         GROUP BY domain, path
         ORDER BY cnt DESC LIMIT 25`, params),

      // IP breakdown — separate human IPs from bot IPs
      pool.query(`
        SELECT COALESCE(NULLIF(ip,''), ip_hash) AS ip,
               COUNT(*) AS cnt,
               COUNT(*) FILTER (WHERE ${SOURCE_CASE} IN ('google','bing','yandex','search_other')) AS search_cnt,
               COUNT(*) FILTER (WHERE is_bot = true) AS bot_cnt,
               BOOL_OR(js_verified) AS verified
          FROM global_pageviews WHERE ${where}
         GROUP BY 1
         ORDER BY cnt DESC LIMIT 30`, params),

      // Hourly heatmap (search clicks only — primary metric)
      pool.query(`
        SELECT EXTRACT(DOW FROM created_at)::int  AS dow,
               EXTRACT(HOUR FROM created_at)::int AS hour,
               COUNT(*) FILTER (WHERE ${SOURCE_CASE} IN ('google','bing','yandex','search_other')) AS search_cnt,
               COUNT(*) FILTER (WHERE ${SOURCE_CASE} = 'direct') AS direct_cnt
          FROM global_pageviews WHERE ${where}
         GROUP BY dow, hour ORDER BY dow, hour`, params),
    ]);

    return NextResponse.json({
      range,
      searchLandings: searchLandings.rows.map((r: Record<string, unknown>) => ({
        domain: String(r.domain), path: String(r.path), source: String(r.source), cnt: Number(r.cnt),
      })),
      searchReferrers: searchReferrers.rows.map((r: Record<string, unknown>) => ({
        referrer: String(r.referrer), source: String(r.source), cnt: Number(r.cnt),
      })),
      otherReferrers: otherReferrers.rows.map((r: Record<string, unknown>) => ({
        referrer: String(r.referrer), source: String(r.source), cnt: Number(r.cnt),
      })),
      topPaths: topPaths.rows.map((r: Record<string, unknown>) => ({
        domain: String(r.domain), path: String(r.path), cnt: Number(r.cnt), search_cnt: Number(r.search_cnt),
      })),
      ipBreakdown: ipBreakdown.rows.map((r: Record<string, unknown>) => ({
        ip: String(r.ip), cnt: Number(r.cnt),
        search_cnt: Number(r.search_cnt), bot_cnt: Number(r.bot_cnt),
        verified: !!r.verified,
      })),
      hourlyHeatmap: hourly.rows.map((r: Record<string, unknown>) => ({
        dow: Number(r.dow), hour: Number(r.hour),
        search: Number(r.search_cnt), direct: Number(r.direct_cnt),
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('API /breakdown Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
