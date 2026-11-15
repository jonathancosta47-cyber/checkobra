-- FVS multi-empresa — parte 3: fotos no Storage.
-- Bucket privado; cada arquivo fica em "<empresa_id>/..." e só a própria empresa acessa.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fvs-fotos', 'fvs-fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy fvs_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fvs-fotos'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text);

create policy fvs_fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fvs-fotos'
              and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text);

-- Apaga quem enviou, ou admin/engenheiro da empresa.
create policy fvs_fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'fvs-fotos'
         and (storage.foldername(name))[1] = (select public.minha_empresa_id())::text
         and (owner_id = (select auth.uid())::text
              or (select public.tem_papel('admin_empresa', 'engenheiro'))));
