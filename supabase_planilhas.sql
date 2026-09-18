-- ============================================================
-- BEEMOB IMÓVEIS — Extensão do schema para cobrir as planilhas
-- Origem: Comissionamento.xlsx + Planilha Financeira (.xlsm)
-- Execute no SQL Editor do Supabase, DEPOIS de supabase_migration.sql
-- e supabase_auth_migration.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. CORRETORES — status vindo da aba 'Corretores' (col H)
-- ------------------------------------------------------------
-- Valores em ASCII minusculo, sem acento, igual ao padrao ja usado em
-- contratos.status. Nao e estilo: um CHECK com acento quebra se este
-- arquivo passar por qualquer conversao de codificacao entre o disco e o
-- SQL Editor (copiar da tela do cmd, por exemplo, transforma
-- 'Autonomo' com acento em 'AutÃ´nomo' e o valor correto passa a ser recusado).
alter table corretores add column if not exists status text default 'ativo';
alter table corretores drop constraint if exists corretores_status_chk;
update corretores set status = case
    when lower(status) like 'aut%' then 'autonomo'
    when lower(status) like 'inat%' then 'inativo'
    else 'ativo'
  end;
alter table corretores add constraint corretores_status_chk
  check (status in ('ativo', 'autonomo', 'inativo'));

-- ------------------------------------------------------------
-- 2. IMÓVEIS — tabela nova.
--    A planilha usa ID_Imóvel = <cód. proprietário> || <sequência>
--    (fórmula =$A$3&1), o que permite N imóveis por proprietário.
--    Ex.: proprietário '2025-004' -> imóvel '2025-0041'.
--    Antes, esses campos viviam em `proprietarios` num 1:1 que a
--    própria planilha já não respeita.
-- ------------------------------------------------------------
create table if not exists imoveis (
  id text primary key,
  proprietario_id text references proprietarios(id),
  inscricao_municipal text,
  endereco text,
  cep text,
  cidade_uf text,

  -- Composição de valores (Cadastros Gerais, cols G..L)
  valor_aluguel numeric(12,2) default 0,
  valor_iptu numeric(12,2) default 0,
  dia_vencto_iptu int,
  valor_condominio numeric(12,2) default 0,
  taxas_extras_condominio numeric(12,2) default 0,
  dia_vencto_condominio int,
  administradora text,
  energia_solar numeric(12,2) default 0,        -- aba 'Cadastros', col G
  seguro_fianca numeric(12,2) default 0,        -- Rec_*, linha 14 (Kamila)
  taxas_extras_manutencao numeric(12,2) default 0,

  -- Garantia locatícia (Cadastros Gerais, cols Q..U)
  garantia text,                                 -- 'Fiador' | 'Seguro Fiança' | 'Caução'
  valor_caucao numeric(12,2) default 0,
  percentual_adm_caucao numeric(6,4) default 0,  -- 5,7% na planilha
  valor_parcial_caucao numeric(12,2) default 0,
  valor_total_com_adm_caucao numeric(12,2) default 0,

  -- Honorários e taxa de administração (cols Z..AG)
  honorario_adm_primeiro numeric(12,2) default 0,  -- = valor do aluguel
  primeiro_pgto_hon numeric(12,2) default 0,
  data_primeiro_pgto date,
  segundo_pgto_hon numeric(12,2) default 0,
  data_segundo_pgto date,
  percentual_taxa_adm numeric(6,4) default 0.10,
  valor_adm numeric(12,2) default 0,

  -- Equipe responsável (cols V..Y)
  captador_nome text,
  corretor_nome text,
  gestor_nome text,
  imobiliaria_nome text default 'BEEMOB',

  created_at timestamptz default now(),
  updated_at timestamptz
);

