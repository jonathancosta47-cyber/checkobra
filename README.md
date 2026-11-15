# CheckObra

App web (mobile first) para ordens de serviço, FVS (Ficha de Verificação de Serviço)
e vistorias de entrega de apartamentos, com fotos, assinaturas e PDF.

Stack: React 19 + TanStack Start (Vite + Nitro), Tailwind, Supabase (banco, login e storage).

## Requisitos

- Node.js 22+ e npm
- Um projeto Supabase próprio (https://supabase.com — o plano gratuito serve)
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar migrations

## Rodar localmente

```sh
npm install
cp .env.example .env   # preencha com URL e publishable key do seu projeto Supabase
npm run dev            # http://localhost:8080
```

## Banco de dados

As migrations ficam em `supabase/migrations/`. Para aplicar no seu projeto:

```sh
npx supabase login
npx supabase link --project-ref SEU-PROJETO
npm run db:push        # aplica as migrations no projeto vinculado (--remote)
npm run db:types       # regenera src/integrations/supabase/types.ts
```

Login com Google (opcional): ative o provedor em Supabase > Authentication > Providers
e adicione a URL do app em Authentication > URL Configuration.

## Build e deploy

```sh
npm run build          # gera .output/
npm start              # servidor Node em http://localhost:3000 (PORT=... para trocar)
```

O Nitro detecta Vercel, Netlify e Cloudflare automaticamente quando o build roda nessas
plataformas; em qualquer outro servidor use `npm start`. Configure as mesmas variáveis
do `.env` no painel da hospedagem.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | testes (Vitest) |
| `npm run build` / `npm start` | build e servidor de produção |
| `npm run db:push` / `npm run db:types` | migrations e tipos do Supabase |
