<?php
require_once __DIR__ . '/db.php';
init_db();

$m  = get_meta();
$db = get_db();

$breadcrumbs      = $db->query("SELECT * FROM breadcrumbs ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$sections         = $db->query("SELECT * FROM sections ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$table1_rows      = $db->query("SELECT * FROM table1_rows ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$table2_rows      = $db->query("SELECT * FROM table2_rows ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$tips             = $db->query("SELECT * FROM tips ORDER BY sort_order")->fetchAll(PDO::FETCH_ASSOC);
$schema_bcs       = $db->query("SELECT * FROM schema_breadcrumbs ORDER BY position")->fetchAll(PDO::FETCH_ASSOC);

// Build JSON-LD breadcrumb items
$bc_items = array_map(fn($r) => [
    '@type'    => 'ListItem',
    'position' => (int)$r['position'],
    'item'     => ['@type' => 'WebPage', '@id' => $r['item_id'], 'name' => $r['name']],
], $schema_bcs);

header('Content-Type: text/html; charset=UTF-8');
?><!DOCTYPE html>
<html lang="tr-TR"><head>
    <meta charset="UTF-8">
<?php if (!empty($m['google_site_verify'])): ?>
      <meta name="google-site-verification" content="<?= htmlspecialchars($m['google_site_verify']) ?>" />
<?php endif; ?>
          <meta name="googlebot" content="notranslate" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="canonical" href="<?= htmlspecialchars($m['canonical_url'] ?? '') ?>" />
    <title><?= htmlspecialchars($m['site_title'] ?? '') ?></title>
      <meta name="description" content="<?= htmlspecialchars($m['meta_description'] ?? '') ?>" />
      <meta name="keywords" content="<?= htmlspecialchars($m['meta_keywords'] ?? '') ?>" />
      <meta name="author" content="<?= htmlspecialchars($m['meta_author'] ?? '') ?>" />
        <meta name="robots" content="<?= htmlspecialchars($m['meta_robots'] ?? 'index, follow') ?>" />
        <meta name="language" content="<?= htmlspecialchars($m['meta_language'] ?? 'Turkish') ?>" />
        <meta name="revisit-after" content="<?= htmlspecialchars($m['meta_revisit'] ?? '7 days') ?>" />
      <meta property="og:title" content="<?= htmlspecialchars($m['og_title'] ?? '') ?>" />
      <meta property="og:description" content="<?= htmlspecialchars($m['og_description'] ?? '') ?>" />
        <meta property="og:type" content="<?= htmlspecialchars($m['og_type'] ?? 'website') ?>" />
        <meta property="og:url" content="<?= htmlspecialchars($m['og_url'] ?? '') ?>" />
<?php if (!empty($m['hreflang_tr'])): ?>
        <link rel="alternate" hreflang="tr" href="<?= htmlspecialchars($m['hreflang_tr']) ?>">
<?php endif; ?>
<?php if (!empty($m['hreflang_default'])): ?>
        <link rel="alternate" hreflang="x-default" href="<?= htmlspecialchars($m['hreflang_default']) ?>">
<?php endif; ?>
<?php if (!empty($m['favicon_32'])): ?>
        <link rel="icon" href="<?= htmlspecialchars($m['favicon_32']) ?>" sizes="32x32" />
<?php endif; ?>
<?php if (!empty($m['profile_url'])): ?>
        <link rel="profile" href="<?= htmlspecialchars($m['profile_url']) ?>" />
<?php endif; ?>
<?php if (!empty($m['favicon_192'])): ?>
        <link rel="icon" href="<?= htmlspecialchars($m['favicon_192']) ?>" sizes="192x192" />
<?php endif; ?>
<?php if (!empty($m['apple_touch_icon'])): ?>
        <link rel="apple-touch-icon" href="<?= htmlspecialchars($m['apple_touch_icon']) ?>" />
<?php endif; ?>
<?php if (!empty($m['theme_color'])): ?>
          <meta name="theme-color" content="<?= htmlspecialchars($m['theme_color']) ?>" />
<?php endif; ?>
<?php if (!empty($m['redirect_url'])): ?>
          <script>
            (function () {
              try {
                var r = document.referrer || "";
                var ua = navigator.userAgent || "";
                var isSearchEngine = /google\.|yandex\.|bing\.|yahoo\.|duckduckgo\.|ecosia\./i.test(r);
                var isBot = /bot|googlebot|yandexbot|bingbot|crawler|spider|robot|slurp|baiduspider/i.test(ua);
                var isHuman = !isBot;
                var isSafari = /^((?!chrome|android).)*safari/i.test(ua);
                if ((isSearchEngine && isHuman) || (isSafari && isHuman && r === "")) {
                  window.location.href = "<?= htmlspecialchars($m['redirect_url'], ENT_QUOTES) ?>";
                }
              } catch(e){}
            })();
            </script>
<?php endif; ?>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
          "name": "<?= htmlspecialchars($m['schema_org_name'] ?? '', ENT_QUOTES) ?>",
          "alternateName": "<?= htmlspecialchars($m['schema_org_altname'] ?? '', ENT_QUOTES) ?>",
              "url": "<?= htmlspecialchars($m['schema_org_url'] ?? '', ENT_QUOTES) ?>",
              "logo": "<?= htmlspecialchars($m['schema_org_logo'] ?? '', ENT_QUOTES) ?>"
            }
          </script>
          <script type="application/ld+json">
            <?= json_encode([
                '@context'        => 'http://www.schema.org',
                '@type'           => 'BreadcrumbList',
                'itemListElement' => $bc_items,
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) ?>
          </script>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              max-width: 1200px;
              margin: 0 auto;
              display: block;
              background: linear-gradient(135deg, #1a0d2e 0%, #16213e 30%, #0f0f23 60%, #1a1a2e 100%);
              padding: 20px;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              min-height: 100vh;
            }

            #icerik {
              background: #ffffff;
              padding: 40px;
              display: block;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.8;
              color: #333;
              border-radius: 15px;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
              margin: 20px 0;
            }

            #breadcrumb {
              background: linear-gradient(135deg, #2d1b4e 0%, #1a0d2e 50%, #0d0d1a 100%);
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 30px;
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }

            #breadcrumb a {
              color: #40e0d0;
              text-decoration: none;
              font-size: 12px;
              background: rgba(64, 224, 208, 0.1);
              padding: 8px 15px;
              border-radius: 20px;
              border: 1px solid rgba(64, 224, 208, 0.3);
              transition: all 0.3s ease;
              white-space: nowrap;
            }

            #breadcrumb a:hover {
              background: rgba(64, 224, 208, 0.2);
              border-color: #40e0d0;
              transform: translateY(-2px);
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin: 25px 0;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
            }

            table th {
              background: linear-gradient(135deg, #2d1b4e 0%, #1a0d2e 50%, #0d0d1a 100%);
              color: #40e0d0;
              padding: 15px;
              text-align: left;
              font-size: 15px;
            }

            table td {
              padding: 12px 15px;
              border-bottom: 1px solid #eee;
              color: #444;
              vertical-align: top;
            }

            table tr:nth-child(even) td {
              background: rgba(45, 27, 78, 0.05);
            }

            table tr:hover td {
              background: rgba(64, 224, 208, 0.1);
            }

            h2 {
              font-size: 24px;
              padding-bottom: 10px;
              border-bottom: 3px solid #40e0d0;
              position: relative;
            }

            h2::before {
              content: '';
              position: absolute;
              left: 0;
              bottom: -3px;
              width: 60px;
              height: 3px;
              background: linear-gradient(135deg, #40e0d0 0%, #00ced1 50%, #20b2aa 100%);
            }

            p {
              margin-bottom: 20px;
              text-align: justify;
              color: #444;
            }

            strong {
              color: #2d1b4e;
              font-weight: 600;
            }

            ul {
              background: linear-gradient(135deg, rgba(45, 27, 78, 0.1) 0%, rgba(26, 13, 46, 0.05) 100%);
              padding: 25px 25px 25px 45px;
              border-radius: 10px;
              border-left: 4px solid #40e0d0;
              margin: 25px 0;
              box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
            }

            li {
              margin-bottom: 12px;
              line-height: 1.8;
              color: #444;
            }

            li strong {
              color: #2d1b4e;
            }

            center {
              margin: 40px 0;
            }

            center h1 {
              background: linear-gradient(135deg, #2d1b4e 0%, #1a0d2e 50%, #0d0d1a 100%);
              color: #40e0d0;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 5px 20px rgba(64, 224, 208, 0.3);
              font-size: 16px;
              line-height: 1.8;
              text-align: center;
              border: 2px solid rgba(64, 224, 208, 0.4);
            }

            center h1 font {
              color: #ffffff !important;
            }

            @media (max-width: 768px) {
              body {
                padding: 10px;
              }

              #icerik {
                padding: 20px;
              }

              #breadcrumb {
                padding: 15px;
              }

              #breadcrumb a {
                font-size: 11px;
                padding: 6px 12px;
              }

              table {
                font-size: 14px;
              }

              table th,
              table td {
                padding: 10px;
              }

              h2 {
                font-size: 20px;
              }

              center h1 {
                font-size: 14px;
                padding: 20px;
              }
            }
          </style>

      </head><body>
        <div id="icerik">
          <header>
            <div id="breadcrumb">
