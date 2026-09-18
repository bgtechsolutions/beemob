-- ============================================================
-- BEEMOB - Correcao do CHECK de status e do seed de comissionamento
--
-- POR QUE: o supabase_planilhas.sql foi copiado da tela do cmd, que
-- decodificou os bytes UTF-8 como Latin-1. O literal 'Autonomo' (com
-- acento) virou 'AutA'nomo' dentro do CHECK constraint, entao o valor
-- correto passou a ser recusado na importacao.
--
-- Este arquivo e 100% ASCII de proposito: pode ser copiado de qualquer
-- terminal, editor ou console sem risco de se corromper.
--
-- Rode no SQL Editor do Supabase ANTES de reimportar.
-- ============================================================

-- 1. Status de corretor em ASCII minusculo, igual ao padrao de
--    contratos.status ('ativo' / 'encerrado' / 'suspenso').
alter table corretores drop constraint if exists corretores_status_chk;
alter table corretores alter column status set default 'ativo';

update corretores set status = case
    when status is null            then 'ativo'
    when lower(status) like 'aut%' then 'autonomo'
    when lower(status) like 'inat%' then 'inativo'
    else 'ativo'
  end;

alter table corretores add constraint corretores_status_chk
  check (status in ('ativo', 'autonomo', 'inativo'));

-- 2. Mesma checagem para imoveis.status (ja era ASCII, mas o constraint
--    pode ter sido criado a partir do texto corrompido).
alter table imoveis drop constraint if exists imoveis_status_chk;
update imoveis set status = 'alugado'
 where status is null
    or status not in ('alugado', 'disponivel', 'vago', 'inativo');
alter table imoveis add constraint imoveis_status_chk
  check (status in ('alugado', 'disponivel', 'vago', 'inativo'));

-- 3. Idem para comissoes.tipo.
alter table comissoes drop constraint if exists comissoes_tipo_chk;
update comissoes set tipo = 'recorrente'
 where tipo is null or tipo not in ('primeiro', 'recorrente');
alter table comissoes add constraint comissoes_tipo_chk
  check (tipo in ('primeiro', 'recorrente'));

-- 4. Reseed do comissionamento com 'Imobiliaria' sem acento.
--    O trigger de validacao e DEFERRABLE, entao o delete + insert passa
--    desde que a transacao termine somando 100%.
delete from comissionamento where vigencia_inicio = '2026-09-01';

insert into comissionamento
  (funcao, percentual_primeiro, percentual_recorrente, vigencia_inicio, observacao)
values
  ('Corretor',    0.40, 0.10, '2026-09-01', 'Aba Pgto Comissoes Gerais (2)'),
  ('Captador',    0.20, 0.10, '2026-09-01', 'Aba Pgto Comissoes Gerais (2)'),
  ('Gestor',      0.20, 0.25, '2026-09-01', 'Coluna Gestor - Valdir'),
  ('Gestor ADM',  0.00, 0.00, '2026-09-01', 'Zerado na competencia 09/2026'),
  ('Imobiliaria', 0.20, 0.55, '2026-09-01', 'Coluna Beemob');

-- 5. Conferencia: deve devolver 1.0000 nas duas colunas.
select sum(percentual_primeiro)   as soma_primeiro,
       sum(percentual_recorrente) as soma_recorrente
  from comissionamento
 where vigencia_inicio = '2026-09-01';
