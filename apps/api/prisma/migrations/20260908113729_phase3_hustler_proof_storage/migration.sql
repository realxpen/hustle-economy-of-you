insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hustler-proofs',
  'hustler-proofs',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "hustler_proofs_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hustler-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "hustler_proofs_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hustler-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "hustler_proofs_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'hustler-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