-- Saldo de honorários: coluna calculada, espelha a fórmula =Z8-AA8-AC8
alter table imoveis drop column if exists saldo_hon_adm;
alter table imoveis add column saldo_hon_adm numeric(12,2)
  generated always as (
    coalesce(honorario_adm_primeiro,0) - coalesce(primeiro_pgto_hon,0) - coalesce(segundo_pgto_hon,0)
  ) stored;

create index if not exists idx_imoveis_proprietario on imoveis(proprietario_id);

-- ------------------------------------------------------------
-- 3. CONTRATOS — campos que a planilha tem e o schema não tinha
-- ------------------------------------------------------------
alter table contratos add column if not exists imovel_id text references imoveis(id);
alter table contratos add column if not exists prazo_meses int default 30;
alter table contratos add column if not exists dia_pagamento int default 10;
alter table contratos add column if not exists garantia text;

create index if not exists idx_contratos_imovel on contratos(imovel_id);

-- ------------------------------------------------------------
-- 4. LANÇAMENTOS — espelha o demonstrativo mensal (abas Rec_MMAAAA)
--
--    Fórmula validada contra a planilha da Nádia (Rec_082026):
--      subtotal = aluguel + condomínio + IPTU + seguro_fiança
--      repasse  = subtotal
--                 - condomínio - complemento_condomínio
--                 - IPTU - seguro_fiança
--                 - taxa_extraordinária - honorários_1º - taxa_adm
--                 - despesas_manutenção + juros_multa
--      -> 2428,36 - 285 - 153,36 - 199 = 1791,00  ✓ confere
-- ------------------------------------------------------------
alter table lancamentos add column if not exists imovel_id text references imoveis(id);
alter table lancamentos add column if not exists dias_mes int;
alter table lancamentos add column if not exists seguro_fianca numeric(12,2) default 0;
alter table lancamentos add column if not exists complemento_condominio numeric(12,2) default 0;
alter table lancamentos add column if not exists taxa_extraordinaria_cond numeric(12,2) default 0;
alter table lancamentos add column if not exists honorarios_primeiro_aluguel numeric(12,2) default 0;
alter table lancamentos add column if not exists juros_multa numeric(12,2) default 0;
alter table lancamentos add column if not exists ajuste_manual numeric(12,2) default 0;
alter table lancamentos add column if not exists ajuste_motivo text;

comment on column lancamentos.ajuste_manual is
  'Ajuste avulso no repasse. Existe porque a planilha da Kamila traz "+6,61" cravado '
  'na fórmula do líquido (Rec_082026!H20) sem origem rastreável. Todo ajuste deve ter motivo.';
comment on column lancamentos.dias_mes is
  'Divisor do proporcional: dias reais do mês (DAY(EOMONTH)), como nas abas Rec_.';

-- ------------------------------------------------------------
-- 5. COMISSIONAMENTO — regras com vigência e 5 funções
--
--    Os percentuais divergiam em 4 lugares da planilha. A regra
--    adotada é a da aba 'Pgto Comissões Gerais (2)', competência
--    09/2026, confirmada pelo cliente.
--
--    Base 1º aluguel : aluguel proporcional (aluguel × dias / dias_do_mês)
--    Base recorrente : aluguel mensal × % taxa de administração (10%)
--    Cada coluna soma 100%.
-- ------------------------------------------------------------
drop table if exists comissionamento cascade;

create table comissionamento (
  id uuid primary key default gen_random_uuid(),
  funcao text not null,
  percentual_primeiro numeric(6,4) not null,
  percentual_recorrente numeric(6,4) not null,
  vigencia_inicio date not null default '2026-09-01',
  vigencia_fim date,                              -- null = vigente
  observacao text,
  created_at timestamptz default now(),
  unique (funcao, vigencia_inicio)
);

