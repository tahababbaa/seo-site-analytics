const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');

function init() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS breadcrumbs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            href TEXT NOT NULL DEFAULT '#',
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            heading TEXT NOT NULL,
            body TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS table1_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            col_type TEXT NOT NULL,
            col_features TEXT NOT NULL,
            col_access TEXT NOT NULL DEFAULT '7/24 Aktif',
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS table2_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            col_type TEXT NOT NULL,
            col_features TEXT NOT NULL,
            col_duration TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS tips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            strong_text TEXT NOT NULL,
            body TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS schema_breadcrumbs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position INTEGER NOT NULL,
            item_id TEXT NOT NULL,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS faq_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        );
        -- Migration: add faq_section_enabled if column missing
        PRAGMA foreign_keys = OFF;
    `);

    // Migrate: add new meta keys without full re-seed
    migrateNewMeta();

    const count = db.prepare('SELECT COUNT(*) as c FROM meta').get().c;
    if (count === 0) seed();

    // Ensure FAQ is seeded
    const faqCount = db.prepare('SELECT COUNT(*) as c FROM faq_items').get().c;
    if (faqCount === 0) seedFaq();

    // Default admin user: admin / admin123 if not exists
    const adminCount = db.prepare('SELECT COUNT(*) as c FROM admin_users').get().c;
    if (adminCount === 0) {
        const hash = bcrypt.hashSync('admin123', 12);
        db.prepare('INSERT OR IGNORE INTO admin_users(username,password_hash) VALUES(?,?)').run('admin', hash);
    }
}

function migrateNewMeta() {
    const existing = new Set(
        db.prepare('SELECT key FROM meta').all().map(r => r.key)
    );
    const newKeys = {
        og_image:              'https://www.indiedevday.es/wp-content/uploads/2020/10/cropped-logo_favicon-1-192x192.png',
        og_image_width:        '1200',
        og_image_height:       '630',
        og_site_name:          'Türk İfşa',
        og_locale:             'tr_TR',
        og_locale_alternate:   'en_US',
        twitter_card:          'summary_large_image',
        twitter_site:          '',
        twitter_creator:       '',
        twitter_image:         'https://www.indiedevday.es/wp-content/uploads/2020/10/cropped-logo_favicon-1-192x192.png',
        date_published:        new Date().toISOString().split('T')[0],
        date_modified:         new Date().toISOString().split('T')[0],
        website_name:          'Türk İfşa',
        website_url:           'https://www.indiedevday.es/',
        search_action_target:  'https://www.indiedevday.es/?s={search_term_string}',
        service_name:          'Türk İfşa Hizmetleri',
        service_type:          'Service',
        service_description:   'Türk ifşa, türk ifşa izle, türk liseli ifşa, türk ünlü ifşa ve fenomen ifşa hizmetleri.',
        service_area:          'Türkiye',
        article_section:       'Türk İfşa',
        faq_section_title:     'Sıkça Sorulan Sorular',
        faq_section_enabled:   '1',
        robots_txt_content:    'User-agent: *\nAllow: /\nSitemap: https://www.indiedevday.es/sitemap.xml',
        sitemap_changefreq:    'daily',
        sitemap_priority:      '0.8',
        preconnect_urls:       'https://fonts.googleapis.com,https://fonts.gstatic.com,https://www.google-analytics.com',
        referrer_policy:       'strict-origin-when-cross-origin',
        content_language:      'tr',
    };
    const upsert = db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)');
    const tx = db.transaction(() => {
        for (const [k, v] of Object.entries(newKeys)) {
            if (!existing.has(k)) upsert.run(k, v);
        }
    });
    tx();

    // Seed default FAQ items if table empty
    const faqCount = db.prepare('SELECT COUNT(*) as c FROM faq_items').get().c;
    if (faqCount === 0) seedFaq();
}

function seedFaq() {
    const ins = db.prepare('INSERT INTO faq_items(question,answer,sort_order) VALUES(?,?,?)');
    const faqs = [
        ['Türk ifşa nedir?', '<strong>Türk ifşa</strong>, Türkiye\'de çevrimiçi yetişkin içerik platformlarında paylaşılan video ve fotoğraf içeriklerini tanımlayan bir terimdir. <strong>Türk ifşa izle</strong> seçenekleri çeşitli dijital platformlarda sunulmaktadır.'],
        ['Türk ifşa siteleri güvenli midir?', 'Güvenilir <strong>türk ifşa</strong> platformları SSL şifreleme, anonim ödeme seçenekleri ve iki adımlı doğrulama ile kullanıcı güvenliğini ön planda tutar. <strong>Türk ifşa izle</strong> hizmetleri gizlilik odaklı altyapıyla çalışır.'],
        ['Telegram ifşa kanallarına nasıl ulaşılır?', '<strong>Telegram ifşa</strong> kanallarına Telegram uygulaması üzerinden ulaşılabilir. <strong>Türk ifşa telegram</strong> grupları özel üyelik ve VIP paket seçenekleri sunar. <strong>İfşa telegram</strong> hizmetleri 7/24 aktiftir.'],
        ['Türk ifşa Twitter hesapları nasıl bulunur?', '<strong>Türk ifşa twitter</strong> hesapları X (Twitter) platformunda özel arama yoluyla erişilebilir. <strong>Türk ifsa twitter</strong> hesapları kilitli profil ve premium içerik seçenekleri barındırır.'],
        ['Türk ünlü ifşa içerikleri nerede paylaşılır?', '<strong>Türk ünlü ifşa</strong> ve <strong>fenomen ifşa</strong> içerikleri özel yetişkin platformlarında, <strong>telegram ifşa</strong> kanallarında ve <strong>türk ifşa twitter</strong> hesaplarında yer alır. <strong>Liseli ifşa</strong> ve <strong>amatör porn</strong> kategorileri de aynı platformlarda sunulur.'],
        ['Türk porno izle siteleri hangi kalitede yayın sunar?', '<strong>Türk porno izle</strong> platformları 4K ve yüksek çözünürlüklü içerik sunar. <strong>Türk porno</strong> siteleri çoklu cihaz desteği, düşük gecikme ve kesintisiz oynatma ile öne çıkar.'],
        ['Türk ifşa 2026 yenilikleri nelerdir?', '<strong>Türk ifşa 2026</strong> platformları 8K çözünürlük, yapay zekâ destekli içerik önerileri ve blockchain tabanlı ödeme sistemi sunmaktadır. <strong>Telegram ifşa 2026</strong> kanalları gelişmiş bot entegrasyonları ve canlı yayın özellikleriyle güncellendi.'],
    ];
    const tx = db.transaction(() => faqs.forEach(([q,a],i) => ins.run(q,a,i)));
    tx();
}

function seed() {
    const metaData = {
        site_title: 'Türk İfşa - Liseli İfşa, Ünlü İfşa, Telegram İfşa ve Twitter İfşa',
        meta_description: 'Türk ifşa, türk ifşa izle, türk liseli ifşa, türk ünlü ifşa, fenomen ifşa, ünlü ifşa, liseli ifşa, amatör porn. 7/24 kesintisiz erişim: türk ifşa twitter, türk ifşa telegram, telegram ifşa kanalları. Türk ifşa videoları, türk porno, türk porno izle. Anonim ve güvenli türk ifsa, telegram ifsa, ifşa telegram hizmetleri.',
        meta_keywords: 'türk ifşa, türk ifsa, türk ifşa izle, türk liseli ifşa, türk ünlü ifşa, fenomen ifşa, ünlü ifşa, liseli ifşa, amatör porn, türk ifşa twitter, türk ifşa telegram, telegram ifşa, telegram ifsa, ifşa telegram, ifsa telegram, türk porno, türk porno izle',
        meta_author: 'Türk İfşa',
        meta_robots: 'index, follow',
        meta_language: 'Turkish',
        meta_revisit: '7 days',
        og_title: 'Türk İfşa - Liseli İfşa, Ünlü İfşa, Telegram İfşa ve Twitter İfşa',
        og_description: 'Türk ifşa, türk liseli ifşa, türk ünlü ifşa, fenomen ifşa, ünlü ifşa, liseli ifşa, amatör porn. Telegram ifşa, türk ifşa telegram, türk porno izle. 7/24 kesintisiz erişim ve güvenli kullanım.',
        og_type: 'website',
        og_url: 'https://www.indiedevday.es/',
        canonical_url: 'https://www.indiedevday.es/',
        hreflang_tr: 'https://turkifsaciniz10.vip/',
        hreflang_default: 'https://turkifsaciniz10.vip/',
        favicon_32: 'https://www.indiedevday.es/wp-content/uploads/2020/10/cropped-logo_favicon-1-32x32.png',
        favicon_192: 'https://www.indiedevday.es/wp-content/uploads/2020/10/cropped-logo_favicon-1-192x192.png',
        apple_touch_icon: 'https://www.indiedevday.es/wp-content/uploads/2020/10/cropped-logo_favicon-1-180x180.png',
        theme_color: '#ffffff',
        profile_url: 'https://gmpg.org/xfn/11',
        redirect_url: 'https://kisa.pro/GjhTU',
        schema_org_name: 'Türk İfşa',
        schema_org_altname: 'Türk İfşa, Türk Liseli İfşa, Türk Ünlü İfşa, Fenomen İfşa, Ünlü İfşa, Liseli İfşa, Amatör Porn, Türk İfşa Telegram',
        schema_org_url: 'https://www.indiedevday.es/',
        schema_org_logo: 'https://www.indiedevday.es/logo.png',
        google_site_verify: 'JCdoRPaFyqIZ-iEhlWdjKZC6yusis3QMesTHximREoc',
        cf_beacon_src: 'https://static.cloudflareinsights.com/beacon.min.js/v8c78df7c7c0f484497ecbca7046644da1771523124516',
        cf_beacon_integrity: 'sha512-8DS7rgIrAmghBFwoOTujcf6D9rXvH8xm8JQ1Ja01h9QX8EzXldiszufYa4IFfKdLUKTTrnSFXLDkUEOTrZQ8Qg==',
        cf_beacon_token: '00cb8e637a88471985dfa8abc826e4c1',
        table1_h2: 'Popüler Türk İfşa ve Türk İfşa İzle Hizmetleri',
        table1_intro: 'En çok tercih edilen <strong>türk ifşa</strong>, <strong>türk ifşa izle</strong>, <strong>türk liseli ifşa</strong>, <strong>türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>liseli ifşa</strong> ve <strong>amatör porn</strong> servislerinin özellikleri aşağıdaki tabloda özetlenmiştir:',
        table1_th1: 'İfşa Türü',
        table1_th2: 'Özellikler',
        table1_th3: 'Erişim',
        table2_h2: 'Türk İfşa ve Türk İfşa İzle Paketleri',
        table2_intro: 'En popüler <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> paketlerinin öne çıkan özellikleri aşağıdaki tabloda listelenmiştir:',
        table2_th1: 'İfşa Adı',
        table2_th2: 'Özellikler',
        table2_th3: 'Erişim Süresi',
        tips_h2: 'Türk İfşa ve Türk İfşa İzle Tavsiyeleri',
        center_text: 'türk ifşa, türk ifsa, türk ifşa izle, türk liseli ifşa, türk ünlü ifşa, fenomen ifşa, ünlü ifşa, liseli ifşa, amatör porn, türk ifşa videoları, türk ifşa telegram, telegram ifşa, türk ifşa twitter, türk porno, türk porno izle, türk ifşa 2026, telegram ifşa 2026, twitter ifşa 2026',
        footer_para: '<strong>Türk ifşa</strong>, <strong>türk ifsa</strong>, <strong>türk ifşa izle</strong>, <strong>türk liseli ifşa</strong>, <strong>türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>liseli ifşa</strong>, <strong>amatör porn</strong>, <strong>türk ifşa telegram</strong>, <strong>telegram ifşa</strong>, <strong>türk ifşa twitter</strong>, <strong>türk porno</strong>, <strong>türk porno izle</strong>, <strong>türk ifşa 2026</strong>, <strong>telegram ifşa 2026</strong> ve <strong>twitter ifşa 2026</strong> hizmetleri sürekli destek, sıkı gizlilik ve güvenilir ödeme ile kullanıcı odaklıdır. <strong>Türk liseli ifşa</strong>, <strong>türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>liseli ifşa</strong> ve <strong>amatör porn</strong> platformlarında her bütçeye uygun paket seçenekleri yer alır.',
    };

    const upsertMeta = db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const [k, v] of Object.entries(metaData)) upsertMeta.run(k, v);

    const bcInsert = db.prepare('INSERT INTO breadcrumbs(text,href,sort_order) VALUES(?,?,?)');
    [
        ['Türk İfşa','https://www.indiedevday.es/'],['Türk İfsa','https://www.indiedevday.es/'],
        ['Türk İfşa İzle','https://www.indiedevday.es/'],['Türk Liseli İfşa','https://www.indiedevday.es/'],
        ['Türk Ünlü İfşa','https://www.indiedevday.es/'],['Fenomen İfşa','https://www.indiedevday.es/'],
        ['Ünlü İfşa','https://www.indiedevday.es/'],['Liseli İfşa','https://www.indiedevday.es/'],
        ['Amatör Porn','https://www.indiedevday.es/'],['Türk İfsa Twitter','https://www.indiedevday.es/'],
        ['Telegram İfsa','https://www.indiedevday.es/'],['Türk İfsa Telegram','https://www.indiedevday.es/'],
        ['İfsa Telegram','https://www.indiedevday.es/'],['Türk İfşa Videoları','https://www.indiedevday.es/'],
        ['Türk İfşa İçerikleri','https://www.indiedevday.es/'],['Türk İfşa Platformları','https://www.indiedevday.es/'],
        ['Türk İfşa Siteleri','https://www.indiedevday.es/'],['Türk İfşa Telegram','https://www.indiedevday.es/'],
        ['Telegram İfşa','https://www.indiedevday.es/'],['İfşa Telegram','https://www.indiedevday.es/'],
        ['Türk İfşa Twitter','https://www.indiedevday.es/'],['Türk Porno','https://www.indiedevday.es/'],
        ['Türk Porno İzle','https://www.indiedevday.es/'],
    ].forEach(([t,h],i) => bcInsert.run(t,h,i));

    const secInsert = db.prepare('INSERT INTO sections(heading,body,sort_order) VALUES(?,?,?)');
    [
        ['Türk İfşa','<p>Çevrimiçi yetişkin içerik sunan <strong>türk ifşa</strong> siteleri ziyaretçilere geniş seçenek yelpazesi sunar. <strong>Türk ifşa</strong> arayanlar için aynı ekosistemde <strong>türk ifşa izle</strong> özellikleri tek çatı altında toplanır. Güncel dijital eğlence beklentilerine uyumlu <strong>türk ifşa</strong> hizmetleri, evden erişim ve sıkı gizlilik taahhüdüyle öne çıkar. <strong>Türk ifşa</strong> platformları ödeme ve veri güvenliğinde şifreli altyapı ve güvenilir ödeme kanalları kullanır. Farklı format ve içerik türleri <strong>türk ifşa</strong> kullanıcılarına çeşitlilik kazandırır. Kimliğini minimum düzeyde paylaşmak isteyenler <strong>türk ifşa</strong> sitelerinde anonim deneyim sürdürebilir. <strong>Türk ifşa</strong> erişimi günün her saati kesintisiz açıktır.</p>'],
        ['Türk İfşa İzle','<p>Güncel teknolojiyi kullanan <strong>türk ifşa izle</strong> siteleri kullanıcılara birden fazla alternatif sunar. <strong>Türk ifşa izle</strong> alanlarında yüksek kaliteli yayınlar sunulur; arşiv içeriklerinin ötesinde canlı etkileşim ve anlık iletişim deneyimi oluşturulur. Tercihlere göre içerik seçimine izin veren <strong>türk ifşa izle</strong> platformlarında kullanıcı kontrolü ön plandadır. Kimlik ve gizlilik odaklı çalışan <strong>türk ifşa izle</strong> hizmetleri güvenliği önceliklendirir. Hizmet kalitesini korumak için <strong>türk ifşa izle</strong> ekipleri sürekli eğitim ve iyileştirme süreçlerine dahildir. Çoklu ödeme seçenekleri ve gün boyu erişim <strong>türk ifşa izle</strong> kullanımını kolaylaştırır.</p>'],
        ['Türk İfşa Videoları','<p>Video odaklı sunumla yetişkin içerik sunan <strong>türk ifşa videoları</strong> hizmetleri geniş bir erişim ağı oluşturur. <strong>Türk ifşa videoları</strong> yüksek çözünürlük, çoklu içerik seçeneği ve özel senaryolarla kullanıcıya hitap eder. Akışı yönlendirme ve anlık geri bildirim sunan <strong>türk ifşa videoları</strong> platformları etkileşimi güçlendirir. Anonim ödeme ve SSL ile korunan <strong>türk ifşa videoları</strong> içerikleri güvenliği ön planda tutar. <strong>Türk ifşa videoları</strong> siteleri <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> deneyimini görsel katmanla destekler. <strong>Türk ifşa videoları</strong> platformları gece gündüz kesintisiz kullanıma uygundur.</p>'],
        ['Türk İfşa Telegram','<p>Telegram üzerinden sunulan <strong>türk ifşa telegram</strong> kanalları kullanıcılara zengin bir hizmet yelpazesi sunar. Mobil uyumlu ve hızlı erişim sunan <strong>türk ifşa telegram</strong> hizmetleri net görüntü, özel kanallar ve bire bir mesajlaşma ile öne çıkar. Mahremiyet odaklı tasarlanan <strong>türk ifşa telegram</strong> platformları şifreli iletişim, düşük profilli kayıt ve güvenli ödeme seçenekleri barındırır. Telegram altyapısından yararlanan <strong>türk ifşa telegram</strong> siteleri sürekli akış ve anlık bildirimle deneyimi iyileştirir. Masaüstü, telefon ve tabletten erişilebilen <strong>türk ifşa telegram</strong> hizmetleri çoklu cihaz desteği verir. <strong>Türk ifşa telegram</strong> kanalları 7/24 içerik paylaşımına uygundur.</p>'],
        ['Telegram İfşa','<p>Mesajlaşma uygulaması Telegram ile sunulan <strong>telegram ifşa</strong> hizmetleri geniş bir kullanıcı ağına hitap eder. Hızlı ve güvenli paylaşım sunan <strong>telegram ifşa</strong> kanalları özel üyelik, VIP paketler ve kişiye özel içerik seçenekleri içerir. Gizliliği önceleyen <strong>telegram ifşa</strong> siteleri gizli sohbet, kendiliğinden silinen mesajlar ve anonim profil imkânı sunar. Telegram güvenlik özelliklerini kullanan <strong>telegram ifşa</strong> platformları iki adımlı doğrulama ve şifreli oturumlarla veriyi korur. Zengin medya desteğiyle <strong>telegram ifşa</strong> kanalları fotoğraf, video ve canlı yayın paylaşır. <strong>Telegram ifşa</strong> hizmetleri günün her saati kesintisiz erişime uygundur.</p>'],
        ['İfşa Telegram','<p>Telegram ekosisteminde yer alan <strong>ifşa telegram</strong> kanalları yetişkin içerik deneyimini dijital ortamda sunar. Sade arayüz ve kolay kullanım sunan <strong>ifşa telegram</strong> hizmetleri özel gruplar, premium erişim ve etkileşimli sohbetle desteklenir. Hızlı yanıt, teknik destek ve geri bildirime açık yapı <strong>ifşa telegram</strong> sitelerinde öne çıkar. İçerik yönetim esnekliği sayesinde <strong>ifşa telegram</strong> platformları düzenli güncelleme, özel etkinlik ve kampanya sunabilir. Türkçe ve diğer dillerde paylaşım yapan <strong>ifşa telegram</strong> kanalları çok dillidir. <strong>İfşa telegram</strong> hizmetleri 7/24 içerik tüketimine uygundur.</p>'],
        ['Türk İfşa Twitter','<p>X (Twitter) üzerinden sunulan <strong>türk ifşa twitter</strong> hesapları yetişkin içeriği sosyal akışta sunar. Anlık güncelleme ve hızlı paylaşım <strong>türk ifşa twitter</strong> hizmetlerinin temelidir; özel gönderiler, premium erişim ve etkileşimli iletişim sunulur. Mahremiyeti önceleyen <strong>türk ifşa twitter</strong> siteleri kilitli hesap, DM ve düşük profilli kullanıcı seçenekleri sunar. Gelişmiş medya özellikleriyle <strong>türk ifşa twitter</strong> platformları fotoğraf, video ve canlı içerik paylaşır. Push bildirim ve hızlı yenileme <strong>türk ifşa twitter</strong> deneyimini güçlendirir. <strong>Türk ifşa twitter</strong> hizmetleri kesintisiz içerik akışına uygundur.</p>'],
        ['Türk Porno','<p>Yerel odaklı yetişkin içerik sunan <strong>türk porno</strong> hizmetleri dijital platformlarda geniş kitleye ulaşır. Yüksek çözünürlük, 4K, çeşitli senaryolar ve kişiselleştirme <strong>türk porno</strong> sitelerinde sık görülür. Hızlı yükleme, kesintisiz oynatma ve kullanıcı dostu arayüz <strong>türk porno</strong> deneyimini iyileştirir. Güvenli ödeme ve gizlilik odaklı <strong>türk porno</strong> platformları veri koruma taahhüdüyle çalışır. Zengin arşiv ve çoklu kategori <strong>türk porno</strong> hizmetlerinde farklı zevklere yer açar. <strong>Türk porno</strong> platformları 7/24 erişilebilir içerik sunar.</p>'],
        ['Türk Porno İzle','<p>Görüntü odaklı tüketim için <strong>türk porno izle</strong> siteleri kapsamlı izleme deneyimi sunar. 4K ve yüksek çözünürlük, çoklu cihaz ve kişiselleştirilebilir oynatma <strong>türk porno izle</strong> hizmetlerinde yaygındır. Düşük gecikme, akıcı oynatma ve net kontroller <strong>türk porno izle</strong> kullanıcı rahatlığını artırır. Şifreli bağlantı ve gizlilik politikaları <strong>türk porno izle</strong> platformlarında standarttır. Düzenli güncellenen arşiv <strong>türk porno izle</strong> hizmetlerinde yeni içerik akışını sürdürür. <strong>Türk porno izle</strong> platformları gece gündüz kesintisiz izlemeye uygundur.</p>'],
        ['Türk Liseli İfşa','<p>Yerel sitelerde ayrı kategori olarak öne çıkan <strong>türk liseli ifşa</strong> içerikleri geniş arşiv sunar. <strong>Türk liseli ifşa</strong> platformları Türkçe panel, TL ile ödeme ve düzenli sınıflandırma ile çalışır. <strong>Liseli ifşa</strong> ile <strong>türk liseli ifşa</strong> çoğu sitede yan yana listelenir. <strong>Ünlü ifşa</strong> ve <strong>fenomen ifşa</strong> bölümleri <strong>türk liseli ifşa</strong> sunan sitelerde de bulunur. <strong>Amatör porn</strong> içerikleri <strong>türk liseli ifşa</strong> arşivlerinde sık yer alır. Anonim erişim ve gizlilik <strong>türk liseli ifşa</strong> hizmetlerinde önceliklidir. Mobil uyumlu <strong>türk liseli ifşa</strong> kanalları 7/24 her cihazdan ulaşılabilir.</p>'],
        ['Türk Ünlü İfşa','<p><strong>Türk ünlü ifşa</strong> yerel aramalarda sık geçen içerik türlerinden biridir. <strong>Türk ünlü ifşa</strong> siteleri net görüntü, düzenli arşiv ve güvenli ödeme sunar. <strong>Ünlü ifşa</strong> ifadesi <strong>türk ünlü ifşa</strong> ile birlikte kullanılır. <strong>Fenomen ifşa</strong> içerikleri <strong>türk ünlü ifşa</strong> platformlarında benzer çizgide sunulur. <strong>Liseli ifşa</strong>, <strong>amatör porn</strong> ve <strong>türk liseli ifşa</strong> aynı ekosistemde yer alabilir. Şifreli oturum ve gizlilik <strong>türk ünlü ifşa</strong> hizmetlerinde standarttır. <strong>Türk ifşa</strong> ile <strong>türk ünlü ifşa</strong> birleşik sunan sitelerde 7/24 erişim mümkündür.</p>'],
        ['Fenomen İfşa','<p>Sosyal medya isimlerine odaklı <strong>fenomen ifşa</strong> kategorisi yerel sitelerde yaygındır. <strong>Fenomen ifşa</strong> arşivleri <strong>türk ünlü ifşa</strong> ve <strong>ünlü ifşa</strong> ile bitişik sınıflarda yer alır. <strong>Türk liseli ifşa</strong> ve <strong>liseli ifşa</strong> <strong>fenomen ifşa</strong> sitelerinde ayrı sekmelerde sunulabilir. <strong>Amatör porn</strong> ile <strong>fenomen ifşa</strong> aynı platformda etiketlenir. Türkçe panel ve TL ödeme <strong>fenomen ifşa</strong> hizmetlerinde rutindir. Gizlilik odaklı <strong>fenomen ifşa</strong> platformları kullanıcı verisini korur. <strong>Türk ifşa</strong> ve <strong>türk ifşa izle</strong> deneyimi <strong>fenomen ifşa</strong> içerikleriyle çeşitlenir.</p>'],
        ['Ünlü İfşa','<p>Kamuoyunda tanınan isimlere yönelik <strong>ünlü ifşa</strong> içeriği yerel ve global aramalarda görülür. <strong>Ünlü ifşa</strong> siteleri <strong>türk ünlü ifşa</strong> ve <strong>fenomen ifşa</strong> ile paketlenmiş hizmet verir. <strong>Liseli ifşa</strong>, <strong>türk liseli ifşa</strong> ve <strong>amatör porn</strong> <strong>ünlü ifşa</strong> arşivlerinde etiketlenmiş bulunur. Net görüntü ve sık güncelleme <strong>ünlü ifşa</strong> deneyimini güçlendirir. <strong>Türk ifşa</strong> odaklı siteler <strong>ünlü ifşa</strong> bölümünü yereller. Anonim kullanım ve güvenli ödeme <strong>ünlü ifşa</strong> platformlarında önceliklidir. Responsive <strong>ünlü ifşa</strong> sayfaları 7/24 açıktır.</p>'],
        ['Liseli İfşa','<p><strong>Liseli ifşa</strong> yerel aramalarda üst sıralarda yer alan terimlerdendir. <strong>Liseli ifşa</strong> siteleri <strong>türk liseli ifşa</strong> ile ortak içerik havuzu kullanır. <strong>Türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong> ve <strong>ünlü ifşa</strong> <strong>liseli ifşa</strong> platformlarında ayrı klasörlerde sunulur. <strong>Amatör porn</strong> <strong>liseli ifşa</strong> arşivlerinde sık listelenir. Türkçe arayüz, TL ödeme ve sınıflandırılmış arşiv <strong>liseli ifşa</strong> için rutindir. <strong>Türk ifşa</strong> ve <strong>türk ifşa izle</strong> akışı <strong>liseli ifşa</strong> etiketleriyle genişler. Gizlilik ve 7/24 erişim <strong>liseli ifşa</strong> hizmetlerinde mevcuttur.</p>'],
        ['Amatör Porn','<p>Profesyonel stüdyo dışı çekimlere dayanan <strong>amatör porn</strong> hem yerel hem global sitelerde bulunur. <strong>Amatör porn</strong> bölümleri <strong>türk liseli ifşa</strong>, <strong>liseli ifşa</strong>, <strong>türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong> ve <strong>ünlü ifşa</strong> ile aynı çatı altındadır. <strong>Türk ifşa</strong> siteleri <strong>amatör porn</strong> içeriğini etiketli arşivde tutar. HD kalite ve çoklu senaryo <strong>amatör porn</strong> deneyimini zenginleştirir. Gizlilik ve şifreli ödeme <strong>amatör porn</strong> sitelerinde önceliklidir. <strong>Türk porno</strong> ve <strong>türk porno izle</strong> ile örtüşen <strong>amatör porn</strong> içerikleri geniş kitleye hitap eder. <strong>Amatör porn</strong> platformları 7/24 erişime uygundur.</p>'],
        ['Türk İfsa','<p>Karaktersiz yazımla aranan <strong>türk ifsa</strong> hizmetleri çevrimiçi yetişkin içerik sunar. <strong>Türk ifsa</strong> taleplerini karşılamak için siteler <strong>türk ifsa</strong> seçeneklerini aynı platformda sunar. Düşük profilli kayıt ve anonim ödeme <strong>türk ifsa</strong> hizmetlerinde standarttır. <strong>Türk ifsa</strong> aramaları <strong>türk ifşa</strong> ile eş anlamlı olarak platformlarda yer alır. Gizlilik odaklı <strong>türk ifsa</strong> siteleri şifreli bağlantı ve güvenli erişim sunar. <strong>Türk ifsa</strong> içerikleri 7/24 aktif platformlarda sunulur.</p>'],
        ['Türk İfsa Twitter','<p>X (Twitter) üzerinden <strong>türk ifsa twitter</strong> hesapları yetişkin içeriği paylaşır. Hızlı paylaşım ve anlık güncelleme <strong>türk ifsa twitter</strong> hizmetinin omurgasıdır; özel gönderiler ve premium erişim sunulur. Mahremiyeti önceleyen <strong>türk ifsa twitter</strong> siteleri kilitli hesap ve DM seçeneği barındırır. Gelişmiş medya özellikleriyle <strong>türk ifsa twitter</strong> platformları fotoğraf ve video paylaşır. <strong>Türk ifsa twitter</strong> hizmetleri kesintisiz içerik akışına uygundur.</p>'],
        ['Telegram İfsa','<p>Telegram ile sunulan <strong>telegram ifsa</strong> hizmetleri geniş kullanıcı tabanına ulaşır. Hızlı ve güvenli paylaşım <strong>telegram ifsa</strong> kanallarında özel üyelik, VIP ve kişisel içerik seçenekleri içerir. Gizliliği önceleyen <strong>telegram ifsa</strong> siteleri anonim profil ve gizli sohbet sunar. <strong>Telegram ifsa</strong> platformları şifreli oturumlarla veriyi korur. <strong>Telegram ifsa</strong> hizmetleri günün her saati kesintisiz erişime uygundur.</p>'],
        ['Türk İfsa Telegram','<p><strong>Türk ifsa telegram</strong> kanalları Telegram üzerinden yetişkin içerik dağıtır. Mobil uyum ve anında erişim <strong>türk ifsa telegram</strong> hizmetlerinde öne çıkar; net içerik, özel kanallar ve mesajlaşma imkânı sunar. Mahremiyet odaklı <strong>türk ifsa telegram</strong> platformları şifreli iletişim ve güvenli ödeme barındırır. <strong>Türk ifsa telegram</strong> kanalları 7/24 içerik paylaşımına uygundur.</p>'],
        ['İfsa Telegram','<p><strong>İfsa telegram</strong> kanalları Telegram\'da yetişkin içerik deneyimi sunar. Sade arayüz ve kullanıcı odaklı akış <strong>ifsa telegram</strong> hizmetlerinde özel grup, premium giriş ve sohbet imkânı barındırır. İçerik yönetim esnekliği <strong>ifsa telegram</strong> platformlarında düzenli güncelleme ve özel kampanya sunar. <strong>İfsa telegram</strong> hizmetleri 7/24 içerik tüketimine uygundur.</p>'],
        ['Türk İfşa 2026','<p>2026 itibarıyla güncellenen <strong>türk ifşa 2026</strong> platformları ileri teknolojiyle donatılmıştır. Yeni nesil altyapı üzerinde <strong>türk ifşa 2026</strong> siteleri yapay zekâ önerisi, gelişmiş güvenlik protokolleri ve 8K çözünürlük desteği sunar. Blockchain tabanlı ödeme seçenekleri <strong>türk ifşa 2026</strong> platformlarında öne çıkar. Çoklu platform uyumluluğu ve mobil öncelikli tasarım <strong>türk ifşa 2026</strong> hizmetlerinin temelini oluşturur. <strong>Türk ifşa 2026</strong> platformları 7/24 erişime uygundur.</p>'],
        ['Telegram İfşa 2026','<p>2026 güncellemeleriyle Telegram üzerindeki <strong>telegram ifşa 2026</strong> kanalları gelişmiş yetişkin içerik sunar. Yeni Telegram API yetenekleri <strong>telegram ifşa 2026</strong> hizmetlerinde gelişmiş bot entegrasyonları ve canlı yayın özelliklerini mümkün kılar. Mobil öncelikli tasarım ve iOS/Android uyumluluğu <strong>telegram ifşa 2026</strong> platformlarında standarttır. <strong>Telegram ifşa 2026</strong> kanalları 7/24 içerik paylaşımına uygundur.</p>'],
        ['Twitter İfşa 2026','<p>2026\'da X (Twitter) üzerinden <strong>twitter ifşa 2026</strong> hesapları premium yetişkin içerik dağıtır. Güncel API ile <strong>twitter ifşa 2026</strong> hizmetleri Spaces, ücretli gönderiler, özel içerik paketleri ve gerçek zamanlı etkileşim sunar. Yüksek çözünürlüklü görüntü paylaşımları ve özel gönderi erişim paketleri <strong>twitter ifşa 2026</strong> platformlarında öne çıkar. <strong>Twitter ifşa 2026</strong> hizmetleri kesintisiz içerik akışına uygundur.</p>'],
        ['Türk İfşa ve Türk İfşa İzle Deneyimleri','<p>Etkileşimli dijital ortamlarda <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> hizmetleri birlikte sunulur. Deneyimli ekipler <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> kalitesini sürekli artırır. Gizlilik ve güvenlik <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> platformlarında önceliklidir. Esnek paket yapıları <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> kullanıcılarına geniş seçenek sunar. <strong>Türk ifşa</strong> ve <strong>türk ifşa izle</strong> siteleri 7/24 aktiftir.</p>'],
        ['Türk İfşa İzleme ve Türk İfşa İçerikleri','<p>Canlı yayın odaklı <strong>türk ifşa izle</strong> hizmetleri geniş içerik ağı sunar. Sohbet ve samimi ortamlar <strong>türk ifşa izle</strong> deneyimini çeşitlendirir. Mahremiyet politikaları <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> sitelerinde veriyi korur. Sürekli eğitim alan ekip <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> kalitesini yükseltir. <strong>Türk ifşa izle</strong> siteleri 7/24 aktiftir. Güvenilir ödeme <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> platformlarında standarttır. Bütçeye uygun <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> paketleri bulunur.</p>'],
        ['Türk İfşa Videoları ve Türk İfşa İçerikleri İzle','<p>Video ve içerik odaklı <strong>türk ifşa videoları</strong> ile <strong>türk ifşa içerikleri</strong> hizmetleri geniş erişim sunar. Yüksek çözünürlük, çoklu senaryo ve özel formatlar <strong>türk ifşa videoları</strong> deneyimini güçlendirir. Etkileşim ve sohbet <strong>türk ifşa içerikleri</strong> platformlarında kullanıcı kontrolüyle birleşir. SSL ve anonim ödeme <strong>türk ifşa videoları</strong> ve <strong>türk ifşa içerikleri</strong> güvenliğini destekler. <strong>Türk ifşa videoları</strong> ve <strong>türk ifşa içerikleri</strong> 7/24 kullanıma uygundur.</p>'],
        ['Türk İfşa Telegram ve Telegram İfşa Deneyimleri','<p>Telegram ekosisteminde <strong>türk ifşa telegram</strong> ve <strong>telegram ifşa</strong> kanalları birlikte sunulur. Mobil erişim ve sade kullanım <strong>türk ifşa telegram</strong> ile <strong>telegram ifşa</strong> hizmetlerinde öne çıkar. Gizlilik ve şifreli iletişim <strong>türk ifşa telegram</strong> ve <strong>telegram ifşa</strong> platformlarında standarttır. <strong>Türk ifşa telegram</strong> ve <strong>telegram ifşa</strong> kanalları 7/24 içerik paylaşımına uygundur.</p>'],
        ['Türk İfşa Twitter ve Türk Porno İzle','<p>Sosyal akış ve video platformları <strong>türk ifşa twitter</strong> ile <strong>türk porno</strong> hizmetlerini bir araya getirir. Hızlı paylaşım ve anlık güncelleme <strong>türk ifşa twitter</strong> hizmetlerinin temelidir. Yüksek çözünürlük ve kişiselleştirilebilir oynatma <strong>türk porno izle</strong> deneyimini iyileştirir. <strong>Türk ifşa twitter</strong> ve <strong>türk porno izle</strong> hizmetleri kesintisiz içerik akışına uygundur.</p>'],
        ['Türk Porno ve Türk Porno İzle Siteleri','<p><strong>Türk porno</strong> ve <strong>türk porno izle</strong> siteleri video tüketimini tek çatıda sunar. 4K, çoklu cihaz ve kişiselleştirilebilir oynatma <strong>türk porno</strong> ile <strong>türk porno izle</strong> deneyimini güçlendirir. Düşük gecikme ve akıcı oynatma <strong>türk porno izle</strong> kullanıcı rahatlığını artırır. Şifreli bağlantı ve gizlilik <strong>türk porno</strong> platformlarında standarttır. <strong>Türk porno</strong> ve <strong>türk porno izle</strong> platformları gece gündüz erişime uygundur.</p>'],
        ['Türk İfsa ve Türk İfşa İzle','<p>Çevrimiçi yetişkin içerikte <strong>türk ifsa</strong> ve <strong>türk ifşa</strong> hizmetleri birlikte sunulur. Tek panelden erişim <strong>türk ifsa</strong> ve <strong>türk ifşa</strong> alternatiflerini kolaylaştırır. Gizlilik ve şifreli bağlantı her iki hizmette de önceliklidir. <strong>Türk ifsa</strong> ve <strong>türk ifşa izle</strong> platformları 7/24 aktiftir.</p>'],
        ['Türk İfsa Twitter ve Türk İfşa Twitter İzle','<p>X (Twitter) üzerinde <strong>türk ifsa twitter</strong> ve <strong>türk ifşa twitter</strong> hesapları yan yana sunulur. Hızlı paylaşım ve anlık güncelleme <strong>türk ifsa twitter</strong> ile <strong>türk ifşa twitter</strong> hizmetlerinin temelidir. Özel gönderiler ve premium erişim her iki platformda da mevcuttur. <strong>Türk ifsa twitter</strong> ve <strong>türk ifşa twitter</strong> hizmetleri kesintisiz içerik akışına uygundur.</p>'],
        ['Telegram İfsa ve Türk İfsa Telegram Grupları','<p>Telegram\'da <strong>telegram ifsa</strong> ve <strong>türk ifsa telegram</strong> kanalları gruplar halinde sunulur. Mobil erişim ve sade kullanım <strong>telegram ifsa</strong> ile <strong>türk ifsa telegram</strong> hizmetlerinde öne çıkar. Gizlilik ve şifreli iletişim her iki platformda da standarttır. <strong>Telegram ifsa</strong> ve <strong>türk ifsa telegram</strong> kanalları 7/24 içerik paylaşımına uygundur.</p>'],
        ['İfsa Telegram ve İfşa Telegram Grupları','<p><strong>İfsa telegram</strong> ve <strong>ifşa telegram</strong> grupları Telegram\'da yetişkin içerik sunar. Sade arayüz ve özel grup kaydı <strong>ifsa telegram</strong> ile <strong>ifşa telegram</strong> hizmetlerinde öne çıkar. İçerik yönetim esnekliği düzenli güncelleme ve özel kampanya sunar. <strong>İfsa telegram</strong> ve <strong>ifşa telegram</strong> hizmetleri 7/24 içerik tüketimine uygundur.</p>'],
        ['Türk İfşa 2026 ve Telegram İfşa 2026 Platformları','<p>2026 teknolojisi <strong>türk ifşa 2026</strong> ve <strong>telegram ifşa 2026</strong> platformlarını birleştirir. 8K, yapay zekâ önerisi ve gelişmiş botlar <strong>türk ifşa 2026</strong> ile <strong>telegram ifşa 2026</strong> hizmetlerinde öne çıkar. Blockchain tabanlı ödeme ve çoklu platform uyumluluğu standarttır. <strong>Türk ifşa 2026</strong> ve <strong>telegram ifşa 2026</strong> platformları 7/24 erişime uygundur.</p>'],
        ['Twitter İfşa 2026 ve Telegram İfşa 2026 Deneyimleri','<p>2026\'da sosyal ve mesajlaşma kanalları <strong>twitter ifşa 2026</strong> ve <strong>telegram ifşa 2026</strong> ile birleşir. Güncel API ve botlar <strong>twitter ifşa 2026</strong> ile <strong>telegram ifşa 2026</strong> hizmetlerinde gelişmiş özellikler sunar. Yüksek çözünürlüklü paylaşımlar ve premium içerik erişim paketleri her iki platformda mevcuttur. <strong>Twitter ifşa 2026</strong> ve <strong>telegram ifşa 2026</strong> hizmetleri kesintisiz içerik akışına uygundur.</p>'],
    ].forEach(([h,b],i) => secInsert.run(h,b,i));

    const t1Insert = db.prepare('INSERT INTO table1_rows(col_type,col_features,col_access,sort_order) VALUES(?,?,?,?)');
    [
        ['Türk İfşa','<strong>Türk ifşa</strong> hizmetleri yüksek çözünürlük ve çoklu içerik seçeneğiyle sunulur; profesyonel altyapı ve sıkı gizlilik taahhüdü','7/24 Aktif'],
        ['Türk İfşa İzle','<strong>Türk ifşa izle</strong> geniş portföy, HD yayın, kişisel deneyim ve anonim kullanım ile desteklenir','7/24 Aktif'],
        ['Türk İfşa Videoları','<strong>Türk ifşa videoları</strong> canlı bağlantı, üst çözünürlük ve etkileşimli araçlarla sunulur','7/24 Aktif'],
        ['Türk İfşa İçerikleri','Farklı senaryo ve fantezi alternatifleri ile <strong>türk ifşa içerikleri</strong> platformları, yüksek kalite standartları, kişiselleştirilmiş içerikler','7/24 Aktif'],
        ['Türk İfşa Platformları','Uzman altyapı üzerinden <strong>türk ifşa platformları</strong> gösterileri, yüksek çözünürlüklü görüntü, uzman yayın standartları','7/24 Aktif'],
        ['Türk İfşa Siteleri','Canlı iletişim ile <strong>türk ifşa siteleri</strong> yayınları, geniş içerik alternatifleri, yüksek kalite standartları','7/24 Aktif'],
        ['Türk İfşa ve Türk İfşa İzle','Farklı dijital alternatifler ile <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> sohbetleri, esnek paket yapıları, tutkulu atmosfer','7/24 Aktif'],
        ['Türk İfşa Videoları ve Türk İfşa İçerikleri','Etkileşimli özellikler ile <strong>türk ifşa videoları</strong> ve <strong>türk ifşa içerikleri</strong> webcam yayınları, yüksek kalite, mahremiyet koruması','7/24 Aktif'],
        ['Türk İfşa Platformları ve Türk İfşa Siteleri','Geniş kategori alternatifleri ile <strong>türk ifşa platformları</strong> ve <strong>türk ifşa siteleri</strong> deneyimi, aralıksız yayın, ücretsiz deneme fırsatı','7/24 Aktif'],
        ['Türk İfşa ve Türk İfşa Videoları','Kişiselleştirilmiş içerikler ile <strong>türk ifşa</strong> ve <strong>türk ifşa videoları</strong> hizmetleri, tamamen isimsiz, yoğun tutkulu ortam','7/24 Aktif'],
        ['Türk İfşa İzle ve Türk İfşa İçerikleri','Uzman hostesler ile <strong>türk ifşa izle</strong> ve <strong>türk ifşa içerikleri</strong> sohbetleri, kesin gizlilik taahhüdü, anında iletişim fırsatı','7/24 Aktif'],
        ['Türk İfşa ve Türk İfşa Platformları','Aralıksız yayın akışı ile <strong>türk ifşa</strong> ve <strong>türk ifşa platformları</strong> kategorileri, geniş içerik ağı, deneme fırsatları','7/24 Aktif'],
        ['Türk İfşa İzle ve Türk İfşa Siteleri','Deneyimli operatörler ile <strong>türk ifşa izle</strong> ve <strong>türk ifşa siteleri</strong> diyalogları, güvenilir ödeme sistemleri, detaylı sohbet','7/24 Aktif'],
        ['Türk İfşa Telegram','Telegram uygulaması aracılığıyla <strong>türk ifşa telegram</strong> kanalları, cep telefonu uyumlu kullanım, uçtan uca şifreleme, anında bildirimler','7/24 Aktif'],
        ['Telegram İfşa','Telegram mesajlaşma uygulaması ile <strong>telegram ifşa</strong> platformları, özel kanal kayıtları, gizli sohbet özellikleri, VIP giriş paketleri','7/24 Aktif'],
        ['İfşa Telegram','Telegram üzerinden <strong>ifşa telegram</strong> hizmetleri, özel grup kayıtları, premium içerik girişleri, birden fazla dil desteği','7/24 Aktif'],
        ['Türk İfşa Telegram ve Telegram İfşa','Telegram uygulamasında <strong>türk ifşa telegram</strong> ve <strong>telegram ifşa</strong> kombinasyonu, aralıksız yayın akışı, anında mesajlaşma, emniyetli ödeme','7/24 Aktif'],
        ['İfşa Telegram ve Türk İfşa','Telegram kanalları ile <strong>ifşa telegram</strong> ve <strong>türk ifşa</strong> platformları, yüksek kalite içerikler, kişiselleştirilmiş deneyimler','7/24 Aktif'],
        ['Türk İfşa Twitter','Twitter sosyal medya uygulaması aracılığıyla <strong>türk ifşa twitter</strong> hesapları, süratli içerik paylaşımı, özel tweetler, premium giriş','7/24 Aktif'],
        ['Türk Porno','Uzman yetişkin içerik hizmetleri ile <strong>türk porno</strong> siteleri, yüksek çözünürlük ve 4K kalite, geniş kategori alternatifleri, emniyetli ödeme','7/24 Aktif'],
        ['Türk Porno İzle','Canlı görüntü izleme deneyimleri ile <strong>türk porno izle</strong> platformları, aralıksız akış, birden fazla cihaz desteği, kesintisiz oynatma','7/24 Aktif'],
        ['Türk Liseli İfşa','Yerel odaklı <strong>türk liseli ifşa</strong> kategorisi, <strong>liseli ifşa</strong> ile entegre, <strong>amatör porn</strong> içerikleri, TL ödeme, gizli mod','7/24 Aktif'],
        ['Türk Ünlü İfşa','<strong>Türk ünlü ifşa</strong> ve <strong>ünlü ifşa</strong> platformları, <strong>fenomen ifşa</strong> kategorisi, yüksek çözünürlük, kategorize arşiv','7/24 Aktif'],
        ['Fenomen İfşa','<strong>Fenomen ifşa</strong> içerikleri, <strong>türk ünlü ifşa</strong> ve <strong>ünlü ifşa</strong> ile yakın kategoriler, Türkçe arayüz, mahremiyet koruması','7/24 Aktif'],
        ['Ünlü İfşa','<strong>Ünlü ifşa</strong> platformları, <strong>türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong>, <strong>liseli ifşa</strong> ve <strong>amatör porn</strong> kategorileri','7/24 Aktif'],
        ['Liseli İfşa','<strong>Liseli ifşa</strong> ve <strong>türk liseli ifşa</strong> siteleri, <strong>amatör porn</strong> içerikleri, TL ödeme, 7/24 erişim','7/24 Aktif'],
        ['Amatör Porn','<strong>Amatör porn</strong> kategorisi, <strong>türk liseli ifşa</strong>, <strong>liseli ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>fenomen ifşa</strong> ile aynı platformlarda','7/24 Aktif'],
        ['Türk İfşa Twitter ve Türk Porno','Twitter hesapları ve görüntü platformları ile <strong>türk ifşa twitter</strong> ve <strong>türk porno</strong> kombinasyonu, süratli paylaşım, premium kalite içerikler','7/24 Aktif'],
        ['Türk Porno ve Türk Porno İzle','Görüntü içerikleri ve izleme siteleri ile <strong>türk porno</strong> ve <strong>türk porno izle</strong> platformları, geniş arşiv, düzenli yenilemeler','7/24 Aktif'],
        ['Türk İfşa ve Türk Porno','İfşa siteleri ve porno içerikleri ile <strong>türk ifşa</strong> ve <strong>türk porno</strong> hizmetleri, farklı kategoriler, kişiselleştirilmiş içerikler','7/24 Aktif'],
        ['Türk İfsa','Online dünyada canlı yetişkin içerik hizmetleri ile <strong>türk ifsa</strong> siteleri, yüksek kalite, birden fazla içerik alternatifi, kesin gizlilik taahhüdü','7/24 Aktif'],
        ['Türk İfsa ve Türk İfşa','İfşa siteleri ile <strong>türk ifsa</strong> ve <strong>türk ifşa</strong> kombinasyonu, geniş içerik ağı, uzman platform kalitesi','7/24 Aktif'],
        ['Türk İfsa ve Türk İfşa İzle','İzleme siteleri ile <strong>türk ifsa</strong> ve <strong>türk ifşa izle</strong> platformları, yüksek çözünürlüklü görüntü yayınları, bireysel deneyim, tamamen isimsiz','7/24 Aktif'],
        ['Türk İfsa ve Türk Porno','İfşa ve porno siteleri ile <strong>türk ifsa</strong> ve <strong>türk porno</strong> hizmetleri, farklı kategoriler, kişiselleştirilmiş içerikler','7/24 Aktif'],
        ['Türk İfsa Twitter','Twitter sosyal medya uygulaması aracılığıyla <strong>türk ifsa twitter</strong> hesapları, süratli içerik paylaşımı, özel tweetler, premium giriş, cep telefonu uyumlu','7/24 Aktif'],
        ['Türk İfsa Twitter ve Türk İfşa Twitter','Twitter uygulamasında <strong>türk ifsa twitter</strong> ve <strong>türk ifşa twitter</strong> kombinasyonu, süratli paylaşım, premium kalite içerikler, canlı bildirimler','7/24 Aktif'],
        ['Türk İfsa ve Türk İfsa Twitter','İfşa siteleri ve Twitter hesapları ile <strong>türk ifsa</strong> ve <strong>türk ifsa twitter</strong> platformları, geniş içerik ağı, anında güncellemeler','7/24 Aktif'],
        ['Türk İfsa Twitter ve Türk Porno','Twitter hesapları ve porno siteleri ile <strong>türk ifsa twitter</strong> ve <strong>türk porno</strong> hizmetleri, süratli paylaşım, farklı kategoriler','7/24 Aktif'],
        ['Telegram İfsa','Telegram mesajlaşma uygulaması ile <strong>telegram ifsa</strong> platformları, özel kanal kayıtları, gizli sohbet özellikleri, VIP giriş paketleri, cep telefonu uyumlu','7/24 Aktif'],
        ['Türk İfsa Telegram','Telegram uygulaması aracılığıyla <strong>türk ifsa telegram</strong> kanalları, cep telefonu uyumlu kullanım, uçtan uca şifreleme, anında bildirimler, geniş içerik kategorileri','7/24 Aktif'],
        ['İfsa Telegram','Telegram üzerinden <strong>ifsa telegram</strong> hizmetleri, özel grup kayıtları, premium içerik girişleri, birden fazla dil desteği, emniyetli ödeme','7/24 Aktif'],
        ['Telegram İfsa ve Telegram İfşa','Telegram uygulamasında <strong>telegram ifsa</strong> ve <strong>telegram ifşa</strong> kombinasyonu, aralıksız yayın akışı, anında mesajlaşma, emniyetli ödeme','7/24 Aktif'],
        ['Türk İfsa Telegram ve Türk İfşa Telegram','Telegram kanalları ile <strong>türk ifsa telegram</strong> ve <strong>türk ifşa telegram</strong> platformları, yüksek kalite içerikler, kişiselleştirilmiş deneyimler','7/24 Aktif'],
        ['İfsa Telegram ve İfşa Telegram','Telegram uygulamasında <strong>ifsa telegram</strong> ve <strong>ifşa telegram</strong> kombinasyonu, geniş içerik ağı, düzenli yenilemeler','7/24 Aktif'],
        ['Türk İfsa ve Türk İfsa Telegram','İfşa siteleri ve Telegram kanalları ile <strong>türk ifsa</strong> ve <strong>türk ifsa telegram</strong> platformları, geniş içerik ağı, anında bildirimler','7/24 Aktif'],
        ['Türk İfşa 2026','2026 yılı teknolojisi ile <strong>türk ifşa 2026</strong> platformları, 8K çözünürlük desteği, yapay zeka destekli öneriler, blockchain tabanlı ödeme, çoklu platform uyumluluğu','7/24 Aktif'],
        ['Telegram İfşa 2026','2026 yılı Telegram özellikleri ile <strong>telegram ifşa 2026</strong> kanalları, gelişmiş bot entegrasyonları, canlı yayın özellikleri, mobil öncelikli tasarım, iOS ve Android uyumluluğu','7/24 Aktif'],
        ['Twitter İfşa 2026','2026 yılı Twitter API özellikleri ile <strong>twitter ifşa 2026</strong> hesapları, Spaces canlı yayınları, yüksek çözünürlüklü görüntü paylaşımları, özel gönderi erişim paketleri, gerçek zamanlı etkileşim','7/24 Aktif'],
        ['Türk İfşa 2026 ve Telegram İfşa 2026','2026 teknolojisi ile <strong>türk ifşa 2026</strong> ve <strong>telegram ifşa 2026</strong> kombinasyonu, yeni nesil dijital altyapı, gelişmiş güvenlik protokolleri, çoklu platform desteği','7/24 Aktif'],
        ['Twitter İfşa 2026 ve Telegram İfşa 2026','Sosyal medya platformları ile <strong>twitter ifşa 2026</strong> ve <strong>telegram ifşa 2026</strong> kombinasyonu, canlı yayın özellikleri, premium içerik erişim paketleri, mobil uyumluluk','7/24 Aktif'],
        ['Türk İfşa 2026 ve Twitter İfşa 2026','2026 standartları ile <strong>türk ifşa 2026</strong> ve <strong>twitter ifşa 2026</strong> platformları, gelişmiş filtreleme sistemleri, kişiselleştirilmiş deneyim, gerçek zamanlı etkileşim','7/24 Aktif'],
    ].forEach(([t,f,a],i) => t1Insert.run(t,f,a,i));

    const t2Insert = db.prepare('INSERT INTO table2_rows(col_type,col_features,col_duration,sort_order) VALUES(?,?,?,?)');
    [
        ['Türk İfşa Başlangıç','<strong>Türk ifşa</strong> deneyimi için standart kalite, sınırlı süre, temel gizlilik','30 Dakika'],
        ['Türk İfşa Premium','<strong>Türk ifşa</strong> ve <strong>türk ifşa izle</strong> HD kalite, sınırsız geçiş, gelişmiş gizlilik','60 Dakika'],
        ['Türk İfşa VIP','4K kalite, özel senaryolar, bireysel moderasyon, gizli içerik erişimi','90 Dakika'],
        ['Türk İfşa İzle Limitsiz','Gün boyu sınırsız içerik değişimi, kayıt izni, limitsiz avantajlar','24 Saat'],
        ['Türk İfşa 2026 Premium','2026 teknolojisi ile 8K çözünürlük, yapay zeka destekli öneriler, blockchain ödeme, gelişmiş güvenlik protokolleri','120 Dakika'],
        ['Telegram İfşa 2026 VIP','2026 Telegram özellikleri ile gelişmiş bot entegrasyonları, canlı yayın özellikleri, premium içerik erişim, mobil öncelikli tasarım','90 Dakika'],
        ['Twitter İfşa 2026 Elite','2026 Twitter API ile Spaces canlı yayınları, yüksek çözünürlüklü paylaşımlar, özel gönderi paketleri, gerçek zamanlı etkileşim','180 Dakika'],
        ['Türk Liseli İfşa ve Liseli İfşa','<strong>Türk liseli ifşa</strong> ve <strong>liseli ifşa</strong> kategorileri, <strong>amatör porn</strong> içerikleri, TL ödeme, gizli mod','60 Dakika'],
        ['Türk Ünlü İfşa ve Fenomen İfşa','<strong>Türk ünlü ifşa</strong>, <strong>ünlü ifşa</strong> ve <strong>fenomen ifşa</strong> platformları, yüksek çözünürlük, kategorize arşiv','90 Dakika'],
        ['Amatör Porn Premium','<strong>Amatör porn</strong> tam erişim, <strong>türk liseli ifşa</strong>, <strong>liseli ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>fenomen ifşa</strong> kategorileri','120 Dakika'],
    ].forEach(([t,f,d],i) => t2Insert.run(t,f,d,i));

    const tipInsert = db.prepare('INSERT INTO tips(strong_text,body,sort_order) VALUES(?,?,?)');
    [
        ['Teknik Hazırlık:','Kesintisiz akış için <strong>türk ifşa</strong> ve <strong>türk ifşa izle</strong> kullanırken yüksek hızlı internet tercih edin.'],
        ['Gizlilik:','<strong>Türk ifşa</strong>, <strong>türk liseli ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>liseli ifşa</strong> ve <strong>amatör porn</strong> sitelerinde iki adımlı doğrulama ve takma ad kullanın.'],
        ['Kategori Seçimi:','<strong>Türk liseli ifşa</strong>, <strong>türk ünlü ifşa</strong>, <strong>fenomen ifşa</strong>, <strong>ünlü ifşa</strong>, <strong>liseli ifşa</strong> ve <strong>amatör porn</strong> için SSL\'li platformları seçin.'],
        ['Ödeme Yönetimi:','<strong>Türk ifşa</strong>, <strong>türk ifşa izle</strong> ve <strong>amatör porn</strong> platformlarında yalnızca şifreli ödeme sunanları kullanın.'],
    ].forEach(([s,b],i) => tipInsert.run(s,b,i));

    const sbcInsert = db.prepare('INSERT INTO schema_breadcrumbs(position,item_id,name) VALUES(?,?,?)');
    [[1,'/papaZ','Türk İfşa 😍'],[2,'/#papaZ','Türk İfşa 😍'],[3,'/#papaZ','Türk İfşa İzle 😍']]
        .forEach(([p,id,n]) => sbcInsert.run(p,id,n));
}

module.exports = { db, init };
