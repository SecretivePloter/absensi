-- Dedicated certificate registry. No attendance rows or existing policies are changed.
create schema if not exists certificate_private;
revoke all on schema certificate_private from public, anon, authenticated;
grant usage on schema certificate_private to anon, authenticated;

create table certificate_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
-- Explicit allowlist only. No users are auto-authorized from the legacy role table.
-- Grant publishing only to account IDs individually confirmed by the owner.

create table certificate_private.counter (
  singleton boolean primary key default true check(singleton),
  next_number integer not null check(next_number >= 1058)
);
insert into certificate_private.counter values(true,1058);
create table certificate_private.batches (
  batch_key text primary key check(batch_key ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','issued')),
  created_at timestamptz not null default now(),
  issued_at timestamptz
);
create table certificate_private.records (
  sequence integer primary key,
  number text not null unique,
  batch_key text not null references certificate_private.batches(batch_key),
  position integer not null,
  name text not null,
  name_key text not null,
  class_type text not null check(class_type in ('CLT','Bimbel','TG')),
  issued_date date not null,
  pdf_sha256 text,
  unique(batch_key,position),
  unique(name_key,class_type,issued_date)
);
alter table certificate_private.admins enable row level security;
alter table certificate_private.counter enable row level security;
alter table certificate_private.batches enable row level security;
alter table certificate_private.records enable row level security;
revoke all on all tables in schema certificate_private from public,anon,authenticated;

create function certificate_private.batch_action(p_action text,p_key text,p_payload jsonb,p_hashes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b certificate_private.batches%rowtype;
  item jsonb; score jsonb; i integer; j integer; start_number integer; count_rows integer;
  class_type text; issue_date date; name_text text; month_text text; result jsonb;
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
      class_type := p_payload->'settings'->>'classType';
      if class_type is null or class_type not in ('CLT','Bimbel','TG') then raise exception 'Jenis kelas tidak valid.'; end if;
      if coalesce(p_payload->'settings'->>'issueDate','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Tanggal terbit tidak valid.'; end if;
      issue_date := (p_payload->'settings'->>'issueDate')::date;
      if issue_date<'2020-01-01' or issue_date>'2100-12-31' then raise exception 'Tanggal terbit di luar batas.'; end if;
      month_text := (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month from issue_date)::integer];
      insert into certificate_private.batches(batch_key,created_by,payload) values(p_key,auth.uid(),p_payload);
      for i in 0..count_rows-1 loop
        item := p_payload->'rows'->i;
        name_text := btrim(item->>'name');
        if name_text is null or length(name_text) not between 1 and 150 or length(coalesce(item->>'ttl','')) not between 1 and 200 then raise exception 'Nama atau tempat/tanggal lahir tidak lengkap.'; end if;
        if jsonb_typeof(item->'scores') is distinct from 'array' or jsonb_array_length(item->'scores')<>5 then raise exception 'Lima nilai sertifikat wajib diisi.'; end if;
        for j in 0..4 loop
          score := item->'scores'->j;
          if jsonb_typeof(score->'value') is distinct from 'number' or (score->>'value')::numeric<0 or (score->>'value')::numeric>(case when j=4 then 100 else 25 end)
            or coalesce(score->>'display','') !~ '^\d+(\.[0-9]+)?$'
            or (score->>'display')::numeric<0 or (score->>'display')::numeric>(case when j=4 then 100 else 25 end) then raise exception 'Nilai sertifikat tidak valid.'; end if;
        end loop;
        insert into certificate_private.records(sequence,number,batch_key,position,name,name_key,class_type,issued_date)
        values(start_number+i,'NO.S.'||(start_number+i)||'.'||class_type||'.'||extract(day from issue_date)::integer||'.'||month_text||'.'||extract(year from issue_date)::integer,
          p_key,i,name_text,lower(regexp_replace(name_text,'\s+',' ','g')),class_type,issue_date);
      end loop;
      update certificate_private.counter set next_number=start_number+count_rows where singleton;
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
revoke all on function certificate_private.batch_action(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function certificate_private.batch_action(text,text,jsonb,jsonb) to authenticated;

create function public.certificate_batch(p_action text,p_key text default null,p_payload jsonb default null,p_hashes jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
  select certificate_private.batch_action(p_action,p_key,p_payload,p_hashes);
$$;
revoke all on function public.certificate_batch(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.certificate_batch(text,text,jsonb,jsonb) to authenticated;

-- Intentional anonymous exact-number lookup; no list, wildcard, scores, TTL, or photo access.
create function certificate_private.verify_number(p_number text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('number',r.number,'name',r.name,'class_type',r.class_type,'issued_date',r.issued_date,'status','valid')
  from certificate_private.records r join certificate_private.batches b using(batch_key)
  where r.number=upper(btrim(p_number)) and b.status='issued' and length(p_number)<=80
  union all
  select jsonb_build_object('number',r.number,'name',r.name,'class_type',r.class_type,'issued_date',r.issued_date,'status','valid')
  from certificate_private.records r join certificate_private.batches b using(batch_key)
  where r.class_type='Bimbel' and r.number=replace(upper(btrim(p_number)),'.BIMBEL.','.Bimbel.') and b.status='issued' and length(p_number)<=80
  limit 1;
$$;
revoke all on function certificate_private.verify_number(text) from public;
grant execute on function certificate_private.verify_number(text) to anon,authenticated;
create function public.certificate_verify(p_number text)
returns jsonb language sql stable security invoker set search_path='' as $$ select certificate_private.verify_number(p_number); $$;
revoke all on function public.certificate_verify(text) from public;
grant execute on function public.certificate_verify(text) to anon,authenticated;
