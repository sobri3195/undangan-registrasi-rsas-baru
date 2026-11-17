<?php
declare(strict_types=1);
require __DIR__.'/lib/bootstrap.php';
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Content-Type: application/json; charset=utf-8');
function reply(array $data,int $status=200): never { http_response_code($status); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit; }
function guest(PDO $db,string $event,string $code): array {
    $q=$db->prepare('SELECT kode,nama,perusahaan,jabatan,token FROM scan_tamu WHERE acara=? AND kode=?');$q->execute([$event,$code]);$g=$q->fetch();
    if (!$g) throw new InvalidArgumentException('Undangan tidak ditemukan dalam daftar CSV.');
    return $g;
}
try {
    $action=$_GET['action']??'';
    if (!is_string($action)||!in_array($action,['events','create_event','update_guest','status','search','lookup','invitation','import','checkin','export'],true)) reply(['error'=>'Rute tidak ditemukan.'],404);
    $write=in_array($action,['import','checkin','create_event','update_guest'],true);
    if ($_SERVER['REQUEST_METHOD']!==($write?'POST':'GET')) { header('Allow: '.($write?'POST':'GET'));reply(['error'=>'Metode tidak diizinkan.'],405); }
    if ($write) csrf();
    // Release the session lock before DB work: polling must not block check-in.
    session_write_close();
    $db=database();
    if ($action==='events') {
        reply(['events'=>$db->query('SELECT kode,nama,tanggal,lokasi FROM scan_acara ORDER BY tanggal IS NULL,tanggal DESC,dibuat_utc DESC,kode')->fetchAll()]);
    }
    if ($action==='create_event') {
        $raw=file_get_contents('php://input',false,null,0,4097);
        if (strlen($raw)>4096) throw new InvalidArgumentException('Permintaan terlalu besar.');
        $b=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
        if (!is_array($b)) throw new InvalidArgumentException('Data acara tidak valid.');
        $c=code($b['kode']??'');$name=field($b['nama']??'');$location=field($b['lokasi']??'');
        if ($name==='') throw new InvalidArgumentException('Nama acara wajib diisi.');
        $date=$b['tanggal']??'';
        if (!is_string($date)) throw new InvalidArgumentException('Tanggal acara tidak valid.');
        if ($date!=='') {
            $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date);
            if (!$d || $d->format('Y-m-d')!==$date || $date<'1000-01-01') throw new InvalidArgumentException('Tanggal acara tidak valid.');
        }
        try {
            $q=$db->prepare('INSERT INTO scan_acara(kode,nama,tanggal,lokasi,dibuat_utc) VALUES (?,?,?,?,UTC_TIMESTAMP(3))');
            $q->execute([$c,$name,$date?:null,$location]);
        } catch (PDOException $e) {
            if ($e->getCode()==='23000') throw new InvalidArgumentException('Kode acara sudah digunakan. Gunakan kode lain.');
            throw $e;
        }
        reply(['message'=>'Acara baru berhasil dibuat.','event'=>$c],201);
    }
    $event=code($_GET['event']??'');
    $q=$db->prepare('SELECT kode,nama,tanggal,lokasi FROM scan_acara WHERE kode=?');$q->execute([$event]);$eventData=$q->fetch();
    if (!$eventData) throw new InvalidArgumentException('Acara tidak ditemukan. Pilih acara yang tersedia.');
    if ($action==='update_guest') {
        $raw=file_get_contents('php://input',false,null,0,8193);
        if (strlen($raw)>8192) throw new InvalidArgumentException('Permintaan terlalu besar.');
        $b=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
        if (!is_array($b) || array_diff(array_keys($b),['kode','nama','perusahaan','jabatan','original'])) throw new InvalidArgumentException('Hanya nama, perusahaan dan jabatan yang dapat diperbaiki.');
        $c=code($b['kode']??'');$values=[];$original=[];
        if (!is_array($b['original']??null) || count($b['original'])!==3) throw new InvalidArgumentException('Data awal tidak valid. Buka ulang formulir Edit.');
        foreach (['nama','perusahaan','jabatan'] as $key) {
            $values[$key]=field($b[$key]??null);
            field($b['original'][$key]??null);$original[$key]=$b['original'][$key];
        }
        if ($values['nama']==='') throw new InvalidArgumentException('Nama wajib diisi.');
        $db->beginTransaction();
        $q=$db->prepare('SELECT nama,perusahaan,jabatan FROM scan_tamu WHERE acara=? AND kode=? FOR UPDATE');$q->execute([$event,$c]);$current=$q->fetch();
        if (!$current) throw new InvalidArgumentException('Undangan tidak ditemukan dalam acara ini.');
        if ($current!==$original && $current!==$values) {
            $db->rollBack();reply(['error'=>'Identitas sudah diperbarui dari perangkat lain. Tutup lalu buka ulang Edit sebelum menyimpan.'],409);
        }
        $q=$db->prepare('UPDATE scan_tamu SET nama=?,perusahaan=?,jabatan=? WHERE acara=? AND kode=?');
        $q->execute([$values['nama'],$values['perusahaan'],$values['jabatan'],$event,$c]);
        $db->commit();reply(['message'=>'Identitas tamu berhasil diperbarui. QR undangan tetap dapat digunakan.']);
    }
    if ($action==='import') {
        $f=$_FILES['csv']??null;
        if (!$f || $f['error']!==UPLOAD_ERR_OK || $f['size']>5*1024*1024) throw new InvalidArgumentException('Pilih CSV maksimal 5 MB; periksa batas unggah PHP.');
        $file=fopen($f['tmp_name'],'r');
        $headers=fgetcsv($file,0,',','"','');
        if (!$headers) throw new InvalidArgumentException('CSV kosong.');
        $headers[0]=preg_replace('/^\xEF\xBB\xBF/','',$headers[0]);
        $simple=['kode','nama','perusahaan','jabatan'];
        $legacy=['event','code','name','company','position','category','token'];
        if ($headers!==$simple && $headers!==$legacy) throw new InvalidArgumentException('Header CSV harus: kode,nama,perusahaan,jabatan');
        $rows=[];$seen=[];
        while (($row=fgetcsv($file,0,',','"',''))!==false) {
            if ($row===[null]) continue;
            if (count($row)!==count($headers)) throw new InvalidArgumentException('Jumlah kolom CSV tidak sesuai.');
            $r=array_combine($headers,$row);
            if ($headers===$legacy && $r['event']!==$event) throw new InvalidArgumentException('Event CSV berbeda dengan acara yang dipilih.');
            $c=code(trim($r['kode']??$r['code']));
            if (isset($seen[$c])) throw new InvalidArgumentException('Kode duplikat dalam CSV: '.$c);
            $seen[$c]=true;
            $name=field($r['nama']??$r['name']);
            if ($name==='') throw new InvalidArgumentException('Nama wajib diisi.');
            $token=trim($r['token']??'');
            if ($token!=='' && !preg_match('/\A[a-f0-9]{32,64}\z/',$token)) throw new InvalidArgumentException('Token QR CSV lama tidak valid.');
            $rows[]=[$c,$name,field($r['perusahaan']??$r['company']),field($r['jabatan']??$r['position']),$token];
            if (count($rows)>10000) throw new InvalidArgumentException('Maksimal 10.000 undangan.');
        }
        fclose($file);
        if (!$rows) throw new InvalidArgumentException('CSV tidak berisi tamu.');
        $db->beginTransaction();
        $find=$db->prepare('SELECT nama,perusahaan,jabatan,token FROM scan_tamu WHERE acara=? AND kode=? FOR UPDATE');
        $insert=$db->prepare('INSERT INTO scan_tamu(acara,kode,nama,perusahaan,jabatan,token) VALUES (?,?,?,?,?,?)');$added=0;
        foreach ($rows as [$c,$name,$company,$position,$token]) {
            $find->execute([$event,$c]);$old=$find->fetch();
            if ($old) {
                if ($old['nama']!==$name || $old['perusahaan']!==$company || $old['jabatan']!==$position || ($token!=='' && !hash_equals($old['token'],$token))) throw new InvalidArgumentException('Kode '.$c.' sudah ada dengan data berbeda. Impor dibatalkan.');
            } else { $insert->execute([$event,$c,$name,$company,$position,$token?:bin2hex(random_bytes(24))]);$added++; }
        }
        $db->commit();reply(['added'=>$added,'message'=>"$added tamu baru disimpan. Daftar langsung tersedia di T01–T06."]);
    }
    if ($action==='search') {
        $term=field($_GET['q']??'');
        if (preg_match_all('/./us',$term)<2) reply(['guests'=>[]]);
        $like='%'.strtr($term,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
        $q=$db->prepare("SELECT kode,nama,perusahaan,jabatan FROM scan_tamu WHERE acara=? AND (kode LIKE ? ESCAPE '!' OR nama LIKE ? ESCAPE '!' OR perusahaan LIKE ? ESCAPE '!' OR jabatan LIKE ? ESCAPE '!') ORDER BY nama,kode LIMIT 50");$q->execute([$event,$like,$like,$like,$like]);reply(['guests'=>$q->fetchAll()]);
    }
    if ($action==='lookup' || $action==='invitation') {
        $c=code($_GET['code']??'');$g=guest($db,$event,$c);
        if (isset($_GET['token'])) {
            if (!is_string($_GET['qr_event']??null) || $_GET['qr_event']!==$event || !is_string($_GET['token']) || !hash_equals($g['token'],$_GET['token'])) throw new InvalidArgumentException('QR tidak cocok dengan daftar acara.');
        }
        $q=$db->prepare('SELECT tablet,dicatat_utc FROM scan_catatan WHERE acara=? AND kode=? ORDER BY dicatat_utc,tablet');$q->execute([$event,$c]);$records=$q->fetchAll();
        $url=APP_BASE_URL.'/index.php?page=scan#'.http_build_query(['v'=>'1','event'=>$event,'code'=>$c,'token'=>$g['token']],'','&',PHP_QUERY_RFC3986);
        unset($g['token']);reply(['guest'=>$g,'records'=>$records,'url'=>$action==='invitation'?$url:null]);
    }
    if ($action==='checkin') {
        $raw=file_get_contents('php://input',false,null,0,4097);
        if (strlen($raw)>4096) throw new InvalidArgumentException('Permintaan terlalu besar.');
        $b=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
        if (!is_array($b) || !is_string($b['tablet']??null) || !preg_match('/\AT0[1-6]\z/',$b['tablet'])) throw new InvalidArgumentException('Pilih tablet T01–T06.');
        $c=code($b['code']??'');guest($db,$event,$c);
        $q=$db->prepare('INSERT INTO scan_catatan(acara,kode,tablet,dicatat_utc) VALUES (?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE tablet=VALUES(tablet)');$q->execute([$event,$c,$b['tablet']]);
        reply(['message'=>$q->rowCount()===1?'Kehadiran berhasil dicatat.':'Tamu ini sudah dicatat pada tablet ini.','duplicate'=>$q->rowCount()!==1]);
    }
    // Filter and search share the exact same query for the admin table and CSV.
    $filter=$_GET['filter']??'present';
    if (!is_string($filter) || !in_array($filter,['all','present','absent'],true)) throw new InvalidArgumentException('Filter kehadiran tidak valid.');
    $search=field($_GET['q']??'');
    $where=['t.acara=?'];$params=[$event];
    $exists='EXISTS (SELECT 1 FROM scan_catatan x WHERE x.acara=t.acara AND x.kode=t.kode)';
    if ($filter==='present') $where[]=$exists;
    if ($filter==='absent') $where[]='NOT '.$exists;
    if ($search!=='') {
        $like='%'.strtr($search,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
        $where[]="(t.kode LIKE ? ESCAPE '!' OR t.nama LIKE ? ESCAPE '!' OR t.perusahaan LIKE ? ESCAPE '!' OR t.jabatan LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM scan_catatan x WHERE x.acara=t.acara AND x.kode=t.kode AND x.tablet LIKE ? ESCAPE '!'))";
        array_push($params,$like,$like,$like,$like,$like);
    }
    $q=$db->prepare("SELECT t.kode,t.nama,t.perusahaan,t.jabatan,
        CASE WHEN COUNT(c.tablet)>0 THEN 'Sudah Datang' ELSE 'Belum Datang' END AS status,
        MIN(c.dicatat_utc) AS pertama_utc,COALESCE(GROUP_CONCAT(c.tablet ORDER BY c.tablet SEPARATOR ', '),'') AS tablet,COUNT(c.tablet) AS jumlah_tablet
        FROM scan_tamu t LEFT JOIN scan_catatan c ON c.acara=t.acara AND c.kode=t.kode
        WHERE ".implode(' AND ',$where)." GROUP BY t.kode,t.nama,t.perusahaan,t.jabatan
        ORDER BY pertama_utc DESC,t.nama,t.kode");
    $q->execute($params);$guests=$q->fetchAll();
    // One grouped row per guest slot, regardless of the number of scanning tablets.
    $q=$db->prepare("SELECT t.kode,t.nama,t.perusahaan,t.jabatan,MIN(c.dicatat_utc) AS pertama_utc,GROUP_CONCAT(c.tablet ORDER BY c.tablet SEPARATOR ', ') AS tablet,COUNT(c.tablet) AS jumlah_tablet FROM scan_tamu t JOIN scan_catatan c ON c.acara=t.acara AND c.kode=t.kode WHERE t.acara=? GROUP BY t.kode,t.nama,t.perusahaan,t.jabatan ORDER BY pertama_utc DESC,t.kode");$q->execute([$event]);$arrivals=$q->fetchAll();
    if ($action==='export') {
        header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="kehadiran-'. $event .'-'. $filter .'.csv"');
        $out=fopen('php://output','w');fwrite($out,"\xEF\xBB\xBF");
        fputcsv($out,['kode','nama','perusahaan','jabatan','status','pertama_utc','tablet','jumlah_tablet'],',','"','');
        foreach ($guests as $row) {
            $cells=array_map(static function($s): string { $s=(string)$s;return preg_match('/\A[\s\x{FEFF}]*[=+\-@]|\A[\t\r\n]/u',$s)?"'".$s:$s; },array_values($row));
            fputcsv($out,$cells,',','"','');
        }
        fclose($out);exit;
    }
    $q=$db->prepare('SELECT COUNT(*) FROM scan_tamu WHERE acara=?');$q->execute([$event]);$total=(int)$q->fetchColumn();
    $q=$db->prepare('SELECT tablet,COUNT(*) AS jumlah FROM scan_catatan WHERE acara=? GROUP BY tablet');$q->execute([$event]);$tablets=array_fill_keys(['T01','T02','T03','T04','T05','T06'],0);
    foreach ($q as $r) $tablets[$r['tablet']]=(int)$r['jumlah'];
    reply(['event'=>$event,'event_info'=>$eventData,'guests'=>$guests,'filter'=>$filter,'query'=>$search,'total'=>$total,'present'=>count($arrivals),'tablets'=>$tablets,'arrivals'=>$arrivals,'server_utc'=>gmdate('Y-m-d\TH:i:s\Z')]);
} catch (InvalidArgumentException|JsonException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();reply(['error'=>$e->getMessage()],422);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('RSAS API error: '.get_class($e).' '.$e->getCode());
    reply(['error'=>$e instanceof RuntimeException && !$e instanceof PDOException?$e->getMessage():'Data belum dapat diproses. Periksa schema/koneksi database lalu coba lagi.'],503);
}
