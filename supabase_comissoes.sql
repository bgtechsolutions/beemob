-- Tabela de comissões persistidas
create table if not exists comissoes (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid references lancamentos(id) on delete cascade,
  contrato_id text references contratos(id),
  periodo date,
  corretor_nome text not null,
  funcao text not null check (funcao in ('Captador','Corretor','Gestor','Imobiliária')),
  valor numeric(12,2) not null default 0,
  pago boolean not null default false,
  data_pagamento date,
  created_at timestamptz not null default now()
);

alter table comissoes enable row level security;

create policy "auth_comissoes" on comissoes
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create index if not exists comissoes_lancamento_id_idx on comissoes(lancamento_id);
create index if not exists comissoes_pago_idx on comissoes(pago);

-- Corrigir view para não bypassar RLS
drop view if exists v_inadimplentes;
create or replace view v_inadimplentes
  with (security_invoker = true) as
  select
    l.id,
    l.contrato_id,
    l.periodo_fim,
    l.valor_liquido_inquilino,
    l.status_pagamento,
    i.nome as inquilino_nome,
    p.nome as proprietario_nome,
    p.endereco_imovel
  from lancamentos l
  join contratos c on c.id = l.contrato_id
  join inquilinos i on i.id = c.inquilino_id
  join proprietarios p on p.id = c.proprietario_id
  where l.status_pagamento = 'atrasado';
