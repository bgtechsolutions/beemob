-- ============================================================
-- BEEMOB — Migração de segurança: RLS com autenticação
-- Execute no SQL Editor do Supabase APÓS habilitar Email Auth
-- ============================================================

-- 1. Remover policies públicas antigas
drop policy if exists "public_all_corretores" on corretores;
drop policy if exists "public_all_proprietarios" on proprietarios;
drop policy if exists "public_all_inquilinos" on inquilinos;
drop policy if exists "public_all_contratos" on contratos;
drop policy if exists "public_all_lancamentos" on lancamentos;
drop policy if exists "public_all_comissoes" on comissoes;
drop policy if exists "public_all_comissionamento" on comissionamento;

-- 2. Criar policies que exigem autenticação
create policy "auth_corretores" on corretores
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "auth_proprietarios" on proprietarios
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "auth_inquilinos" on inquilinos
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "auth_contratos" on contratos
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "auth_lancamentos" on lancamentos
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "auth_comissoes" on comissoes
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "auth_comissionamento" on comissionamento
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- 3. Adicionar updated_at em tabelas principais (auditoria básica)
alter table contratos add column if not exists updated_at timestamptz;
alter table lancamentos add column if not exists updated_at timestamptz;
alter table proprietarios add column if not exists updated_at timestamptz;

-- Trigger para atualizar updated_at automaticamente
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contratos_updated_at
  before update on contratos
  for each row execute function set_updated_at();

create trigger trg_lancamentos_updated_at
  before update on lancamentos
  for each row execute function set_updated_at();

create trigger trg_proprietarios_updated_at
  before update on proprietarios
  for each row execute function set_updated_at();
