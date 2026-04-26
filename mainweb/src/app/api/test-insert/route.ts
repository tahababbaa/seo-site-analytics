import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await pool.query(`TRUNCATE TABLE global_pageviews RESTART IDENTITY;`);
    
    const domains = [
      'twitterifsa.us', 
      'telegramifsa.us', 
      'turkifsa1.us', 
      'turkifsakanallari.us', 
      'ifsaturk.us'
    ];
    
    for (let i = 0; i < domains.length; i++) {
      await pool.query(`
        INSERT INTO global_pageviews (domain, path, ip_hash, user_agent, referrer) 
        VALUES ($1, $2, $3, $4, $5)
      `, [domains[i], '/', 'initial_hash_' + i, 'Admin Reset', 'https://google.com']);
    }
    
    return NextResponse.json({ success: true, message: 'Database reset to 1 for all domains.' });
  } catch (error: any) {
    console.error('API /reset Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
