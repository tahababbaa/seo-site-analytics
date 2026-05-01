import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const totals = await pool.query(`
      SELECT
        COUNT(*)                                                      AS views,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))                 AS visitors,
        COUNT(*)            FILTER (WHERE is_bot = false)             AS human_views,
        COUNT(*)            FILTER (WHERE is_bot = true)              AS bot_views,
        COUNT(*)            FILTER (WHERE js_verified = true)         AS verified_views,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                            FILTER (WHERE is_bot = false)             AS human_visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                            FILTER (WHERE is_bot = true)              AS bot_visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                            FILTER (WHERE js_verified = true)         AS verified_visitors
      FROM global_pageviews`);

    const domains = await pool.query(`
      SELECT
        domain,
        COUNT(*) AS views,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))                 AS visitors,
        COUNT(*) FILTER (WHERE is_bot = false)                        AS human_views,
        COUNT(*) FILTER (WHERE is_bot = true)                         AS bot_views,
        COUNT(*) FILTER (WHERE js_verified = true)                    AS verified_views,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                 FILTER (WHERE is_bot = false)                        AS human_visitors,
        COUNT(DISTINCT COALESCE(session_id, ip_hash))
                 FILTER (WHERE is_bot = true)                         AS bot_visitors
      FROM global_pageviews
      GROUP BY domain
      ORDER BY views DESC`);

    const num = (v: unknown) => parseInt(String(v ?? '0'), 10) || 0;
    const t = totals.rows[0] || {};

    return NextResponse.json({
      global: {
        views:             num(t.views),
        visitors:          num(t.visitors),
        human_views:       num(t.human_views),
        bot_views:         num(t.bot_views),
        verified_views:    num(t.verified_views),
        human_visitors:    num(t.human_visitors),
        bot_visitors:      num(t.bot_visitors),
        verified_visitors: num(t.verified_visitors),
      },
      domains: domains.rows.map((r: Record<string, unknown>) => ({
        domain:          String(r.domain),
        views:           num(r.views),
        visitors:        num(r.visitors),
        human_views:     num(r.human_views),
        bot_views:       num(r.bot_views),
        verified_views:  num(r.verified_views),
        human_visitors:  num(r.human_visitors),
        bot_visitors:    num(r.bot_visitors),
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    console.error('API /stats Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
