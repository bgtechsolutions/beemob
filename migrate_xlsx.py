"""
Script de migração: XLSM → Supabase
Execute: python migrate_xlsx.py
"""
import openpyxl
from datetime import date
import json
import urllib.request
import urllib.parse

SUPABASE_URL = "https://chiebthjmbnohclanosh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaWVidGhqbWJub2hjbGFub3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTc3NTAsImV4cCI6MjA5NTczMzc1MH0.157u0hsYQyleejO_NLNlrulaiLv7Jm6io_B3pmAhdmU"
XLSX_PATH = r"C:\Users\Gabriel\Downloads\Sistema_Gestao_Locacao_Imobiliaria_05.xlsm"

HEADERS = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "resolution=merge-duplicates",
}

def fmt_date(v):
    if v is None: return None
    if isinstance(v, (date,)): return v.isoformat()
    try:
        from datetime import datetime
        if isinstance(v, datetime): return v.date().isoformat()
    except: pass
    return None

def upsert(table, rows):
    if not rows: return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(rows).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            print(f"  ✓ {table}: {len(rows)} registros")
    except Exception as e:
        print(f"  ✗ {table}: {e}")

def get_rows(ws, max_row=500):
    rows = []
    for r in ws.iter_rows(min_row=2, max_row=max_row, values_only=True):
        if any(c is not None for c in r): rows.append(r)
    return rows

wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, keep_vba=True, data_only=True)

print("=== Migrando Corretores ===")
ws = wb['Corretores']
corretores = []
for r in get_rows(ws):
    if not r[0]: continue
    corretores.append({
        "id": str(r[0]),
        "nome": str(r[1]) if r[1] else None,
        "creci": str(r[2]) if r[2] else None,
        "rg": str(r[3]) if r[3] else None,
        "cpf": str(r[4]) if r[4] else None,
        "endereco": str(r[5]) if r[5] else None,
        "telefone": str(r[6]) if r[6] else None,
    })
upsert("corretores", corretores)

print("=== Migrando Proprietários / Imóveis ===")
ws = wb['Proprietarios_Imoveis']
proprietarios = []
for r in get_rows(ws):
    if not r[0]: continue
    proprietarios.append({
        "id": str(r[0]),
        "nome": str(r[1]) if r[1] else None,
        "cpf": str(r[2]) if r[2] else None,
        "rg": str(r[3]) if r[3] else None,
        "orgao_emissor": str(r[4]) if r[4] else None,
        "data_nasc": fmt_date(r[5]),
        "naturalidade": str(r[6]) if r[6] else None,
        "estado_civil": str(r[7]) if r[7] else None,
        "telefone": str(r[8]) if r[8] else None,
        "endereco_proprietario": str(r[9]) if r[9] else None,
        "cep_proprietario": str(r[10]) if r[10] else None,
        "cidade_uf_proprietario": str(r[11]) if r[11] else None,
        "email": str(r[12]) if r[12] else None,
        "endereco_imovel": str(r[13]) if r[13] else None,
        "cep_imovel": str(r[14]) if r[14] else None,
        "cidade_uf_imovel": str(r[15]) if r[15] else None,
        "inscricao_municipal": str(r[16]) if r[16] else None,
        "valor_aluguel": float(r[17]) if isinstance(r[17], (int, float)) else 0,
        "valor_condominio": float(r[18]) if isinstance(r[18], (int, float)) else 0,
        "taxas_extras_cond": float(r[19]) if isinstance(r[19], (int, float)) else 0,
        "valor_iptu": float(r[20]) if isinstance(r[20], (int, float)) else 0,
        "dia_vencto_condominio": int(r[21]) if isinstance(r[21], (int, float)) else None,
        "administradora": str(r[22]) if r[22] else None,
        "taxas_extras": float(r[23]) if isinstance(r[23], (int, float)) else 0,
        "banco": str(r[24]) if r[24] else None,
        "agencia": str(r[25]) if r[25] else None,
        "conta_corrente": str(r[26]) if r[26] else None,
        "pix": str(r[27]) if r[27] else None,
        "percentual_taxa_adm": float(r[28]) if isinstance(r[28], (int, float)) else 0.10,
        "honorario_adm_primeiro": float(r[30]) if isinstance(r[30], (int, float)) else 0,
        "captador_nome": str(r[36]) if r[36] else None,
        "corretor_nome": str(r[37]) if r[37] else None,
        "gestor_nome": str(r[38]) if r[38] else None,
    })
upsert("proprietarios", proprietarios)

print("=== Migrando Inquilinos ===")
ws = wb['Inquilinos']
inquilinos = []
for r in get_rows(ws):
    if not r[0]: continue
    inquilinos.append({
        "id": str(r[0]),
        "nome": str(r[1]) if r[1] else None,
        "cpf": str(r[2]) if r[2] else None,
        "rg": str(r[3]) if r[3] else None,
        "orgao_emissor": str(r[4]) if r[4] else None,
        "data_nasc": fmt_date(r[5]),
        "naturalidade": str(r[6]) if r[6] else None,
        "estado_civil": str(r[7]) if r[7] else None,
        "telefone": str(r[8]) if r[8] else None,
        "endereco": str(r[9]) if r[9] else None,
        "cep": str(r[10]) if r[10] else None,
        "cidade_uf": str(r[11]) if r[11] else None,
        "email": str(r[12]) if r[12] else None,
    })
upsert("inquilinos", inquilinos)

print("=== Migrando Contratos ===")
ws = wb['Contratos Assinados']
contratos = []
for r in get_rows(ws):
    if not r[0] or not str(r[0]).startswith('20'): continue
    prop_id = str(r[0])
    inq_id = str(r[0])
    contratos.append({
        "id": str(r[0]),
        "proprietario_id": prop_id if any(p['id'] == prop_id for p in proprietarios) else None,
        "inquilino_id": inq_id if any(i['id'] == inq_id for i in inquilinos) else None,
        "localizacao": str(r[3]) if r[3] else None,
        "data_inicio": fmt_date(r[13]),
        "data_fim": fmt_date(r[14]),
        "data_primeiro_aluguel": fmt_date(r[15]),
        "valor_primeiro_aluguel": float(r[16]) if isinstance(r[16], (int, float)) else 0,
        "status": "ativo",
        "assinatura_prop": r[4] == 'OK',
        "assinatura_imo": r[5] == 'OK',
        "assinatura_testemunha1": r[6] == 'OK',
        "assinatura_testemunha2": r[7] == 'OK',
    })
upsert("contratos", contratos)

print("\n✅ Migração concluída!")
print("Acesse o dashboard em http://localhost:5173 para verificar os dados")