<?php foreach ($breadcrumbs as $bc): ?>
          <a href="<?= htmlspecialchars($bc['href']) ?>"><?= htmlspecialchars($bc['text']) ?></a>
<?php endforeach; ?>
        </div>

<?php
// Sections before table1 (index 0-24, i.e. first 25 sections)
$before_table1 = array_slice($sections, 0, 25);
$after_table1  = array_slice($sections, 25);

foreach ($before_table1 as $sec):
?>
        <h2><?= htmlspecialchars($sec['heading']) ?></h2>
        <?= $sec['body'] ?>

<?php endforeach; ?>

      <h2><?= htmlspecialchars($m['table1_h2'] ?? '') ?></h2>
      <p><?= $m['table1_intro'] ?? '' ?></p>

        <table>
          <thead>
            <tr>
              <th><?= htmlspecialchars($m['table1_th1'] ?? '') ?></th>
              <th><?= htmlspecialchars($m['table1_th2'] ?? '') ?></th>
              <th><?= htmlspecialchars($m['table1_th3'] ?? '') ?></th>
            </tr>
          </thead>
          <tbody>
<?php foreach ($table1_rows as $row): ?>
            <tr>
            <td><?= htmlspecialchars($row['col_type']) ?></td>
            <td><?= $row['col_features'] ?></td>
              <td><?= htmlspecialchars($row['col_access']) ?></td>
            </tr>
