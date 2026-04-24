<?php
session_start();
if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../db.php';
init_db();

header('Content-Type: application/json; charset=UTF-8');

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db     = get_db();

function json_ok(array $extra = []): void {
    echo json_encode(['ok' => true] + $extra);
    exit;
}
function json_err(string $msg): void {
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

switch ($action) {

    // ── META ──────────────────────────────────────────────────
    case 'save_meta':
        $allowed = [
            'site_title','meta_description','meta_keywords','meta_author',
            'meta_robots','meta_language','meta_revisit',
            'og_title','og_description','og_type','og_url',
            'canonical_url','hreflang_tr','hreflang_default',
            'favicon_32','favicon_192','apple_touch_icon','theme_color','profile_url',
            'redirect_url',
            'schema_org_name','schema_org_altname','schema_org_url','schema_org_logo',
            'google_site_verify','cf_beacon_src','cf_beacon_integrity','cf_beacon_token',
            'table1_h2','table1_intro','table1_th1','table1_th2','table1_th3',
            'table2_h2','table2_intro','table2_th1','table2_th2','table2_th3',
            'tips_h2','center_text','footer_para',
        ];
        $stmt = $db->prepare("INSERT INTO meta(key,value) VALUES(:k,:v) ON CONFLICT(key) DO UPDATE SET value=:v");
        foreach ($allowed as $key) {
            if (isset($_POST[$key])) {
                $stmt->execute([':k' => $key, ':v' => $_POST[$key]]);
            }
        }
        json_ok();

    // ── BREADCRUMBS ───────────────────────────────────────────
    case 'save_breadcrumbs':
        $texts = $_POST['text'] ?? [];
        $hrefs = $_POST['href'] ?? [];
        $db->exec("DELETE FROM breadcrumbs");
        $stmt = $db->prepare("INSERT INTO breadcrumbs(text,href,sort_order) VALUES(:t,:h,:s)");
        foreach ($texts as $i => $t) {
            $t = trim($t);
            $h = trim($hrefs[$i] ?? '#');
            if ($t !== '') {
                $stmt->execute([':t' => $t, ':h' => $h, ':s' => $i]);
            }
        }
        json_ok();

    // ── SECTIONS ──────────────────────────────────────────────
    case 'save_sections':
        $ids      = $_POST['id']      ?? [];
        $headings = $_POST['heading'] ?? [];
        $bodies   = $_POST['body']    ?? [];

        $upsert = $db->prepare("INSERT INTO sections(id,heading,body,sort_order) VALUES(:id,:h,:b,:s)
            ON CONFLICT(id) DO UPDATE SET heading=:h, body=:b, sort_order=:s");
        $insert = $db->prepare("INSERT INTO sections(heading,body,sort_order) VALUES(:h,:b,:s)");
        $delete = $db->prepare("DELETE FROM sections WHERE id=:id");

        $existing_ids = $db->query("SELECT id FROM sections")->fetchAll(PDO::FETCH_COLUMN);
        $submitted_ids = [];

        foreach ($headings as $i => $h) {
            $h = trim($h);
            $b = trim($bodies[$i] ?? '');
            if ($h === '') continue;
            $id = intval($ids[$i] ?? 0);
            if ($id > 0) {
                $upsert->execute([':id' => $id, ':h' => $h, ':b' => $b, ':s' => $i]);
                $submitted_ids[] = $id;
            } else {
                $insert->execute([':h' => $h, ':b' => $b, ':s' => $i]);
                $submitted_ids[] = $db->lastInsertId();
            }
        }
        // Delete removed sections
        foreach ($existing_ids as $eid) {
            if (!in_array($eid, $submitted_ids)) {
                $delete->execute([':id' => $eid]);
            }
        }
        json_ok();

    // ── TABLE 1 ───────────────────────────────────────────────
    case 'save_table1':
        $ids      = $_POST['id']       ?? [];
        $types    = $_POST['col_type'] ?? [];
        $feats    = $_POST['col_feat'] ?? [];
        $accesses = $_POST['col_acc']  ?? [];

        $upsert = $db->prepare("INSERT INTO table1_rows(id,col_type,col_features,col_access,sort_order) VALUES(:id,:t,:f,:a,:s)
            ON CONFLICT(id) DO UPDATE SET col_type=:t, col_features=:f, col_access=:a, sort_order=:s");
        $insert = $db->prepare("INSERT INTO table1_rows(col_type,col_features,col_access,sort_order) VALUES(:t,:f,:a,:s)");
        $delete = $db->prepare("DELETE FROM table1_rows WHERE id=:id");

        $existing = $db->query("SELECT id FROM table1_rows")->fetchAll(PDO::FETCH_COLUMN);
        $submitted = [];

        foreach ($types as $i => $t) {
            $t = trim($t);
            if ($t === '') continue;
            $f  = trim($feats[$i]    ?? '');
            $a  = trim($accesses[$i] ?? '7/24 Aktif');
            $id = intval($ids[$i]    ?? 0);
            if ($id > 0) {
                $upsert->execute([':id' => $id, ':t' => $t, ':f' => $f, ':a' => $a, ':s' => $i]);
                $submitted[] = $id;
            } else {
                $insert->execute([':t' => $t, ':f' => $f, ':a' => $a, ':s' => $i]);
                $submitted[] = $db->lastInsertId();
            }
        }
        foreach ($existing as $eid) {
            if (!in_array($eid, $submitted)) $delete->execute([':id' => $eid]);
        }
        json_ok();

    // ── TABLE 2 ───────────────────────────────────────────────
    case 'save_table2':
        $ids   = $_POST['id']       ?? [];
        $types = $_POST['col_type'] ?? [];
        $feats = $_POST['col_feat'] ?? [];
        $durs  = $_POST['col_dur']  ?? [];

        $upsert = $db->prepare("INSERT INTO table2_rows(id,col_type,col_features,col_duration,sort_order) VALUES(:id,:t,:f,:d,:s)
            ON CONFLICT(id) DO UPDATE SET col_type=:t, col_features=:f, col_duration=:d, sort_order=:s");
        $insert = $db->prepare("INSERT INTO table2_rows(col_type,col_features,col_duration,sort_order) VALUES(:t,:f,:d,:s)");
        $delete = $db->prepare("DELETE FROM table2_rows WHERE id=:id");

        $existing = $db->query("SELECT id FROM table2_rows")->fetchAll(PDO::FETCH_COLUMN);
        $submitted = [];

        foreach ($types as $i => $t) {
            $t = trim($t);
            if ($t === '') continue;
            $f  = trim($feats[$i] ?? '');
            $d  = trim($durs[$i]  ?? '');
            $id = intval($ids[$i] ?? 0);
            if ($id > 0) {
                $upsert->execute([':id' => $id, ':t' => $t, ':f' => $f, ':d' => $d, ':s' => $i]);
                $submitted[] = $id;
            } else {
                $insert->execute([':t' => $t, ':f' => $f, ':d' => $d, ':s' => $i]);
                $submitted[] = $db->lastInsertId();
            }
        }
        foreach ($existing as $eid) {
            if (!in_array($eid, $submitted)) $delete->execute([':id' => $eid]);
        }
        json_ok();

    // ── TIPS ──────────────────────────────────────────────────
    case 'save_tips':
        $ids     = $_POST['id']          ?? [];
        $strongs = $_POST['strong_text'] ?? [];
        $bodies  = $_POST['body']        ?? [];

        $upsert = $db->prepare("INSERT INTO tips(id,strong_text,body,sort_order) VALUES(:id,:s,:b,:o)
            ON CONFLICT(id) DO UPDATE SET strong_text=:s, body=:b, sort_order=:o");
        $insert = $db->prepare("INSERT INTO tips(strong_text,body,sort_order) VALUES(:s,:b,:o)");
        $delete = $db->prepare("DELETE FROM tips WHERE id=:id");

        $existing  = $db->query("SELECT id FROM tips")->fetchAll(PDO::FETCH_COLUMN);
        $submitted = [];

        foreach ($strongs as $i => $s) {
            $s = trim($s);
            if ($s === '') continue;
            $b  = trim($bodies[$i] ?? '');
            $id = intval($ids[$i]  ?? 0);
            if ($id > 0) {
                $upsert->execute([':id' => $id, ':s' => $s, ':b' => $b, ':o' => $i]);
                $submitted[] = $id;
            } else {
                $insert->execute([':s' => $s, ':b' => $b, ':o' => $i]);
                $submitted[] = $db->lastInsertId();
            }
        }
        foreach ($existing as $eid) {
            if (!in_array($eid, $submitted)) $delete->execute([':id' => $eid]);
        }
        json_ok();

    // ── SCHEMA BREADCRUMBS ────────────────────────────────────
    case 'save_schema_bc':
        $positions = $_POST['position'] ?? [];
        $ids_field = $_POST['item_id']  ?? [];
        $names     = $_POST['name']     ?? [];

        $db->exec("DELETE FROM schema_breadcrumbs");
        $stmt = $db->prepare("INSERT INTO schema_breadcrumbs(position,item_id,name) VALUES(:p,:i,:n)");
        foreach ($positions as $i => $p) {
            $p = intval($p);
            $id = trim($ids_field[$i] ?? '');
            $n  = trim($names[$i]    ?? '');
            if ($id !== '' && $n !== '') {
                $stmt->execute([':p' => $p, ':i' => $id, ':n' => $n]);
            }
        }
        json_ok();

    // ── LOGOUT ────────────────────────────────────────────────
    case 'logout':
        session_destroy();
        header('Location: index.php');
        exit;

    default:
        json_err('Unknown action: ' . htmlspecialchars($action));
}
