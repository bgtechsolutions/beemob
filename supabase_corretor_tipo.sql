-- Adiciona coluna tipo na tabela corretores
ALTER TABLE corretores
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'corretor'
CHECK (tipo IN ('corretor', 'gestor', 'corretor_gestor'));

-- Atualiza comentário
COMMENT ON COLUMN corretores.tipo IS 'corretor | gestor | corretor_gestor';
