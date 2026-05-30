-- ============================================================
-- BEEMOB IMÓVEIS — Migration completa
-- Cole e execute no SQL Editor do Supabase
-- ============================================================

-- Corretores
create table if not exists corretores (
  id text primary key,
  nome text not null,
  creci text,
  rg text,
  cpf text,
  endereco text,
  telefone text,
  created_at timestamptz default now()
);

-- Proprietários + dados do imóvel (1:1 como na planilha)
create table if not exists proprietarios (
  id text primary key,
  nome text not null,
  cpf text,
  rg text,
  orgao_emissor text,
  data_nasc date,
  naturalidade text,
  estado_civil text,
  telefone text,
  endereco_proprietario text,
  cep_proprietario text,
  cidade_uf_proprietario text,
  email text,
  endereco_imovel text,
  cep_imovel text,
  cidade_uf_imovel text,
  inscricao_municipal text,
  valor_aluguel numeric(12,2) default 0,
  valor_condominio numeric(12,2) default 0,
  taxas_extras_cond numeric(12,2) default 0,
  valor_iptu numeric(12,2) default 0,
  dia_vencto_condominio int,
  administradora text,
  taxas_extras numeric(12,2) default 0,
  banco text,
  agencia text,
  conta_corrente text,
  pix text,
  percentual_taxa_adm numeric(6,4) default 0.10,
  honorario_adm_primeiro numeric(12,2) default 0,
  primeiro_pgto_hon numeric(12,2) default 0,
  data_primeiro_pgto date,
  segundo_pgto_hon numeric(12,2) default 0,
  data_segundo_pgto date,
  captador_nome text,
  corretor_nome text,
  gestor_nome text,
  created_at timestamptz default now()
);

-- Inquilinos
create table if not exists inquilinos (
  id text primary key,
  nome text not null,
  cpf text,
  rg text,
  orgao_emissor text,
  data_nasc date,
  naturalidade text,
  estado_civil text,
  telefone text,
  endereco text,
  cep text,
  cidade_uf text,
  email text,
  created_at timestamptz default now()
);

-- Tabela de comissionamento (regras globais)
create table if not exists comissionamento (
  funcao text primary key,
  percentual_primeiro numeric(6,4) not null,
  percentual_recorrente numeric(6,4) not null
);

insert into comissionamento (funcao, percentual_primeiro, percentual_recorrente) values
  ('Captador', 0.20, 0.10),
  ('Corretor', 0.40, 0.10),
  ('Gestor', 0.10, 0.25),
  ('Imobiliária', 0.30, 0.55)
on conflict (funcao) do nothing;

-- Contratos
create table if not exists contratos (
  id text primary key,
  proprietario_id text references proprietarios(id),
  inquilino_id text references inquilinos(id),
  localizacao text,
  data_inicio date,
  data_fim date,
  data_primeiro_aluguel date,
  valor_primeiro_aluguel numeric(12,2) default 0,
  valor_recorrente numeric(12,2) default 0,
  percentual_taxa numeric(6,4) default 0.10,
  captador_nome text,
  corretor_nome text,
  gestor_nome text,
  assinatura_prop boolean default false,
  assinatura_imo boolean default false,
  assinatura_testemunha1 boolean default false,
  assinatura_testemunha2 boolean default false,
  status text default 'ativo' check (status in ('ativo','encerrado','suspenso')),
  observacoes text,
  created_at timestamptz default now()
);

-- Lançamentos financeiros mensais
create table if not exists lancamentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id text references contratos(id),
  periodo_inicio date not null,
  periodo_fim date not null,
  e_primeiro_mes boolean default false,
  dias_periodo int,
  valor_aluguel numeric(12,2) default 0,
  valor_condominio numeric(12,2) default 0,
  taxas_extras_cond numeric(12,2) default 0,
  valor_iptu numeric(12,2) default 0,
  despesas_manutencao numeric(12,2) default 0,
  multa numeric(12,2) default 0,
  juros numeric(12,2) default 0,
  subtotal_inquilino numeric(12,2) default 0,
  valor_liquido_inquilino numeric(12,2) default 0,
  taxa_adm_imobiliaria numeric(12,2) default 0,
  valor_repasse_proprietario numeric(12,2) default 0,
  status_pagamento text default 'pendente' check (status_pagamento in ('pendente','pago','atrasado')),
  data_pagamento date,
  observacoes text,
  created_at timestamptz default now()
);

-- Comissões por lançamento
create table if not exists comissoes (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid references lancamentos(id) on delete cascade,
  contrato_id text references contratos(id),
  corretor_nome text,
  funcao text,
  valor numeric(12,2) default 0,
  pago boolean default false,
  data_pagamento date,
  created_at timestamptz default now()
);

-- RLS habilitado (acesso público — dashboard pessoal sem autenticação)
alter table corretores enable row level security;
alter table proprietarios enable row level security;
alter table inquilinos enable row level security;
alter table contratos enable row level security;
alter table lancamentos enable row level security;
alter table comissoes enable row level security;
alter table comissionamento enable row level security;

create policy "public_all_corretores" on corretores for all using (true) with check (true);
create policy "public_all_proprietarios" on proprietarios for all using (true) with check (true);
create policy "public_all_inquilinos" on inquilinos for all using (true) with check (true);
create policy "public_all_contratos" on contratos for all using (true) with check (true);
create policy "public_all_lancamentos" on lancamentos for all using (true) with check (true);
create policy "public_all_comissoes" on comissoes for all using (true) with check (true);
create policy "public_all_comissionamento" on comissionamento for all using (true) with check (true);
