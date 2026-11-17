<?php
declare(strict_types=1);

// Strict comma-separated CSV, including UTF-8 BOM, CRLF and multiline quoted cells.
// Physical line numbers refer to the original file, not the sample row position.
function csv_records(string $source): array {
    if (!preg_match('//u',$source)) throw new InvalidArgumentException('CSV harus memakai UTF-8.');
    if (str_starts_with($source,"\xEF\xBB\xBF")) $source=substr($source,3);
    $records=[];$cells=[];$cell='';$quoted=false;$closed=false;$line=1;$start=1;
    $emit=static function() use (&$records,&$cells,&$cell,&$start): void {
        $cells[]=$cell;
        if ($cells!==['']) $records[]=['line'=>$start,'cells'=>$cells];
        $cells=[];$cell='';
        if (count($records)>10001) throw new InvalidArgumentException('Maksimal 10.000 undangan per CSV.');
    };
    for ($i=0,$length=strlen($source);$i<$length;$i++) {
        $char=$source[$i];
        if ($quoted) {
            if ($char==='"') {
                if (($source[$i+1]??'')==='"') {$cell.='"';$i++;} else {$quoted=false;$closed=true;}
            } else {
                $cell.=$char;
                if ($char==="\n" || ($char==="\r" && ($source[$i+1]??'')!=="\n")) $line++;
            }
            continue;
        }
        if ($char==='"') {
            if ($cell!=='' || $closed) throw new InvalidArgumentException("Baris $line: kutip CSV tidak valid.");
            $quoted=true;
        } elseif ($char===',') {$cells[]=$cell;$cell='';$closed=false;
        } elseif ($char==="\r" || $char==="\n") {
            $emit();$closed=false;
            if ($char==="\r" && ($source[$i+1]??'')==="\n") $i++;
            $line++;$start=$line;
        } else {
            if ($closed) throw new InvalidArgumentException("Baris $line: karakter setelah kutip penutup.");
            $cell.=$char;
        }
    }
    if ($quoted) throw new InvalidArgumentException("Baris $start: kutip CSV belum ditutup.");
    $emit();return $records;
}

function uploaded_csv(): string {
    $file=$_FILES['csv']??null;
    if (!is_array($file) || ($file['error']??null)!==UPLOAD_ERR_OK || !is_int($file['size']??null) || $file['size']>5*1024*1024) throw new InvalidArgumentException('Pilih CSV maksimal 5 MB; periksa batas unggah PHP.');
    $source=file_get_contents($file['tmp_name']);
    if ($source===false || strlen($source)>5*1024*1024) throw new InvalidArgumentException('CSV tidak dapat dibaca atau melebihi 5 MB.');
    return $source;
}

function analyze_csv(PDO $db,string $event,string $source,bool $lock=false): array {
    $records=csv_records($source);
    if (!$records) throw new InvalidArgumentException('CSV kosong.');
    $headers=array_shift($records)['cells'];
    $simple=['kode','nama','perusahaan','jabatan'];$legacy=['event','code','name','company','position','category','token'];
    if ($headers!==$simple && $headers!==$legacy) throw new InvalidArgumentException('Header CSV harus: kode,nama,perusahaan,jabatan');
    if (!$records) throw new InvalidArgumentException('CSV tidak berisi tamu.');
    $rows=[];$seen=[];
    foreach ($records as $record) {
        $entry=['line'=>$record['line'],'code'=>'','name'=>'','company'=>'','position'=>'','token'=>'','error'=>''];
        try {
            if (count($record['cells'])!==count($headers)) throw new InvalidArgumentException('Jumlah kolom CSV tidak sesuai.');
            $r=array_combine($headers,$record['cells']);
            $entry['code']=trim($r['kode']??$r['code']);$entry['name']=trim($r['nama']??$r['name']);
            $entry['company']=trim($r['perusahaan']??$r['company']);$entry['position']=trim($r['jabatan']??$r['position']);
            if ($headers===$legacy && $r['event']!==$event) throw new InvalidArgumentException('Event CSV berbeda dengan acara yang dipilih.');
            code($entry['code']);
            if (isset($seen[$entry['code']])) throw new InvalidArgumentException('Kode duplikat; sudah digunakan pada baris '.$seen[$entry['code']].'.');
            $seen[$entry['code']]=$entry['line'];
            foreach (['name','company','position'] as $key) $entry[$key]=field($entry[$key]);
            if ($entry['name']==='') throw new InvalidArgumentException('Nama wajib diisi.');
            $entry['token']=trim($r['token']??'');
            if ($entry['token']!=='' && !preg_match('/\A[a-f0-9]{32,64}\z/',$entry['token'])) throw new InvalidArgumentException('Token QR CSV lama tidak valid.');
        } catch (InvalidArgumentException $e) {$entry['error']=$e->getMessage();}
        $rows[]=$entry;
    }
    // Fetch only relevant slots in bounded batches, never one DB request per CSV row.
    $existing=[];$codes=array_values(array_unique(array_column(array_filter($rows,static fn($r)=>$r['error']===''),'code')));
    foreach (array_chunk($codes,500) as $chunk) {
        $sql='SELECT kode,nama,perusahaan,jabatan,token FROM scan_tamu WHERE acara=? AND kode IN ('.implode(',',array_fill(0,count($chunk),'?')).')'.($lock?' FOR UPDATE':'');
        $q=$db->prepare($sql);$q->execute([$event,...$chunk]);
        foreach ($q as $old) $existing[$old['kode']]=$old;
    }
    $summary=['total'=>count($rows),'new'=>0,'existing'=>0,'invalid'=>0];$errors=[];$sample=[];
    foreach ($rows as &$row) {
        $old=$existing[$row['code']]??null;
        if ($row['error']==='' && $old && ($old['nama']!==$row['name'] || $old['perusahaan']!==$row['company'] || $old['jabatan']!==$row['position'] || ($row['token']!=='' && !hash_equals($old['token'],$row['token'])))) $row['error']='Kode sudah ada dengan data berbeda. Gunakan Edit untuk memperbaiki identitas.';
        $kind=$row['error']!==''?'invalid':($old?'existing':'new');$row['kind']=$kind;$summary[$kind]++;
        if ($kind==='invalid' && count($errors)<50) $errors[]=['line'=>$row['line'],'code'=>mb_safe_preview($row['code']),'message'=>$row['error']];
        if (count($sample)<20) $sample[]=['line'=>$row['line'],'code'=>mb_safe_preview($row['code']),'name'=>mb_safe_preview($row['name']),'company'=>mb_safe_preview($row['company']),'position'=>mb_safe_preview($row['position']),'kind'=>$kind];
    }
    unset($row);
    return ['rows'=>$rows,'summary'=>$summary,'errors'=>$errors,'sample'=>$sample,'errors_truncated'=>$summary['invalid']>count($errors),'can_import'=>$summary['invalid']===0];
}
function mb_safe_preview(string $value): string {
    // No mbstring extension is needed on shared hosting.
    preg_match('/\A.{0,200}/us',$value,$match);return $match[0]??'';
}
