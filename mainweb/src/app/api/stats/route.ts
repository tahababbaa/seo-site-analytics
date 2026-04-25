import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const globalViews = await pool.query(
      `SELECT COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors FROM global_pageviews`
    );

    const domainStats = await pool.query(
      `SELECT domain, COUNT(*) as views, COUNT(DISTINCT ip_hash) as visitors 
       FROM global_pageviews 
       GROUP BY domain 
       ORDER BY views DESC`
    );

    return NextResponse.json({
      global: {
        views: parseInt(globalViews.rows[0]?.views || '0', 10),
        visitors: parseInt(globalViews.rows[0]?.visitors || '0', 10),
      },
      domains: domainStats.rows.map(r => ({
        domain: r.domain,
        views: parseInt(r.views, 10),
        visitors: parseInt(r.visitors, 10),
      })),
    });
  } catch (error) {
    console.error('API /stats Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
