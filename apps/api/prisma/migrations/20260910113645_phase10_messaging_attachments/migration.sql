create or replace function public.hustle_is_conversation_participant(conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."ConversationParticipant" cp
    join public."User" u on u.id = cp."userId"
    where cp."conversationId" = conversation_id
      and u."authSubject" = auth.uid()::text
  );
$$;

revoke all on function public.hustle_is_conversation_participant(text) from public;
grant execute on function public.hustle_is_conversation_participant(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  26214400,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "message_attachments_insert_participant" on storage.objects;
create policy "message_attachments_insert_participant"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and public.hustle_is_conversation_participant((storage.foldername(name))[1])
);

drop policy if exists "message_attachments_select_participant" on storage.objects;
create policy "message_attachments_select_participant"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'message-attachments'
  and public.hustle_is_conversation_participant((storage.foldername(name))[1])
);

drop policy if exists "message_attachments_delete_own" on storage.objects;
create policy "message_attachments_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = (select auth.uid()::text)
  and public.hustle_is_conversation_participant((storage.foldername(name))[1])
);