-- 'Imobiliaria' sem acento pelo mesmo motivo do status acima: e um valor
-- comparado pelo banco e casado pelo importador, entao fica em ASCII.
insert into comissionamento (funcao, percentual_primeiro, percentual_recorrente, vigencia_inicio, observacao) values
  ('Corretor',    0.40, 0.10, '2026-09-01', 'Aba Pgto Comissoes Gerais (2)'),
  ('Captador',    0.20, 0.10, '2026-09-01', 'Aba Pgto Comissoes Gerais (2)'),
  ('Gestor',      0.20, 0.25, '2026-09-01', 'Coluna Gestor - Valdir'),
  ('Gestor ADM',  0.00, 0.00, '2026-09-01', 'Zerado na competencia 09/2026'),
  ('Imobiliaria', 0.20, 0.55, '2026-09-01', 'Coluna Beemob');

-- Trava de integridade: cada vigência precisa somar 100% nas duas colunas.
create or replace function valida_soma_comissionamento()
returns trigger as $$
declare
  vig date;
  soma_p numeric;
  soma_r numeric;
begin
  -- Em DELETE o registro NEW não existe, por isso a vigência sai de TG_OP
  if tg_op = 'DELETE' then
    vig := old.vigencia_inicio;
  else
    vig := new.vigencia_inicio;
  end if;

  select sum(percentual_primeiro), sum(percentual_recorrente)
    into soma_p, soma_r
    from comissionamento
   where vigencia_inicio = vig;

  -- Vigência esvaziada por completo: nada a validar
  if soma_p is null then
    return null;
  end if;

  if round(soma_p, 4) <> 1.0000 then
    raise exception 'Percentuais de 1º aluguel da vigência % somam %, deveriam somar 100%%',
      vig, soma_p;
  end if;
  if round(soma_r, 4) <> 1.0000 then
    raise exception 'Percentuais recorrentes da vigência % somam %, deveriam somar 100%%',
      vig, soma_r;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_valida_comissionamento on comissionamento;
create constraint trigger trg_valida_comissionamento
  after insert or update or delete on comissionamento
  deferrable initially deferred
  for each row execute function valida_soma_comissionamento();

-- ------------------------------------------------------------
-- 6. COMISSÕES — vincular ao corretor cadastrado e ao tipo de base
-- ------------------------------------------------------------
alter table comissoes add column if not exists corretor_id text references corretores(id);
alter table comissoes add column if not exists tipo text default 'recorrente';
alter table comissoes drop constraint if exists comissoes_tipo_chk;
alter table comissoes add constraint comissoes_tipo_chk
  check (tipo in ('primeiro', 'recorrente'));
alter table comissoes add column if not exists base_calculo numeric(12,2) default 0;
alter table comissoes add column if not exists percentual numeric(6,4) default 0;
alter table comissoes add column if not exists competencia date;

create index if not exists idx_comissoes_competencia on comissoes(competencia);
create index if not exists idx_comissoes_corretor on comissoes(corretor_nome);

-- ------------------------------------------------------------
-- 7. ITENS DE CONDOMÍNIO — decomposição da aba 'Tx Condom.'
--    (taxa, água, esgoto, tarifa fixa, gás, fundo de reserva,
--     fundo de manutenção, taxas extras de A.G.E.)
-- ------------------------------------------------------------
create table if not exists condominio_itens (
  id uuid primary key default gen_random_uuid(),
  imovel_id text references imoveis(id) on delete cascade,
  competencia date not null,
  descricao text not null,
  valor numeric(12,2) default 0,
  extraordinaria boolean default false,   -- extraordinária é do proprietário, não do inquilino
  created_at timestamptz default now()
);

create index if not exists idx_cond_itens_imovel on condominio_itens(imovel_id, competencia);

