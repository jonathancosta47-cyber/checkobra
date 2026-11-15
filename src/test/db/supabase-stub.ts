// Banco Postgres em memória (PGlite) com as peças mínimas do Supabase que as migrations usam:
// papéis anon/authenticated/service_role, auth.users, auth.uid() e o schema storage.
// Serve para testar as migrations e o RLS sem tocar no Supabase de verdade.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  -- igual ao Supabase: depois de uma transação a configuração fica '' (texto vazio)
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner_id text default (auth.uid())::text
);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, delete on storage.objects to authenticated;
grant execute on function storage.foldername(text) to authenticated;
`;

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");

export async function createSupabaseDb({ seed = true } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  if (seed) await db.exec(readFileSync(path.join(root, "supabase", "seed.sql"), "utf8"));
  return db;
}

// Executa fn como um usuário logado (ou visitante, com userId null), igual ao PostgREST:
// papel authenticated/anon + claims do JWT. Tudo dentro de uma transação.
export function asUser<T>(db: PGlite, userId: string | null, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
    ]);
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    return fn(tx);
  });
}

// Captura o código de erro do Postgres (42501 = sem permissão/RLS, 23503 = chave estrangeira...).
export async function pgErrorCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
}
