import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Detailed breakdown: top IPs / UAs / paths / referrers / bot reasons
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '30d').toLowerCase();
    const domain = searchParams.get('domain') || '';

    let interval = "30 days";
    if (range === '24h') interval = '24 hours';
    else if (range === '7d') interval = '7 days';
    else if (range === '30d') interval = '30 days';
    else if (range === '90d') interval = '90 days';
    else if (range === 'all') interval = '';

    const params: string[] = [];
    let where = interval ? `created_at >= NOW() - INTERVAL '${interval}'` : 'TRUE';
    if (domain) {
      params.push(domain);
      where += ` AND domain = $${params.length}`;
    }

    const [topIps, topUas, topPaths, topReferrers, botReasons, hourlyHeatmap] = await Promise.all([
      pool.query(`
        SELECT COALESCE(NULLIF(ip,''), ip_hash) AS ip,
               COUNT(*) AS cnt,
               COUNT(*) FILTER (WHERE is_bot = true) AS bot_cnt,
               BOOL_OR(js_verified) AS verified
          FROM global_pageviews WHERE ${where}
         GROUP BY 1
         ORDER BY cnt DESC LIMIT 25`, params),

      pool.query(`
        SELECT user_agent, COUNT(*) AS cnt,
               BOOL_OR(is_bot) AS is_bot
          FROM global_pageviews
         WHERE ${where} AND user_agent IS NOT NULL AND user_agent <> ''
         GROUP BY user_agent
         ORDER BY cnt DESC LIMIT 25`, params),

      pool.query(`
        SELECT domain, path, COUNT(*) AS cnt
          FROM global_pageviews WHERE ${where} AND is_bot = false
         GROUP BY domain, path
         ORDER BY cnt DESC LIMIT 20`, params),

      pool.query(`
        SELECT referrer, COUNT(*) AS cnt
          FROM global_pageviews
         WHERE ${where} AND referrer IS NOT NULL AND referrer <> '' AND is_bot = false
         GROUP BY referrer
         ORDER BY cnt DESC LIMIT 20`, params),

      pool.query(`
        SELECT bot_reason, COUNT(*) AS cnt
          FROM global_pageviews
         WHERE ${where} AND is_bot = true AND bot_reason IS NOT NULL
         GROUP BY bot_reason
         ORDER BY cnt DESC`, params),

      pool.query(`
        SELECT EXTRACT(DOW FROM created_at)::int  AS dow,
               EXTRACT(HOUR FROM created_at)::int AS hour,
               COUNT(*) FILTER (WHERE is_bot = false) AS human,
               COUNT(*) FILTER (WHERE is_bot = true)  AS bot
          FROM global_pageviews WHERE ${where}
         GROUP BY dow, hour ORDER BY dow, hour`, params),
    ]);

    return NextResponse.json({
      range,
      topIps:        topIps.rows.map((r: Record<string, unknown>)        => ({ ip: String(r.ip), cnt: Number(r.cnt), bot_cnt: Number(r.bot_cnt || 0), verified: !!r.verified })),
      topUas:        topUas.rows.map((r: Record<string, unknown>)        => ({ user_agent: String(r.user_agent), cnt: Number(r.cnt), is_bot: !!r.is_bot })),
      topPaths:      topPaths.rows.map((r: Record<string, unknown>)      => ({ domain: String(r.domain), path: String(r.path), cnt: Number(r.cnt) })),
      topReferrers:  topReferrers.rows.map((r: Record<string, unknown>)  => ({ referrer: String(r.referrer), cnt: Number(r.cnt) })),
      botReasons:    botReasons.rows.map((r: Record<string, unknown>)    => ({ bot_reason: String(r.bot_reason), cnt: Number(r.cnt) })),
      hourlyHeatmap: hourlyHeatmap.rows.map((r: Record<string, unknown>) => ({ dow: Number(r.dow), hour: Number(r.hour), human: Number(r.human), bot: Number(r.bot) })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('API /breakdown Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