-- ------------------------------------------------------------
-- 8. RESCISÕES — aba 'Cálculo Rescisão'
--    multa = (meses_restantes / prazo_contrato) × 3 × valor_aluguel
-- ------------------------------------------------------------
create table if not exists rescisoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id text references contratos(id),
  data_rescisao date not null,
  data_ultimo_periodo date,
  valor_aluguel_base numeric(12,2) default 0,    -- aluguel + IPTU + condomínio
  valor_por_dia numeric(12,2) default 0,
  dias_proporcionais int default 0,
  valor_caucao numeric(12,2) default 0,
  valor_aluguel_vigente numeric(12,2) default 0,
  valor_proporcional numeric(12,2) default 0,
  meses_restantes numeric(8,2) default 0,
  valor_multa numeric(12,2) default 0,
  valor_total numeric(12,2) default 0,
  observacoes text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 8b. STATUS DO IMÓVEL
--     A aba 'Cadastros' tem um segundo bloco, "IMÓVEIS PARA ALUGAR"
--     (linhas 51-70): 18 imóveis da carteira sem contrato ativo,
--     alguns marcados como 'VAGO'. Eles não existiam no schema.
-- ------------------------------------------------------------
alter table imoveis add column if not exists status text default 'alugado';
alter table imoveis drop constraint if exists imoveis_status_chk;
alter table imoveis add constraint imoveis_status_chk
  check (status in ('alugado', 'disponivel', 'vago', 'inativo'));
alter table imoveis add column if not exists contato_telefone text;

create index if not exists idx_imoveis_status on imoveis(status);

-- ------------------------------------------------------------
-- 8c. CAUÇÕES — bloco "VALOR REFERENTE À CAUÇÃO EM CONTA
--     APLICAÇÃO BEEMOB" (aba 'Cadastros', linhas 37-48).
--     É dinheiro de terceiros sob custódia da imobiliária:
--     precisa ficar rastreável e separado da receita.
-- ------------------------------------------------------------
create table if not exists caucoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id text references contratos(id),
  imovel_id text references imoveis(id),
  inquilino_nome text,
  valor_caucao numeric(12,2) default 0,
  percentual_adm numeric(6,4) default 0.057,   -- 5,7% na planilha
  valor_adm numeric(12,2) default 0,
  valor_complementar numeric(12,2) default 0,
  valor_total numeric(12,2) default 0,
  devolvido boolean default false,
  data_devolucao date,
  observacoes text,
  created_at timestamptz default now()
);

create index if not exists idx_caucoes_contrato on caucoes(contrato_id);

-- ------------------------------------------------------------
-- 8d. CHAVES DE UPSERT
--     O importador é idempotente: pode rodar de novo sem duplicar.
--     Isso exige um índice único em cada chave natural.
-- ------------------------------------------------------------
create unique index if not exists uq_lancamentos_periodo
  on lancamentos (contrato_id, periodo_inicio);

create unique index if not exists uq_comissoes_competencia
  on comissoes (contrato_id, funcao, tipo, competencia);

create unique index if not exists uq_condominio_itens
  on condominio_itens (imovel_id, competencia, descricao);

create unique index if not exists uq_caucoes_contrato
  on caucoes (contrato_id);

-- ------------------------------------------------------------
-- 9. RLS — mesmo padrão de supabase_auth_migration.sql
-- ------------------------------------------------------------
alter table caucoes enable row level security;
drop policy if exists "auth_caucoes" on caucoes;
create policy "auth_caucoes" on caucoes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

alter table imoveis enable row level security;
alter table comissionamento enable row level security;
alter table condominio_itens enable row level security;
alter table rescisoes enable row level security;

drop policy if exists "auth_imoveis" on imoveis;
create policy "auth_imoveis" on imoveis
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_comissionamento" on comissionamento;
create policy "auth_comissionamento" on comissionamento
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_condominio_itens" on condominio_itens;
create policy "auth_condominio_itens" on condominio_itens
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth_rescisoes" on rescisoes;
create policy "auth_rescisoes" on rescisoes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- updated_at automático em imoveis
drop trigger if exists trg_imoveis_updated_at on imoveis;
create trigger trg_imoveis_updated_at
  before update on imoveis
  for each row execute function set_updated_at();
