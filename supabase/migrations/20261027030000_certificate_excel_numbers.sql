-- Explicit Excel numbers; preserve allowlist, atomic reservation and idempotent retries.
create or replace function certificate_private.batch_action(p_action text,p_key text,p_payload jsonb,p_hashes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b certificate_private.batches%rowtype;
  item jsonb; score jsonb; i integer; j integer; start_number integer; count_rows integer;
  number_text text; parts text[]; seq integer; max_sequence integer; class_type text; issue_date date; name_text text; month_text text; result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from certificate_private.admins where user_id=auth.uid()) then
    raise exception 'Akun ini tidak memiliki izin penerbitan sertifikat.' using errcode='42501';
  end if;
  if p_action='next' then
    return jsonb_build_object('next_number',(select next_number from certificate_private.counter where singleton));
  end if;
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' then raise exception 'Identitas batch tidak valid.'; end if;
  -- Serialize reservations and retries. Counter updates roll back with a failed transaction.
  select next_number into start_number from certificate_private.counter where singleton for update;
  select * into b from certificate_private.batches where batch_key=p_key for update;
  if p_action='reserve' then
    if b.batch_key is not null then
      if b.payload is distinct from p_payload then raise exception 'Isi batch berbeda dari reservasi sebelumnya.'; end if;
    else
      if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'rows') is distinct from 'array' then raise exception 'Data batch tidak valid.'; end if;
      count_rows := jsonb_array_length(p_payload->'rows');
      if count_rows < 1 or count_rows > 200 or octet_length(p_payload::text)>1000000 then raise exception 'Batch harus berisi 1–200 peserta.'; end if;
      max_sequence := start_number - 1;
      insert into certificate_private.batches(batch_key,created_by,payload) values(p_key,auth.uid(),p_payload);
      for i in 0..count_rows-1 loop
        item := p_payload->'rows'->i;
        number_text := item->>'number';
        parts := regexp_match(number_text, '^NO[.]S[.]([1-9][0-9]{0,8})[.](CLT|Bimbel|TG)[.]([1-9]|[12][0-9]|3[01])[.](VIII|VII|XII|III|VI|IV|IX|XI|II|V|X|I)[.](20[0-9]{2}|2100)$');
        if parts is null then raise exception 'Nomor sertifikat dari Excel tidak valid. Impor ulang master terbaru.'; end if;
        seq := parts[1]::integer;
        class_type := parts[2];
        issue_date := make_date(parts[5]::integer, array_position(array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'],parts[4]),parts[3]::integer);
        if issue_date<'2020-01-01' then raise exception 'Tanggal terbit di luar batas.'; end if;
        if exists(select 1 from certificate_private.records where sequence=seq or number=number_text) then
          raise exception 'Nomor sertifikat % sudah digunakan atau sedang dipesan.',number_text using errcode='23505';
        end if;
        max_sequence := greatest(max_sequence,seq);
        name_text := btrim(item->>'name');
        if name_text is null or length(name_text) not between 1 and 150 or length(coalesce(item->>'ttl','')) not between 1 and 200 then raise exception 'Nama atau tempat/tanggal lahir tidak lengkap.'; end if;
        if jsonb_typeof(item->'scores') is distinct from 'array' or jsonb_array_length(item->'scores')<>5 then raise exception 'Lima nilai sertifikat wajib diisi.'; end if;
        for j in 0..4 loop
          score := item->'scores'->j;
          if jsonb_typeof(score->'value') is distinct from 'number' or (score->>'value')::numeric<0 or (score->>'value')::numeric>(case when j=4 then 100 else 25 end)
            or coalesce(score->>'display','') !~ '^[0-9]+([.][0-9]+)?$'
            or (score->>'display')::numeric<0 or (score->>'display')::numeric>(case when j=4 then 100 else 25 end) then raise exception 'Nilai sertifikat tidak valid.'; end if;
        end loop;
        insert into certificate_private.records(sequence,number,batch_key,position,name,name_key,class_type,issued_date)
        values(seq,number_text,p_key,i,name_text,lower(regexp_replace(name_text,'[[:space:]]+',' ','g')),class_type,issue_date);
      end loop;
      update certificate_private.counter set next_number=greatest(start_number,max_sequence+1) where singleton;
    end if;
  elsif p_action='complete' then
    if b.batch_key is null then raise exception 'Reservasi batch tidak ditemukan.'; end if;
    if b.status<>'issued' then
      count_rows := jsonb_array_length(b.payload->'rows');
      if jsonb_typeof(p_hashes) is distinct from 'array' or jsonb_array_length(p_hashes)<>count_rows then raise exception 'Semua PDF harus selesai sebelum penerbitan.'; end if;
      for i in 0..count_rows-1 loop
        if coalesce(p_hashes->>i,'') !~ '^[a-f0-9]{64}$' then raise exception 'Bukti PDF tidak valid.'; end if;
        update certificate_private.records set pdf_sha256=p_hashes->>i where batch_key=p_key and position=i;
      end loop;
      update certificate_private.batches set status='issued',issued_at=now() where batch_key=p_key;
    end if;
  else raise exception 'Aksi tidak dikenal.';
  end if;
  select jsonb_build_object('batch_key',p_key,'status',(select status from certificate_private.batches where batch_key=p_key),
    'records',jsonb_agg(jsonb_build_object('number',r.number,'name',r.name,'sequence',r.sequence,'position',r.position) order by r.position))
  into result from certificate_private.records r where r.batch_key=p_key;
  return result;
end; $$;
