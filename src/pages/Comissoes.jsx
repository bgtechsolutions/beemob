import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Table from '../components/Table'
import Badge from '../components/Badge'
import { toast } from '../components/Toast'
import { fmt } from '../lib/format'
import { CheckCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

const PCT = { Captador: 0.20, Corretor: 0.40, Gestor: 0.10, 'Imobiliária': 0.30 }

export default function Comissoes() {
  const [rows, setRows] = useState([])
  const [resumo, setResumo] = useState([])
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [tab, setTab] = useState('pendentes')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('comissoes')
      .select('*')
      .order('periodo', { ascending: false })

    if (error) { toast('Erro ao carregar comissões', 'error'); setLoading(false); return }

    setRows(data || [])
    calcResumo(data || [])
    setLoading(false)
  }

  function calcResumo(data) {
    const by = {}
    for (const c of data) {
      if (!by[c.corretor_nome]) by[c.corretor_nome] = { nome: c.corretor_nome, total: 0, pago: 0, pendente: 0 }
      by[c.corretor_nome].total += c.valor
      if (c.pago) by[c.corretor_nome].pago += c.valor
      else by[c.corretor_nome].pendente += c.valor
    }
    setResumo(Object.values(by).sort((a, b) => b.total - a.total))
  }

  async function sincronizar() {
    setSincronizando(true)
    try {
      // Busca lançamentos que ainda não têm comissão gerada
      const { data: lancamentos } = await supabase
        .from('lancamentos')
        .select('id, contrato_id, periodo_fim, valor_aluguel, contratos(percentual_taxa, captador_nome, corretor_nome, gestor_nome, proprietarios(percentual_taxa_adm))')

      const { data: existentes } = await supabase
        .from('comissoes')
        .select('lancamento_id, funcao')

      const existSet = new Set((existentes || []).map(e => `${e.lancamento_id}_${e.funcao}`))

      const novas = []
      for (const l of lancamentos || []) {
        const c = l.contratos
        if (!c) continue
        const base = l.valor_aluguel || 0
        const taxa = c.proprietarios?.percentual_taxa_adm ?? c.percentual_taxa ?? 0.10
        const totalComissao = base * taxa

        const papeis = [
          { funcao: 'Captador', nome: c.captador_nome },
          { funcao: 'Corretor', nome: c.corretor_nome },
          { funcao: 'Gestor', nome: c.gestor_nome },
          { funcao: 'Imobiliária', nome: 'BEEMOB' },
        ]

        // Calcular redistribuição para papéis ausentes
        const ausentes = papeis.filter(p => !p.nome || p.funcao === 'Imobiliária').map(p => p.funcao)
        const pctAusentes = papeis
          .filter(p => !p.nome && p.funcao !== 'Imobiliária')
          .reduce((s, p) => s + (PCT[p.funcao] || 0), 0)

        for (const { funcao, nome } of papeis) {
          if (!nome) continue
          const key = `${l.id}_${funcao}`
          if (existSet.has(key)) continue

          let pct = PCT[funcao] || 0
          if (funcao === 'Imobiliária') pct += pctAusentes

          novas.push({
            lancamento_id: l.id,
            contrato_id: l.contrato_id,
            periodo: l.periodo_fim,
            corretor_nome: nome,
            funcao,
            valor: totalComissao * pct,
            pago: false,
          })
        }
      }

      if (novas.length > 0) {
        const { error } = await supabase.from('comissoes').insert(novas)
        if (error) throw error
        toast(`${novas.length} comissões sincronizadas!`)
      } else {
        toast('Tudo já sincronizado — nenhuma nova comissão', 'warning')
      }
      load()
    } catch (e) {
      toast(e.message || 'Erro ao sincronizar', 'error')
    } finally {
      setSincronizando(false)
    }
  }

  async function marcarPago(id) {
    const { error } = await supabase
      .from('comissoes')
      .update({ pago: true, data_pagamento: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Comissão marcada como paga!')
    load()
  }

  async function marcarPendente(id) {
    const { error } = await supabase
      .from('comissoes')
      .update({ pago: false, data_pagamento: null })
      .eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Comissão revertida para pendente', 'warning')
    load()
  }

  const colsComissoes = [
    { key: 'contrato_id', label: 'Contrato' },
    { key: 'periodo', label: 'Período', render: (v) => v ? format(new Date(v), 'MM/yyyy') : '—' },
    { key: 'corretor_nome', label: 'Corretor / Responsável' },
    { key: 'funcao', label: 'Função', render: (v) => (
      <Badge variant={v === 'Imobiliária' ? 'blue' : v === 'Captador' ? 'green' : v === 'Corretor' ? 'orange' : 'purple'}>{v}</Badge>
    )},
    { key: 'valor', label: 'Comissão', render: (v) => fmt(v) },
    { key: 'data_pagamento', label: 'Pago em', render: (v) => v ? format(new Date(v), 'dd/MM/yyyy') : '—' },
    { key: 'pago', label: 'Status', render: (v) => (
      <Badge variant={v ? 'green' : 'yellow'}>{v ? 'Pago' : 'Pendente'}</Badge>
    )},
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        {!row.pago ? (
          <button onClick={() => marcarPago(row.id)} title="Marcar como pago"
            className="p-1.5 rounded hover:bg-green-50 text-green-500">
            <CheckCircle size={14} />
          </button>
        ) : (
          <button onClick={() => marcarPendente(row.id)} title="Reverter para pendente"
            className="p-1.5 rounded hover:bg-yellow-50 text-yellow-500 text-xs font-medium px-2">
            ↩
          </button>
        )}
      </div>
    )},
  ]

  const colsResumo = [
    { key: 'nome', label: 'Corretor / Responsável' },
    { key: 'total', label: 'Total', render: (v) => fmt(v) },
    { key: 'pago', label: 'Pago', render: (v) => <span className="text-green-600 font-medium">{fmt(v)}</span> },
    { key: 'pendente', label: 'Pendente', render: (v) => <span className="text-orange-600 font-medium">{fmt(v)}</span> },
  ]

  const pendentes = rows.filter(r => !r.pago)
  const pagas = rows.filter(r => r.pago)

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Comissões</h1>
          <p className="text-sm text-slate-500">
            {pendentes.length} pendentes · {pagas.length} pagas · {rows.length} total
          </p>
        </div>
        <button onClick={sincronizar} disabled={sincronizando}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
          {sincronizando ? 'Sincronizando...' : 'Sincronizar com lançamentos'}
        </button>
      </div>

      {rows.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          💡 Clique em <strong>"Sincronizar com lançamentos"</strong> para gerar as comissões a partir dos lançamentos cadastrados.
        </div>
      )}

      {/* Resumo por corretor */}
      {resumo.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {resumo.slice(0, 4).map(r => (
            <div key={r.nome} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 truncate">{r.nome}</p>
              <p className="text-lg font-bold text-slate-800">{fmt(r.total)}</p>
              <p className="text-xs text-orange-600 mt-0.5">{fmt(r.pendente)} pendente</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 pb-2">
        {[['pendentes', `Pendentes (${pendentes.length})`], ['pagas', `Pagas (${pagas.length})`], ['todas', 'Todas'], ['resumo', 'Por Corretor']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${tab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'pendentes' && <Table columns={colsComissoes} data={pendentes} emptyMessage="Nenhuma comissão pendente 🎉" />}
      {tab === 'pagas' && <Table columns={colsComissoes} data={pagas} emptyMessage="Nenhuma comissão paga ainda" />}
      {tab === 'todas' && <Table columns={colsComissoes} data={rows} />}
      {tab === 'resumo' && <Table columns={colsResumo} data={resumo} />}
    </div>
  )
}
