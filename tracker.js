const { Pool } = require('pg');
const crypto = require('crypto');

// Only initialize if DATABASE_URL is provided, so it doesn't crash if not configured yet.
const pool = process.env.DATABASE_URL 
    ? new Pool({ connectionString: process.env.DATABASE_URL }) 
    : null;

if (pool) {
    pool.query(`
        CREATE TABLE IF NOT EXISTS global_pageviews (
            id SERIAL PRIMARY KEY,
            domain VARCHAR(255) NOT NULL,
            path VARCHAR(255) NOT NULL,
            ip_hash VARCHAR(64) NOT NULL,
            user_agent TEXT,
            referrer TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_domain ON global_pageviews(domain);
        CREATE INDEX IF NOT EXISTS idx_created_at ON global_pageviews(created_at);
    `).catch(err => console.error('Tracking DB Init Error:', err.message));
}

function hashIp(ip) {
    return crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
}

// Middleware to track page views
function trackPageView(req, res, next) {
    if (!pool) return next(); // Skip tracking if no DB configured
    
    // Skip static assets, admin, api routes
    if (req.path.startsWith('/admin') || req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
    }

    const domain = req.hostname || req.get('host') || 'unknown';
    const path = req.path;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';
    
    // Ignore common bots
    const botPattern = /bot|crawler|spider|crawling|slurp|yandex|google|bing/i;
    if (botPattern.test(userAgent)) return next();

    const ipHash = hashIp(ip);

    // Asynchronously insert to avoid blocking request
    pool.query(
        'INSERT INTO global_pageviews (domain, path, ip_hash, user_agent, referrer) VALUES ($1, $2, $3, $4, $5)',
        [domain, path, ipHash, userAgent, referrer]
    ).catch(err => console.error('Tracking Error:', err.message));

    next();
}

async function getStats(domain, range) {
    if (!pool) return { error: 'Veritabanı yapılandırılmadı (DATABASE_URL eksik).' };

    try {
        let dateCondition = '';
        if (range === 'today') dateCondition = 'AND created_at >= CURRENT_DATE';
        else if (range === 'week') dateCondition = "AND created_at >= NOW() - INTERVAL '7 days'";
        else if (range === 'month') dateCondition = "AND created_at >= NOW() - INTERVAL '30 days'";

        const viewsRes = await pool.query(
            `SELECT COUNT(*) as total_views, COUNT(DISTINCT ip_hash) as unique_visitors 
             FROM global_pageviews WHERE domain = $1 ${dateCondition}`,
            [domain]
        );

        const topPaths = await pool.query(
            `SELECT path, COUNT(*) as views FROM global_pageviews 
             WHERE domain = $1 ${dateCondition} GROUP BY path ORDER BY views DESC LIMIT 10`,
            [domain]
        );

        const topReferrers = await pool.query(
            `SELECT referrer, COUNT(*) as views FROM global_pageviews 
             WHERE domain = $1 AND referrer != '' ${dateCondition} GROUP BY referrer ORDER BY views DESC LIMIT 10`,
            [domain]
        );

        return {
            total_views: parseInt(viewsRes.rows[0].total_views || 0),
            unique_visitors: parseInt(viewsRes.rows[0].unique_visitors || 0),
            topPaths: topPaths.rows,
            topReferrers: topReferrers.rows
        };
    } catch (e) {
        console.error('Stats query error:', e);
        return { error: 'İstatistikler alınırken bir hata oluştu.' };
    }
}

module.exports = { trackPageView, getStats };
