-- ============================================================
-- BEEMOB — Status automático de inadimplência
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Função que marca lançamentos vencidos como "atrasado"
create or replace function atualizar_status_atrasado()
returns void as $$
begin
  update lancamentos
  set status_pagamento = 'atrasado'
  where status_pagamento = 'pendente'
    and periodo_fim < current_date - interval '5 days';
end;
$$ language plpgsql;

-- Chama a função agora para corrigir registros existentes
select atualizar_status_atrasado();

-- View útil: lançamentos atrasados com dados do contrato
create or replace view v_inadimplentes as
select
  l.id,
  l.contrato_id,
  l.periodo_inicio,
  l.periodo_fim,
  l.valor_liquido_inquilino,
  l.status_pagamento,
  current_date - l.periodo_fim as dias_atraso,
  i.nome as inquilino,
  p.nome as proprietario,
  p.endereco_imovel as imovel
from lancamentos l
join contratos c on c.id = l.contrato_id
join inquilinos i on i.id = c.inquilino_id
join proprietarios p on p.id = c.proprietario_id
where l.status_pagamento = 'atrasado'
order by dias_atraso desc;

-- Permissão na view
grant select on v_inadimplentes to authenticated;
