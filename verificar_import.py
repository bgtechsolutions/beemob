"""
BEEMOB - Verificacao pos-importacao.

Le de volta do Supabase e confere contra os numeros das planilhas.
Somente leitura: nao grava nada.

    $env:SUPABASE_SERVICE_KEY = "..."
    python verificar_import.py
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# Valores conferidos contra a planilha durante a analise
CAUCAO_TOTAL = 66925.45
COMISSAO_RECORRENTE = 2954.92


def brl(v):
    return f"{v:,.2f}".replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def conectar():
    url = None
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"VITE_SUPABASE_URL=(.*)", line.strip())
            if m:
                url = m.group(1).strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        sys.exit('✗ SUPABASE_SERVICE_KEY nao definida.\n'
                 '  $env:SUPABASE_SERVICE_KEY = "..."')
    return url, key


def buscar(url, key, tabela, select="*", extra=""):
    endpoint = f"{url}/rest/v1/{tabela}?select={select}{extra}"
    req = urllib.request.Request(endpoint, headers={
        "apikey": key, "Authorization": f"Bearer {key}",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def ids_esperados():
    """Reaproveita os parsers do importador para saber o que deveria existir."""
    sys.argv = [sys.argv[0]]
    import openpyxl
    import import_planilhas as ip

    wb = openpyxl.load_workbook(ip.XLSX_COMISSAO, data_only=True)
    props, inqs, imoveis, contratos = ip.ler_cadastros(wb)
    props_d, imoveis_d = ip.ler_imoveis_disponiveis(wb)
    wb.close()

    # Espelha exatamente a regra de conflito do importador: so descarta o
    # registro do bloco 'para alugar' quando o MESMO codigo aparece nos dois
    # blocos com NOMES DIFERENTES. O imovel do bloco principal permanece.
    por_id = {p["id"]: p["nome"] for p in props}
    ids_conflito = {p["id"] for p in props_d
                    if p["id"] in por_id and por_id[p["id"]] != p["nome"]}
    props_d = [p for p in props_d if p["id"] not in ids_conflito]
    imoveis_d = [i for i in imoveis_d if i["proprietario_id"] not in ids_conflito]

    wb2 = openpyxl.load_workbook(ip.XLSX_COMISSAO, data_only=True)
    corretores = {c["id"] for c in ip.ler_corretores(wb2)}
    wb2.close()

    ids = {
        "corretores": corretores,
        "proprietarios": {p["id"] for p in props + props_d},
        "imoveis": {i["id"] for i in imoveis + imoveis_d},
        "inquilinos": {i["id"] for i in inqs},
        "contratos": {c["id"] for c in contratos},
    }

    for path in sorted(ip.DOWNLOADS.glob(ip.XLSM_GLOB)):
        d = ip.ler_xlsm(path)
        if not d:
            continue
        ids["proprietarios"].add(d["proprietario"]["id"])
        ids["imoveis"] |= {i["id"] for i in d["imoveis"]}
        ids["inquilinos"] |= {i["id"] for i in d["inquilinos"]}
        ids["contratos"] |= {c["id"] for c in d["contratos"]}

    return ids


def main():
    url, key = conectar()
    print("=" * 62)
    print("BEEMOB - verificacao pos-importacao")
    print("=" * 62)

    falhas = 0

    # Monta o conjunto de IDs que as planilhas deveriam ter produzido,
    # reaproveitando os mesmos parsers do importador. Comparar conjuntos
    # em vez de contagens mostra exatamente QUAIS registros sobram ou faltam.
    esperados = ids_esperados()

    print("\nCOBERTURA (IDs das planilhas vs. banco)")
    for tabela, ids_esp in esperados.items():
        try:
            no_banco = {r["id"] for r in buscar(url, key, tabela, "id")}
        except urllib.error.HTTPError as e:
            print(f"  ✗ {tabela:16} erro HTTP {e.code}")
            falhas += 1
            continue

        faltando = ids_esp - no_banco
        extras = no_banco - ids_esp
        marca = "✓" if not faltando else "⚠"
        if faltando:
            falhas += 1
        print(f"  {marca} {tabela:16} {len(no_banco):>3} no banco · "
              f"{len(ids_esp):>3} das planilhas"
              + (f" · FALTAM {len(faltando)}" if faltando else "")
              + (f" · {len(extras)} alheios ao import" if extras else ""))
        if faltando:
            print(f"      faltando: {sorted(faltando)[:8]}")
        if extras:
            print(f"      pre-existentes no banco: {sorted(extras)[:8]}")

    print("\nVALORES")
    caucoes = buscar(url, key, "caucoes", "valor_total")
    total = sum(c["valor_total"] or 0 for c in caucoes)
    marca = "✓" if abs(total - CAUCAO_TOTAL) < 0.01 else "⚠"
    if marca == "⚠":
        falhas += 1
    print(f"  {marca} caucao sob custodia    R$ {brl(total)}  "
          f"(planilha R$ {brl(CAUCAO_TOTAL)})")

    com = buscar(url, key, "comissoes", "valor,tipo,funcao")
    rec = sum(c["valor"] or 0 for c in com if c["tipo"] == "recorrente")
    marca = "✓" if abs(rec - COMISSAO_RECORRENTE) < 0.5 else "⚠"
    if marca == "⚠":
        falhas += 1
    print(f"  {marca} comissao recorrente    R$ {brl(rec)}  "
          f"(planilha R$ {brl(COMISSAO_RECORRENTE)})")

    print("\nINTEGRIDADE")
    imoveis = buscar(url, key, "imoveis", "id,status,valor_aluguel")
    por_status = {}
    for i in imoveis:
        por_status[i["status"]] = por_status.get(i["status"], 0) + 1
    print(f"  · imoveis por status: {por_status}")

    carteira = sum(i["valor_aluguel"] or 0 for i in imoveis
                   if i["status"] == "alugado")
    print(f"  · aluguel mensal da carteira ativa: R$ {brl(carteira)}")

    corr = buscar(url, key, "corretores", "status")
    print(f"  · corretores por status: "
          f"{ {s: sum(1 for c in corr if c['status'] == s) for s in {c['status'] for c in corr}} }")

    lanc = buscar(url, key, "lancamentos", "ajuste_manual,ajuste_motivo")
    com_ajuste = [l for l in lanc if l["ajuste_motivo"]]
    print(f"  · lancamentos com ajuste/alerta registrado: {len(com_ajuste)} de {len(lanc)}")

    regras = buscar(url, key, "comissionamento", "funcao,percentual_primeiro,percentual_recorrente")
    sp = sum(r["percentual_primeiro"] for r in regras)
    sr = sum(r["percentual_recorrente"] for r in regras)
    marca = "✓" if abs(sp - 1) < 0.001 and abs(sr - 1) < 0.001 else "⚠"
    if marca == "⚠":
        falhas += 1
    print(f"  {marca} rateio soma {sp:.2f} / {sr:.2f} (deve ser 1.00 / 1.00)")

    for t in ("lancamentos", "comissoes", "caucoes", "condominio_itens"):
        print(f"  · {t:16} {len(buscar(url, key, t, 'id')):>3} no banco")

    print("\n" + "=" * 62)
    if falhas:
        print(f"{falhas} verificacao(oes) fora do esperado - revisar acima.")
    else:
        print("Todos os registros das planilhas estao no banco.")
        print("'alheios ao import' sao registros que ja existiam antes -")
        print("nao sao erro, mas vale saber de onde vieram.")
    print("=" * 62)


if __name__ == "__main__":
    main()