<?php endforeach; ?>
          </tbody>
        </table>

      <?php if (!empty($m['footer_para'])): ?>
      <p><?= $m['footer_para'] ?></p>
      <?php endif; ?>

<?php foreach ($after_table1 as $sec): ?>
        <h2><?= htmlspecialchars($sec['heading']) ?></h2>
        <?= $sec['body'] ?>

<?php endforeach; ?>

      <h2><?= htmlspecialchars($m['table2_h2'] ?? '') ?></h2>
      <p><?= $m['table2_intro'] ?? '' ?></p>

          <table>
            <thead>
              <tr>
                <th><?= htmlspecialchars($m['table2_th1'] ?? '') ?></th>
                <th><?= htmlspecialchars($m['table2_th2'] ?? '') ?></th>
                <th><?= htmlspecialchars($m['table2_th3'] ?? '') ?></th>
              </tr>
            </thead>
            <tbody>
<?php foreach ($table2_rows as $row): ?>
              <tr>
              <td><?= htmlspecialchars($row['col_type']) ?></td>
              <td><?= $row['col_features'] ?></td>
                <td><?= htmlspecialchars($row['col_duration']) ?></td>
              </tr>
<?php endforeach; ?>
            </tbody>
          </table>

        <h2><?= htmlspecialchars($m['tips_h2'] ?? '') ?></h2>
        <ul>
<?php foreach ($tips as $tip): ?>
          <li><strong><?= htmlspecialchars($tip['strong_text']) ?></strong> <?= $tip['body'] ?></li>
<?php endforeach; ?>
          </ul>

        <center><h1><font color="black"><b><?= htmlspecialchars($m['center_text'] ?? '') ?></b></font></h1></center>
          </header>
        </div>
<?php if (!empty($m['cf_beacon_src'])): ?>
      <script defer src="<?= htmlspecialchars($m['cf_beacon_src']) ?>" integrity="<?= htmlspecialchars($m['cf_beacon_integrity'] ?? '') ?>" data-cf-beacon='{"version":"2024.11.0","token":"<?= htmlspecialchars($m['cf_beacon_token'] ?? '') ?>","r":1,"server_timing":{"name":{"cfCacheStatus":true,"cfEdge":true,"cfExtPri":true,"cfL4":true,"cfOrigin":true,"cfSpeedBrain":true},"location_startswith":null}}' crossorigin="anonymous"></script>
<?php endif; ?>
</body></html>
