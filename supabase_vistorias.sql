-- ============================================================
-- BEEMOB - Modulo de Vistorias
--
-- Vistoria de entrada, saida e periodica, conforme a Lei do
-- Inquilinato (Lei 8.245/91): o laudo de entrada e a referencia
-- para cobrar (ou nao) danos na saida.
--
-- Arquivo em ASCII puro de proposito - acento em literal comparado
-- pelo banco quebra se este texto passar por conversao de codificacao.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. VISTORIAS - o laudo
-- ------------------------------------------------------------
create table if not exists vistorias (
  id uuid primary key default gen_random_uuid(),
  imovel_id text references imoveis(id),
  contrato_id text references contratos(id),

  tipo text not null default 'entrada',
  status text not null default 'rascunho',

  data_vistoria date not null default current_date,
  responsavel_nome text,              -- quem da Beemob vistoriou
  acompanhante_nome text,             -- inquilino ou proprietario presente

  -- Leituras de medidores: entram no acerto de contas da saida
  leitura_agua numeric(12,2),
  leitura_energia numeric(12,2),
  leitura_gas numeric(12,2),

  chaves_entregues int,
  controles_entregues int,

  observacoes text,
  -- Preenchido na saida: custo estimado dos danos encontrados
  valor_danos numeric(12,2) default 0,

  -- Assinaturas do laudo
  assinatura_vistoriador boolean default false,
  assinatura_acompanhante boolean default false,
  data_assinatura date,

  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table vistorias drop constraint if exists vistorias_tipo_chk;
alter table vistorias add constraint vistorias_tipo_chk
  check (tipo in ('entrada', 'saida', 'periodica'));

alter table vistorias drop constraint if exists vistorias_status_chk;
alter table vistorias add constraint vistorias_status_chk
  check (status in ('rascunho', 'concluida', 'assinada', 'cancelada'));

create index if not exists idx_vistorias_imovel on vistorias(imovel_id);
create index if not exists idx_vistorias_contrato on vistorias(contrato_id);
create index if not exists idx_vistorias_data on vistorias(data_vistoria desc);

-- ------------------------------------------------------------
-- 2. AMBIENTES - comodos vistoriados
-- ------------------------------------------------------------
create table if not exists vistoria_ambientes (
  id uuid primary key default gen_random_uuid(),
  vistoria_id uuid references vistorias(id) on delete cascade,
  nome text not null,                 -- 'Sala', 'Cozinha', 'Quarto 1'...
  ordem int default 0,
  observacoes text,
  created_at timestamptz default now()
);

create index if not exists idx_vist_amb on vistoria_ambientes(vistoria_id, ordem);

-- ------------------------------------------------------------
-- 3. ITENS - o que foi conferido em cada ambiente
--
--    'estado' e o campo que a saida compara contra a entrada.
-- ------------------------------------------------------------
create table if not exists vistoria_itens (
  id uuid primary key default gen_random_uuid(),
  ambiente_id uuid references vistoria_ambientes(id) on delete cascade,
  descricao text not null,            -- 'Pintura da parede', 'Torneira'...
  estado text not null default 'bom',
  quantidade int default 1,
  observacoes text,
  ordem int default 0,
  created_at timestamptz default now()
);

alter table vistoria_itens drop constraint if exists vistoria_itens_estado_chk;
alter table vistoria_itens add constraint vistoria_itens_estado_chk
  check (estado in ('novo', 'bom', 'regular', 'ruim', 'danificado', 'ausente'));

create index if not exists idx_vist_itens on vistoria_itens(ambiente_id, ordem);

-- ------------------------------------------------------------
-- 4. FOTOS - evidencia, guardada no Supabase Storage
--    Aqui fica so o caminho; o arquivo vai para o bucket.
-- ------------------------------------------------------------
create table if not exists vistoria_fotos (
  id uuid primary key default gen_random_uuid(),
  vistoria_id uuid references vistorias(id) on delete cascade,
  ambiente_id uuid references vistoria_ambientes(id) on delete cascade,
  item_id uuid references vistoria_itens(id) on delete cascade,
  storage_path text not null,
  legenda text,
  created_at timestamptz default now()
);

create index if not exists idx_vist_fotos on vistoria_fotos(vistoria_id);

-- ------------------------------------------------------------
-- 5. MODELO PADRAO DE AMBIENTES E ITENS
--    Serve para criar uma vistoria ja preenchida em vez de
--    digitar tudo do zero toda vez.
-- ------------------------------------------------------------
create table if not exists vistoria_modelo (
  id uuid primary key default gen_random_uuid(),
  ambiente text not null,
  item text not null,
  ordem_ambiente int default 0,
  ordem_item int default 0,
  unique (ambiente, item)
);

insert into vistoria_modelo (ambiente, item, ordem_ambiente, ordem_item) values
  ('Sala',        'Piso',                      1, 1),
  ('Sala',        'Pintura das paredes',       1, 2),
  ('Sala',        'Teto',                      1, 3),
  ('Sala',        'Janelas e vidros',          1, 4),
  ('Sala',        'Tomadas e interruptores',   1, 5),
  ('Sala',        'Iluminacao',                1, 6),
  ('Cozinha',     'Piso',                      2, 1),
  ('Cozinha',     'Pintura das paredes',       2, 2),
  ('Cozinha',     'Azulejos',                  2, 3),
  ('Cozinha',     'Pia e torneira',            2, 4),
  ('Cozinha',     'Armarios',                  2, 5),
  ('Cozinha',     'Tomadas e interruptores',   2, 6),
  ('Cozinha',     'Vazamentos',                2, 7),
  ('Quarto 1',    'Piso',                      3, 1),
  ('Quarto 1',    'Pintura das paredes',       3, 2),
  ('Quarto 1',    'Armarios',                  3, 3),
  ('Quarto 1',    'Janelas e vidros',          3, 4),
  ('Quarto 1',    'Tomadas e interruptores',   3, 5),
  ('Banheiro',    'Piso',                      4, 1),
  ('Banheiro',    'Azulejos',                  4, 2),
  ('Banheiro',    'Vaso sanitario',            4, 3),
  ('Banheiro',    'Pia e torneira',            4, 4),
  ('Banheiro',    'Chuveiro',                  4, 5),
  ('Banheiro',    'Box',                       4, 6),
  ('Banheiro',    'Vazamentos',                4, 7),
  ('Area externa','Piso',                      5, 1),
  ('Area externa','Portao',                    5, 2),
  ('Area externa','Muros',                     5, 3),
  ('Geral',       'Fechaduras e chaves',       6, 1),
  ('Geral',       'Quadro de energia',         6, 2),
  ('Geral',       'Hidrometro',                6, 3),
  ('Geral',       'Limpeza geral',             6, 4)
on conflict (ambiente, item) do nothing;

-- ------------------------------------------------------------
-- 6. COMPARATIVO ENTRADA x SAIDA
--    A pergunta que o laudo existe para responder: o que piorou
--    entre a entrada e a saida, e portanto pode ser cobrado.
-- ------------------------------------------------------------
create or replace view vistoria_comparativo as
with ordem_estado as (
  select * from (values
    ('novo', 5), ('bom', 4), ('regular', 3),
    ('ruim', 2), ('danificado', 1), ('ausente', 0)
  ) as t(estado, nivel)
),
laudos as (
  select v.id, v.contrato_id, v.tipo, v.data_vistoria,
         a.nome as ambiente, i.descricao as item, i.estado, i.observacoes
    from vistorias v
    join vistoria_ambientes a on a.vistoria_id = v.id
    join vistoria_itens i on i.ambiente_id = a.id
   where v.status in ('concluida', 'assinada')
)
select
  e.contrato_id,
  e.ambiente,
  e.item,
  e.estado                     as estado_entrada,
  s.estado                     as estado_saida,
  e.data_vistoria              as data_entrada,
  s.data_vistoria              as data_saida,
  (oe.nivel - os_.nivel)       as niveis_de_piora,
  s.observacoes                as observacao_saida
from laudos e
join laudos s
  on s.contrato_id = e.contrato_id
 and s.ambiente = e.ambiente
 and s.item = e.item
 and s.tipo = 'saida'
join ordem_estado oe on oe.estado = e.estado
join ordem_estado os_ on os_.estado = s.estado
where e.tipo = 'entrada'
  and os_.nivel < oe.nivel;

-- ------------------------------------------------------------
-- 7. RLS - mesmo padrao das demais tabelas
-- ------------------------------------------------------------
alter table vistorias enable row level security;
alter table vistoria_ambientes enable row level security;
alter table vistoria_itens enable row level security;
alter table vistoria_fotos enable row level security;
alter table vistoria_modelo enable row level security;

drop policy if exists "auth_vistorias" on vistorias;
create policy "auth_vistorias" on vistorias
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_vistoria_ambientes" on vistoria_ambientes;
create policy "auth_vistoria_ambientes" on vistoria_ambientes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_vistoria_itens" on vistoria_itens;
create policy "auth_vistoria_itens" on vistoria_itens
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_vistoria_fotos" on vistoria_fotos;
create policy "auth_vistoria_fotos" on vistoria_fotos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_vistoria_modelo" on vistoria_modelo;
create policy "auth_vistoria_modelo" on vistoria_modelo
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop trigger if exists trg_vistorias_updated_at on vistorias;
create trigger trg_vistorias_updated_at
  before update on vistorias
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 8. Conferencia
-- ------------------------------------------------------------
select (select count(*) from vistoria_modelo) as itens_no_modelo,
       (select count(distinct ambiente) from vistoria_modelo) as ambientes_no_modelo;
