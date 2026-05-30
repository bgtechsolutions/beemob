import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Table from '../components/Table'
import Badge from '../components/Badge'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export default function Comissoes() {
  const [rows, setRows] = useState([])
  const [resumo, setResumo] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pendentes')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: lancamentos } = await supabase.from('lancamentos')
      .select('id, contrato_id, periodo_fim, valor_aluguel, contratos(percentual_taxa, captador_nome, corretor_nome, gestor_nome, proprietarios(percentual_taxa_adm))')
      .order('periodo_fim', { ascending: false })

    const comissoes = []
    const pct = { Captador: 0.20, Corretor: 0.40, Gestor: 0.10, 'Imobiliária': 0.30 }

    for (const l of lancamentos || []) {
      const c = l.contratos
      if (!c) continue
      const base = l.valor_aluguel
      const taxa = c.proprietarios?.percentual_taxa_adm || c.percentual_taxa || 0.10
      const totalComissao = base * taxa

      const funcs = [
        { funcao: 'Captador', nome: c.captador_nome },
        { funcao: 'Corretor', nome: c.corretor_nome },
        { funcao: 'Gestor', nome: c.gestor_nome },
        { funcao: 'Imobiliária', nome: 'BEEMOB' },
      ]
      for (const { funcao, nome } of funcs) {
        if (!nome) continue
        comissoes.push({
          id: `${l.id}_${funcao}`,
          lancamento_id: l.id,
          contrato_id: l.contrato_id,
          periodo: l.periodo_fim,
          corretor_nome: nome,
          funcao,
          valor: totalComissao * (pct[funcao] || 0),
          pago: false,
        })
      }
    }

    setRows(comissoes)

    // Resumo por corretor
    const byCorretor = {}
    for (const com of comissoes) {
      if (!byCorretor[com.corretor_nome]) byCorretor[com.corretor_nome] = { nome: com.corretor_nome, total: 0, pago: 0, pendente: 0 }
      byCorretor[com.corretor_nome].total += com.valor
      if (com.pago) byCorretor[com.corretor_nome].pago += com.valor
      else byCorretor[com.corretor_nome].pendente += com.valor
    }
    setResumo(Object.values(byCorretor).sort((a, b) => b.total - a.total))
    setLoading(false)
  }

  const colsComissoes = [
    { key: 'contrato_id', label: 'Contrato' },
    { key: 'periodo', label: 'Período', render: (v) => v ? format(new Date(v), 'MM/yyyy') : '—' },
    { key: 'corretor_nome', label: 'Corretor / Responsável' },
    { key: 'funcao', label: 'Função', render: (v) => <Badge variant={v === 'Imobiliária' ? 'blue' : v === 'Captador' ? 'green' : v === 'Corretor' ? 'orange' : 'purple'}>{v}</Badge> },
    { key: 'valor', label: 'Comissão', render: (v) => fmt(v) },
    { key: 'pago', label: 'Status', render: (v) => <Badge variant={v ? 'green' : 'yellow'}>{v ? 'Pago' : 'Pendente'}</Badge> },
  ]

  const colsResumo = [
    { key: 'nome', label: 'Corretor / Responsável' },
    { key: 'total', label: 'Total', render: (v) => fmt(v) },
    { key: 'pago', label: 'Pago', render: (v) => <span className="text-green-600 font-medium">{fmt(v)}</span> },
    { key: 'pendente', label: 'Pendente', render: (v) => <span className="text-orange-600 font-medium">{fmt(v)}</span> },
  ]

  const pendentes = rows.filter(r => !r.pago)

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Comissões</h1>
        <p className="text-sm text-slate-500">{pendentes.length} comissões pendentes de pagamento</p>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {resumo.slice(0, 4).map(r => (
          <div key={r.nome} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 truncate">{r.nome}</p>
            <p className="text-lg font-bold text-slate-800">{fmt(r.total)}</p>
            <p className="text-xs text-orange-600 mt-0.5">{fmt(r.pendente)} pendente</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-slate-200 pb-2">
        {[['pendentes','Pendentes'],['todas','Todas'],['resumo','Resumo por Corretor']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${tab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'pendentes' && <Table columns={colsComissoes} data={pendentes} emptyMessage="Nenhuma comissão pendente 🎉" />}
      {tab === 'todas' && <Table columns={colsComissoes} data={rows} />}
      {tab === 'resumo' && <Table columns={colsResumo} data={resumo} />}
    </div>
  )
}
