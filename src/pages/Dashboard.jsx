import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import { fmt, fmtDate } from '../lib/format'
import {
  DollarSign, FileText, AlertCircle, TrendingUp, Building2, Clock,
  AlertTriangle, CheckCircle, Landmark, Home, Award, Info,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { format, isAfter, addDays, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const CORES_OCUPACAO = { alugado: '#16a34a', disponivel: '#f59e0b', vago: '#dc2626' }
const ROTULO_OCUPACAO = { alugado: 'Alugado', disponivel: 'Disponível', vago: 'Vago' }

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      await supabase.rpc('atualizar_status_atrasado').catch(() => {})

      const [imoveis, contratos, lancamentos, comissoes, caucoes] = await Promise.all([
        supabase.from('imoveis')
          .select('id, status, valor_aluguel, valor_condominio, valor_iptu, percentual_taxa_adm, corretor_nome'),
        supabase.from('contratos')
          .select('id, status, data_fim, imovel_id, inquilinos(nome), proprietarios(nome)'),
        supabase.from('lancamentos')
          .select('id, contrato_id, periodo_inicio, periodo_fim, status_pagamento, '
            + 'valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, '
            + 'taxa_adm_imobiliaria, honorarios_primeiro_aluguel, '
            + 'valor_repasse_proprietario, subtotal_inquilino, ajuste_motivo, '
            + 'contratos(inquilinos(nome))')
          .order('periodo_inicio', { ascending: false }),
        supabase.from('comissoes')
          .select('id, valor, funcao, tipo, corretor_nome, pago, competencia'),
        supabase.from('caucoes')
          .select('id, valor_total, devolvido, inquilino_nome'),
      ])

      const falhou = [imoveis, contratos, lancamentos, comissoes, caucoes].find(r => r.error)
      if (falhou) throw falhou.error

      setDados(calcular({
        imoveis: imoveis.data || [],
        contratos: contratos.data || [],
        lancamentos: lancamentos.data || [],
        comissoes: comissoes.data || [],
        caucoes: caucoes.data || [],
      }))
    } catch (e) {
      setErro(e.message || 'Falha ao carregar os dados')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erro) return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
      <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-red-800">Não foi possível carregar o dashboard</p>
        <p className="text-xs text-red-600 mt-1">{erro}</p>
        <button onClick={carregar}
          className="mt-3 text-xs font-medium text-red-700 underline hover:no-underline">
          Tentar novamente
        </button>
      </div>
    </div>
  )

  const d = dados

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visão geral da carteira · {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <Alertas alertas={d.alertas} />

      {/* ---- Receita da imobiliária ------------------------------------ */}
      <section>
        <CabecalhoSecao
          titulo="Receita da imobiliária"
          ajuda="Só o que fica com a Beemob: taxa de administração e honorários do 1º aluguel.
                 Condomínio e IPTU passam pelo caixa mas pertencem a terceiros."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Receita registrada" value={fmt(d.receitaRealizada)}
            icon={DollarSign} color="green"
            sub={`${d.lancamentosCount} lançamento${d.lancamentosCount !== 1 ? 's' : ''}`} />
          <StatCard title="Receita potencial/mês" value={fmt(d.receitaPotencialMes)}
            icon={TrendingUp} color="blue" sub="taxa de adm. da carteira ativa" />
          <StatCard title="Comissões a pagar" value={fmt(d.comissaoAPagar)}
            icon={Award} color="orange"
            sub={`${d.comissoesPendentes} lançamento${d.comissoesPendentes !== 1 ? 's' : ''}`} />
          <StatCard title="Resultado" value={fmt(d.receitaRealizada - d.comissaoAPagar)}
            icon={TrendingUp} color={d.receitaRealizada - d.comissaoAPagar >= 0 ? 'green' : 'red'}
            sub="receita menos comissões" />
        </div>
      </section>

      {/* ---- Dinheiro de terceiros ------------------------------------- */}
      <section>
        <CabecalhoSecao
          titulo="Dinheiro de terceiros"
          ajuda="Valores sob responsabilidade da imobiliária que não são receita.
                 Precisam ser repassados ou devolvidos."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Caução em custódia" value={fmt(d.caucaoCustodia)}
            icon={Landmark} color="purple"
            sub={`${d.caucoesAtivas} contrato${d.caucoesAtivas !== 1 ? 's' : ''} em conta aplicação`} />
          <StatCard title="A repassar" value={fmt(d.aRepassar)}
            icon={Building2} color="purple" sub="proprietários, lançamentos pendentes" />
          <StatCard title="Condomínio + IPTU" value={fmt(d.condominioIptu)}
            icon={FileText} color="blue" sub="arrecadado para terceiros" />
          <StatCard title="Inadimplência" value={fmt(d.valorAtrasado)}
            icon={AlertCircle} color={d.atrasados > 0 ? 'red' : 'green'}
            sub={`${d.atrasados} lançamento${d.atrasados !== 1 ? 's' : ''} em atraso`} />
        </div>
      </section>

      {/* ---- Carteira --------------------------------------------------- */}
      <section>
        <CabecalhoSecao
          titulo="Carteira de imóveis"
          ajuda="Imóveis disponíveis e vagos não geram receita — é onde há dinheiro parado."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Imóveis alugados" value={d.ocupacao.alugado || 0}
            icon={Home} color="green"
            sub={`${d.taxaOcupacao}% de ocupação`} />
          <StatCard title="Sem receita" value={d.imoveisSemReceita}
            icon={AlertTriangle} color={d.imoveisSemReceita > 0 ? 'orange' : 'green'}
            sub="disponíveis ou vagos" />
          <StatCard title="Aluguel da carteira" value={fmt(d.aluguelCarteira)}
            icon={DollarSign} color="blue" sub="soma mensal dos ativos" />
          <StatCard title="Vcto em 30 dias" value={d.vencendoEm30}
            icon={Clock} color={d.vencendoEm30 > 0 ? 'orange' : 'blue'} sub="contratos" />
        </div>
      </section>

      {/* ---- Gráficos --------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Painel titulo="Para onde vai o dinheiro do inquilino"
          vazio={d.composicao.every(c => c.valor === 0)}
          mensagemVazio="Nenhum lançamento financeiro registrado ainda">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.composicao} layout="vertical"
              margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {d.composicao.map((c, i) => <Cell key={i} fill={c.cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 mt-2">
            Só a última faixa é receita da Beemob. O resto é repasse.
          </p>
        </Painel>

        <Painel titulo="Ocupação da carteira" vazio={d.pizzaOcupacao.length === 0}
          mensagemVazio="Nenhum imóvel cadastrado">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={d.pizzaOcupacao} dataKey="valor" nameKey="nome"
                cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {d.pizzaOcupacao.map((p, i) => <Cell key={i} fill={p.cor} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} imóveis`, n]} />
              <Legend verticalAlign="bottom" iconType="circle"
                formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Painel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Painel titulo="Comissões a pagar por pessoa"
          vazio={d.comissaoPorPessoa.length === 0}
          mensagemVazio="Nenhuma comissão pendente">
          <ResponsiveContainer width="100%" height={Math.max(180, d.comissaoPorPessoa.length * 34)}>
            <BarChart data={d.comissaoPorPessoa} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="valor" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Painel>

        <UltimosLancamentos lista={d.recentes} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

function calcular({ imoveis, contratos, lancamentos, comissoes, caucoes }) {
  const hoje = new Date()

  const ativos = contratos.filter(c => c.status === 'ativo')
  const vencendo = contratos.filter(c => {
    if (!c.data_fim || c.status !== 'ativo') return false
    const fim = new Date(c.data_fim)
    return isAfter(fim, hoje) && !isAfter(fim, addDays(hoje, 30))
  })

  const soma = (lista, campo) => lista.reduce((s, x) => s + (Number(x[campo]) || 0), 0)

  const pendentes = lancamentos.filter(l => l.status_pagamento === 'pendente')
  const atrasados = lancamentos.filter(l => l.status_pagamento === 'atrasado')

  // Receita = só o que fica com a imobiliária
  const receitaRealizada =
    soma(lancamentos, 'taxa_adm_imobiliaria') +
    soma(lancamentos, 'honorarios_primeiro_aluguel')

  const alugados = imoveis.filter(i => i.status === 'alugado')
  const receitaPotencialMes = alugados.reduce(
    (s, i) => s + (Number(i.valor_aluguel) || 0) * (Number(i.percentual_taxa_adm) || 0), 0)

  const comissoesPendentes = comissoes.filter(c => !c.pago)
  const comissaoAPagar = soma(comissoesPendentes, 'valor')

  const caucoesAtivas = caucoes.filter(c => !c.devolvido)

  const ocupacao = imoveis.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1
    return acc
  }, {})
  const imoveisSemReceita = (ocupacao.disponivel || 0) + (ocupacao.vago || 0)
  const taxaOcupacao = imoveis.length
    ? Math.round(((ocupacao.alugado || 0) / imoveis.length) * 100) : 0

  // Composição do que o inquilino paga
  const composicao = [
    { nome: 'Repasse proprietário', valor: soma(lancamentos, 'valor_repasse_proprietario'), cor: '#8b5cf6' },
    { nome: 'Condomínio', valor: soma(lancamentos, 'valor_condominio'), cor: '#3b82f6' },
    { nome: 'IPTU', valor: soma(lancamentos, 'valor_iptu'), cor: '#0ea5e9' },
    { nome: 'Seguro fiança', valor: soma(lancamentos, 'seguro_fianca'), cor: '#14b8a6' },
    { nome: 'Taxa adm (Beemob)', valor: receitaRealizada, cor: '#16a34a' },
  ].filter(c => c.valor > 0)

  const porPessoa = {}
  comissoesPendentes.forEach(c => {
    const nome = c.corretor_nome || c.funcao || '—'
    porPessoa[nome] = (porPessoa[nome] || 0) + (Number(c.valor) || 0)
  })
  const comissaoPorPessoa = Object.entries(porPessoa)
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  // ---- Alertas ----
  const alertas = []

  atrasados.forEach(l => {
    const dias = differenceInDays(hoje, new Date(l.periodo_fim))
    alertas.push({
      tipo: 'error',
      titulo: `Aluguel atrasado — ${l.contratos?.inquilinos?.nome || l.contrato_id}`,
      detalhe: `${dias} dia${dias !== 1 ? 's' : ''} em atraso · ${fmt(l.subtotal_inquilino)}`,
    })
  })

  vencendo.forEach(c => {
    const dias = differenceInDays(new Date(c.data_fim), hoje)
    alertas.push({
      tipo: 'warning',
      titulo: `Contrato vencendo — ${c.inquilinos?.nome || c.id}`,
      detalhe: `Vence em ${dias} dia${dias !== 1 ? 's' : ''} (${fmtDate(c.data_fim)})`,
    })
  })

  // Lançamentos importados com divergência registrada na planilha de origem
  lancamentos.filter(l => l.ajuste_motivo).forEach(l => {
    alertas.push({
      tipo: 'warning',
      titulo: `Lançamento com ajuste manual — ${l.contratos?.inquilinos?.nome || l.contrato_id}`,
      detalhe: l.ajuste_motivo,
    })
  })

  // Contratos ativos sem nenhum lançamento: o financeiro não está sendo registrado
  const comLancamento = new Set(lancamentos.map(l => l.contrato_id))
  const semLancamento = ativos.filter(c => !comLancamento.has(c.id))
  if (semLancamento.length) {
    alertas.push({
      tipo: 'warning',
      titulo: `${semLancamento.length} contrato${semLancamento.length !== 1 ? 's' : ''} ativo${semLancamento.length !== 1 ? 's' : ''} sem lançamento financeiro`,
      detalhe: 'Importados das planilhas de cadastro, mas sem demonstrativo mensal registrado',
    })
  }

  return {
    alertas,
    receitaRealizada,
    receitaPotencialMes,
    comissaoAPagar,
    comissoesPendentes: comissoesPendentes.length,
    caucaoCustodia: soma(caucoesAtivas, 'valor_total'),
    caucoesAtivas: caucoesAtivas.length,
    aRepassar: soma(pendentes, 'valor_repasse_proprietario'),
    condominioIptu: soma(lancamentos, 'valor_condominio') + soma(lancamentos, 'valor_iptu'),
    atrasados: atrasados.length,
    valorAtrasado: soma(atrasados, 'subtotal_inquilino'),
    ocupacao,
    imoveisSemReceita,
    taxaOcupacao,
    aluguelCarteira: soma(alugados, 'valor_aluguel'),
    vencendoEm30: vencendo.length,
    lancamentosCount: lancamentos.length,
    composicao,
    comissaoPorPessoa,
    pizzaOcupacao: Object.entries(ocupacao).map(([status, valor]) => ({
      nome: ROTULO_OCUPACAO[status] || status,
      valor,
      cor: CORES_OCUPACAO[status] || '#94a3b8',
    })),
    recentes: lancamentos.slice(0, 8),
  }
}

/* ------------------------------------------------------------------ */
/* Componentes auxiliares                                              */
/* ------------------------------------------------------------------ */

function CabecalhoSecao({ titulo, ajuda }) {
  return (
    <div className="flex items-start gap-2 mb-3">
      <h2 className="text-sm font-semibold text-slate-700">{titulo}</h2>
      {ajuda && (
        <span className="group relative flex items-center">
          <Info size={13} className="text-slate-400 cursor-help" />
          <span className="absolute left-5 top-0 z-10 hidden group-hover:block w-72
                           bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
            {ajuda}
          </span>
        </span>
      )}
    </div>
  )
}

function Painel({ titulo, children, vazio, mensagemVazio }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{titulo}</h3>
      {vazio
        ? <p className="text-sm text-slate-400 text-center py-12">{mensagemVazio}</p>
        : children}
    </div>
  )
}

function Alertas({ alertas }) {
  if (!alertas.length) return (
    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
      <CheckCircle size={16} className="text-green-500" />
      <p className="text-sm text-green-700 font-medium">Tudo em dia — nenhum alerta pendente</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} pendente{alertas.length !== 1 ? 's' : ''}
      </p>
      {alertas.slice(0, 5).map((a, i) => (
        <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${
          a.tipo === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
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
  )
}

const CORES_STATUS = {
  pago: 'text-green-600 bg-green-50',
  pendente: 'text-yellow-600 bg-yellow-50',
  atrasado: 'text-red-600 bg-red-50',
}

function UltimosLancamentos({ lista }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">Últimos lançamentos</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {lista.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">Nenhum lançamento ainda</p>
        ) : lista.map(l => (
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
              <p className="text-sm font-semibold text-slate-800">{fmt(l.subtotal_inquilino)}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                CORES_STATUS[l.status_pagamento] || 'text-slate-500 bg-slate-50'}`}>
                {l.status_pagamento}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
