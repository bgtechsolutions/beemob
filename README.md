# Beemob — Dashboard de Gestão de Locação

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Banco de dados**: Supabase (PostgreSQL)
- **Deploy**: GitHub Pages (automático via GitHub Actions)
- **PDFs**: jsPDF + jspdf-autotable

## Setup inicial (uma vez só)

### 1. Criar as tabelas no Supabase
1. Acesse https://supabase.com/dashboard/project/chiebthjmbnohclanosh
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo de `supabase_migration.sql`

### 2. Migrar dados da planilha atual
```bash
pip install openpyxl
python migrate_xlsx.py
```

### 3. Rodar localmente
```bash
npm install
npm run dev
# Acesse http://localhost:5173/beemob
```

### 4. Deploy no GitHub Pages
1. Crie um repo no GitHub (ex: `beemob`)
2. Configure os Secrets: **Settings → Secrets → Actions**:
   - `VITE_SUPABASE_URL` = `https://chiebthjmbnohclanosh.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = sua anon key
3. Ative o Pages: **Settings → Pages → Source: GitHub Actions**
4. Push para `main` — deploy automático

## Módulos
| Módulo | Descrição |
|--------|-----------|
| Dashboard | KPIs, gráficos mensais, últimos lançamentos |
| Contratos | CRUD completo + alertas de vencimento |
| Financeiro | Lançamentos mensais com cálculo automático + PDF |
| Proprietários | Cadastro com dados do imóvel, banco e taxas |
| Inquilinos | Cadastro completo |
| Corretores | Cadastro + CRECI |
| Comissões | Controle por corretor/função com resumo |

## Lógica de cálculo (igual à planilha)
- **1º mês**: valores calculados pro-rata pelos dias do período
- **Meses recorrentes**: valor cheio
- **Taxa Adm**: `valor_aluguel × percentual_taxa_adm` (padrão 10%)
- **Multa**: 2% sobre valor líquido
- **Juros**: 1% ao mês sobre valor líquido
- **Repasse proprietário**: `aluguel − taxa_adm − manutenções`
