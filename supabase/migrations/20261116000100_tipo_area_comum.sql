-- Empreendimentos — parte 1: novo tipo de local "área comum" (salão de festas, piscina, portaria...).
-- Fica num arquivo próprio porque o Postgres só deixa usar um valor novo de enum
-- depois que a transação que o criou termina.
alter type public.tipo_local add value if not exists 'area_comum';
