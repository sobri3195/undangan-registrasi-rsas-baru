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
    if (!is_string($action)||!in_array($action,['status','search','lookup','invitation','import','checkin','export'],true)) reply(['error'=>'Rute tidak ditemukan.'],404);
    $write=in_array($action,['import','checkin'],true);
    if ($_SERVER['REQUEST_METHOD']!==($write?'POST':'GET')) { header('Allow: '.($write?'POST':'GET'));reply(['error'=>'Metode tidak diizinkan.'],405); }
    if ($write) csrf();
    // Release the session lock before DB work: polling must not block check-in.
    session_write_close();
    $db=database();$event=configuration()['EVENT_CODE'];
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
            if ($headers===$legacy && $r['event']!==$event) throw new InvalidArgumentException('Event CSV berbeda dengan EVENT_CODE konfigurasi.');
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
            if (!is_string($_GET['event']??null) || $_GET['event']!==$event || !is_string($_GET['token']) || !hash_equals($g['token'],$_GET['token'])) throw new InvalidArgumentException('QR tidak cocok dengan daftar acara.');
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
    // One grouped row per guest slot, regardless of the number of scanning tablets.
    $q=$db->prepare("SELECT t.kode,t.nama,t.perusahaan,t.jabatan,MIN(c.dicatat_utc) AS pertama_utc,GROUP_CONCAT(c.tablet ORDER BY c.tablet SEPARATOR ', ') AS tablet,COUNT(c.tablet) AS jumlah_tablet FROM scan_tamu t JOIN scan_catatan c ON c.acara=t.acara AND c.kode=t.kode WHERE t.acara=? GROUP BY t.kode,t.nama,t.perusahaan,t.jabatan ORDER BY pertama_utc DESC,t.kode");$q->execute([$event]);$arrivals=$q->fetchAll();
    if ($action==='export') {
        header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="kehadiran-rsas.csv"');
        $out=fopen('php://output','w');fwrite($out,"\xEF\xBB\xBF");
        fputcsv($out,['kode','nama','perusahaan','jabatan','pertama_utc','tablet','jumlah_tablet'],',','"','');
        foreach ($arrivals as $row) {
            $cells=array_map(static function($s): string { $s=(string)$s;return preg_match('/\A[\s\x{FEFF}]*[=+\-@]|\A[\t\r\n]/u',$s)?"'".$s:$s; },array_values($row));
            fputcsv($out,$cells,',','"','');
        }
        fclose($out);exit;
    }
    $q=$db->prepare('SELECT COUNT(*) FROM scan_tamu WHERE acara=?');$q->execute([$event]);$total=(int)$q->fetchColumn();
    $q=$db->prepare('SELECT tablet,COUNT(*) AS jumlah FROM scan_catatan WHERE acara=? GROUP BY tablet');$q->execute([$event]);$tablets=array_fill_keys(['T01','T02','T03','T04','T05','T06'],0);
    foreach ($q as $r) $tablets[$r['tablet']]=(int)$r['jumlah'];
    reply(['event'=>$event,'total'=>$total,'present'=>count($arrivals),'tablets'=>$tablets,'arrivals'=>$arrivals,'server_utc'=>gmdate('Y-m-d\TH:i:s\Z')]);
} catch (InvalidArgumentException|JsonException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();reply(['error'=>$e->getMessage()],422);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('RSAS API error: '.get_class($e).' '.$e->getCode());
    reply(['error'=>$e instanceof RuntimeException && !$e instanceof PDOException?$e->getMessage():'Data belum dapat diproses. Periksa schema/koneksi database lalu coba lagi.'],503);
}
