import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import { fmt, fmtDate } from '../lib/format'
import {
  DollarSign, FileText, AlertCircle, TrendingUp,
  Building2, Clock, AlertTriangle, CheckCircle
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { format, isAfter, addDays, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Dashboard() {
  const [stats, setStats] = useState({
    contratosAtivos: 0, totalContratos: 0,
    totalAReceber: 0, totalARepassar: 0,
    inadimplentes: 0, vencendoEm30: 0,
  })
  const [alertas, setAlertas] = useState([])
  const [chartData, setChartData] = useState([])
  const [recentLancamentos, setRecentLancamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Marcar automaticamente como atrasado antes de carregar
      await supabase.rpc('atualizar_status_atrasado').catch(() => {})

      const [{ data: contratos }, { data: lancamentos }] = await Promise.all([
        supabase.from('contratos').select('id, status, data_fim, proprietarios(nome), inquilinos(nome)'),
        supabase.from('lancamentos')
          .select('id, contrato_id, periodo_inicio, periodo_fim, valor_liquido_inquilino, valor_repasse_proprietario, status_pagamento, data_pagamento, contratos(inquilinos(nome))')
          .order('periodo_fim', { ascending: false })
          .limit(100),
      ])

      const hoje = new Date()
      const ativos = (contratos || []).filter(c => c.status === 'ativo')
      const vencendo = (contratos || []).filter(c => {
        if (!c.data_fim || c.status !== 'ativo') return false
        const fim = new Date(c.data_fim)
        return isAfter(fim, hoje) && !isAfter(fim, addDays(hoje, 30))
      })

      const pendentes = (lancamentos || []).filter(l => l.status_pagamento === 'pendente')
      const atrasados = (lancamentos || []).filter(l => l.status_pagamento === 'atrasado')

      // --- Montar alertas ---
      const novosAlertas = []

      atrasados.forEach(l => {
        const dias = differenceInDays(hoje, new Date(l.periodo_fim))
        novosAlertas.push({
          tipo: 'error',
          titulo: `Aluguel atrasado — ${l.contratos?.inquilinos?.nome || l.contrato_id}`,
          detalhe: `${dias} dia${dias !== 1 ? 's' : ''} em atraso · ${fmt(l.valor_liquido_inquilino)}`,
          id: l.id,
        })
      })

      vencendo.forEach(c => {
        const dias = differenceInDays(new Date(c.data_fim), hoje)
        novosAlertas.push({
          tipo: 'warning',
          titulo: `Contrato vencendo — ${c.inquilinos?.nome || c.id}`,
          detalhe: `Vence em ${dias} dia${dias !== 1 ? 's' : ''} (${fmtDate(c.data_fim)})`,
          id: c.id,
        })
      })

      // Proprietários sem PIX/banco
      const { data: semBanco } = await supabase
        .from('proprietarios')
        .select('id, nome')
        .is('pix', null)
        .is('banco', null)
      ;(semBanco || []).forEach(p => {
        novosAlertas.push({
          tipo: 'warning',
          titulo: `Dados bancários incompletos — ${p.nome}`,
          detalhe: 'Proprietário sem PIX ou conta cadastrada',
          id: p.id,
        })
      })

      setAlertas(novosAlertas)
      setStats({
        totalContratos: contratos?.length || 0,
        contratosAtivos: ativos.length,
        totalAReceber: pendentes.reduce((s, l) => s + (l.valor_liquido_inquilino || 0), 0),
        totalARepassar: pendentes.reduce((s, l) => s + (l.valor_repasse_proprietario || 0), 0),
        inadimplentes: atrasados.length,
        vencendoEm30: vencendo.length,
      })

      // Gráfico por mês
      const byMonth = {}
      ;(lancamentos || []).forEach(l => {
        const key = format(new Date(l.periodo_fim), 'MMM/yy', { locale: ptBR })
        if (!byMonth[key]) byMonth[key] = { mes: key, aReceber: 0, repassado: 0 }
        byMonth[key].aReceber += l.valor_liquido_inquilino || 0
        byMonth[key].repassado += l.valor_repasse_proprietario || 0
      })
      setChartData(Object.values(byMonth).slice(-6))
      setRecentLancamentos((lancamentos || []).slice(0, 8))
    } finally {
      setLoading(false)
    }
  }

  const statusColor = {
    pago: 'text-green-600 bg-green-50',
    pendente: 'text-yellow-600 bg-yellow-50',
    atrasado: 'text-red-600 bg-red-50',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral da sua carteira · {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* Alertas críticos */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} pendente{alertas.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {alertas.slice(0, 5).map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                a.tipo === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                {a.tipo === 'error'
                  ? <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  : <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.detalhe}</p>
                </div>
              </div>
            ))}
            {alertas.length > 5 && (
              <p className="text-xs text-slate-400 pl-1">+ {alertas.length - 5} alertas adicionais</p>
            )}
          </div>
        </div>
      )}

      {alertas.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle size={16} className="text-green-500" />
          <p className="text-sm text-green-700 font-medium">Tudo em dia — nenhum alerta pendente</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Contratos Ativos" value={stats.contratosAtivos} icon={FileText} color="blue" sub={`de ${stats.totalContratos} total`} />
        <StatCard title="A Receber" value={fmt(stats.totalAReceber)} icon={DollarSign} color="green" />
        <StatCard title="A Repassar" value={fmt(stats.totalARepassar)} icon={TrendingUp} color="purple" />
        <StatCard title="Inadimplentes" value={stats.inadimplentes} icon={AlertCircle} color="red" sub="lançamentos atrasados" />
        <StatCard title="Vcto em 30d" value={stats.vencendoEm30} icon={Clock} color="orange" sub="contratos" />
        <StatCard title="Total Imóveis" value={stats.contratosAtivos} icon={Building2} color="blue" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Receita x Repasse (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="aReceber" name="A Receber" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="repassado" name="Repasse" fill="#8b5cf6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Evolução mensal</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="aReceber" name="A Receber" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="repassado" name="Repasse" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Últimos lançamentos */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Últimos Lançamentos</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {recentLancamentos.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Nenhum lançamento ainda</p>
          ) : (
            recentLancamentos.map((l) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {l.contratos?.inquilinos?.nome || l.contrato_id}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fmtDate(l.periodo_inicio)} – {fmtDate(l.periodo_fim)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{fmt(l.valor_liquido_inquilino)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[l.status_pagamento]}`}>
                    {l.status_pagamento}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
