import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { toast } from '../components/Toast'
import { fmt, fmtDate } from '../lib/format'
import { Plus, Search, FileDown, CheckCircle, Package, Edit2 } from 'lucide-react'
import { differenceInDays, getDaysInMonth } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const statusVariant = { pago: 'green', pendente: 'yellow', atrasado: 'red' }

const emptyForm = {
  contrato_id: '', periodo_inicio: '', periodo_fim: '',
  e_primeiro_mes: false, despesas_manutencao: '0',
  multa: '0', juros: '0', status_pagamento: 'pendente',
  data_pagamento: '', observacoes: '',
}

let _reciboSeq = 1

export default function Financeiro() {
  const [rows, setRows] = useState([])
  const [contratos, setContratos] = useState([])
  const [q, setQ] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [calc, setCalc] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [gerandoLote, setGerandoLote] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('lancamentos')
        .select('*, contratos(id, proprietarios(nome, valor_aluguel, valor_condominio, taxas_extras_cond, valor_iptu, percentual_taxa_adm, pix, banco, agencia, conta_corrente, endereco_imovel), inquilinos(nome))')
        .order('periodo_fim', { ascending: false }),
      supabase.from('contratos')
        .select('id, valor_recorrente, valor_primeiro_aluguel, percentual_taxa, proprietarios(nome, valor_aluguel, valor_condominio, taxas_extras_cond, valor_iptu, percentual_taxa_adm, endereco_imovel), inquilinos(nome)')
        .eq('status', 'ativo').order('id'),
    ])
    setRows(l || [])
    setContratos(c || [])
    setLoading(false)
  }

  function openNew() {
    setForm(emptyForm)
    setCalc(null)
    setErrors({})
    setModal(true)
  }

  function openEdit(row) {
    setForm({
      _id: row.id,
      contrato_id: row.contrato_id,
      periodo_inicio: row.periodo_inicio?.slice(0, 10) || '',
      periodo_fim: row.periodo_fim?.slice(0, 10) || '',
      e_primeiro_mes: row.e_primeiro_mes || false,
      despesas_manutencao: String(row.despesas_manutencao || 0),
      multa: String(row.multa || 0),
      juros: String(row.juros || 0),
      status_pagamento: row.status_pagamento || 'pendente',
      data_pagamento: row.data_pagamento?.slice(0, 10) || '',
      observacoes: row.observacoes || '',
    })
    setErrors({})
    setModal(true)
  }

  function calcular(f = form) {
    const contrato = contratos.find(c => c.id === f.contrato_id)
    if (!contrato || !f.periodo_inicio || !f.periodo_fim) { setCalc(null); return }

    const prop = contrato.proprietarios
    const inicio = new Date(f.periodo_inicio)
    const fim = new Date(f.periodo_fim)

    if (fim < inicio) { setCalc(null); return }

    const diasPeriodo = differenceInDays(fim, inicio) + 1
    const diasMes = getDaysInMonth(inicio)
    const ePrimeiro = f.e_primeiro_mes

    const valorBase = ePrimeiro ? contrato.valor_primeiro_aluguel : contrato.valor_recorrente
    const aluguel = ePrimeiro ? (valorBase / diasMes) * diasPeriodo : valorBase
    const condo = ePrimeiro ? ((prop?.valor_condominio || 0) / diasMes) * diasPeriodo : (prop?.valor_condominio || 0)
    const taxasExtras = ePrimeiro ? ((prop?.taxas_extras_cond || 0) / diasMes) * diasPeriodo : (prop?.taxas_extras_cond || 0)
    const iptu = ePrimeiro ? ((prop?.valor_iptu || 0) / diasMes) * diasPeriodo : (prop?.valor_iptu || 0)
    const manutencao = Math.max(0, parseFloat(f.despesas_manutencao) || 0)
    const multa = Math.max(0, parseFloat(f.multa) || 0)
    const juros = Math.max(0, parseFloat(f.juros) || 0)

    const subtotal = aluguel + condo + taxasExtras + iptu
    const valorLiquido = subtotal - manutencao + multa + juros
    const taxaAdm = aluguel * (prop?.percentual_taxa_adm || contrato.percentual_taxa || 0.10)
    const repasseProp = aluguel - taxaAdm - manutencao

    setCalc({ diasPeriodo, aluguel, condo, taxasExtras, iptu, subtotal, manutencao, multa, juros, valorLiquido, taxaAdm, repasseProp })
  }

  useEffect(() => {
    if (modal) calcular()
  }, [form.contrato_id, form.periodo_inicio, form.periodo_fim, form.e_primeiro_mes, form.despesas_manutencao, form.multa, form.juros])

  function validate() {
    const e = {}
    if (!form.contrato_id) e.contrato_id = 'Selecione o contrato'
    if (!form.periodo_inicio) e.periodo_inicio = 'Informe o início'
    if (!form.periodo_fim) e.periodo_fim = 'Informe o fim'
    if (form.periodo_inicio && form.periodo_fim && new Date(form.periodo_fim) < new Date(form.periodo_inicio))
      e.periodo_fim = 'Fim deve ser após o início'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function save() {
    if (!validate() || !calc) return
    setSaving(true)
    const data = {
      contrato_id: form.contrato_id,
      periodo_inicio: form.periodo_inicio,
      periodo_fim: form.periodo_fim,
      e_primeiro_mes: form.e_primeiro_mes,
      dias_periodo: calc.diasPeriodo,
      valor_aluguel: calc.aluguel,
      valor_condominio: calc.condo,
      taxas_extras_cond: calc.taxasExtras,
      valor_iptu: calc.iptu,
      despesas_manutencao: calc.manutencao,
      multa: calc.multa,
      juros: calc.juros,
      subtotal_inquilino: calc.subtotal,
      valor_liquido_inquilino: calc.valorLiquido,
      taxa_adm_imobiliaria: calc.taxaAdm,
      valor_repasse_proprietario: calc.repasseProp,
      status_pagamento: form.status_pagamento,
      data_pagamento: form.data_pagamento || null,
      observacoes: form.observacoes,
    }
    const { error } = form._id
      ? await supabase.from('lancamentos').update(data).eq('id', form._id)
      : await supabase.from('lancamentos').insert(data)

    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Lançamento salvo com sucesso!')
    setModal(false)
    load()
  }

  async function marcarPago(id) {
    const { error } = await supabase.from('lancamentos').update({
      status_pagamento: 'pago',
      data_pagamento: new Date().toISOString().slice(0, 10),
    }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Marcado como pago!')
    load()
  }

  function gerarPDF(row, tipo = 'inquilino') {
    const doc = new jsPDF()
    const contrato = row.contratos
    const prop = contrato?.proprietarios
    const inq = contrato?.inquilinos
    const seq = String(_reciboSeq++).padStart(5, '0')
    const hoje = new Date().toLocaleDateString('pt-BR')

    // Cabeçalho
    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 210, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('BEEMOB IMÓVEIS', 14, 13)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Gestão de Locação', 14, 21)
    doc.text(`Nº ${seq}`, 196, 13, { align: 'right' })
    doc.text(`Emitido: ${hoje}`, 196, 21, { align: 'right' })

    doc.setTextColor(30, 41, 59)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(tipo === 'inquilino' ? 'RECIBO DE ALUGUEL' : 'DEMONSTRATIVO DO PROPRIETÁRIO', 105, 42, { align: 'center' })

    // Linha separadora
    doc.setDrawColor(226, 232, 240)
    doc.line(14, 46, 196, 46)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)

    let y = 54
    doc.text(`Contrato: ${row.contrato_id}`, 14, y)
    doc.text(`Período: ${fmtDate(row.periodo_inicio)} a ${fmtDate(row.periodo_fim)}`, 105, y)
    y += 7
    doc.text(`Imóvel: ${prop?.endereco_imovel || '—'}`, 14, y)
    y += 7

    if (tipo === 'inquilino') {
      doc.text(`Inquilino: ${inq?.nome || ''}`, 14, y)
    } else {
      doc.text(`Proprietário: ${prop?.nome || ''}`, 14, y)
      y += 7
      if (prop?.pix) doc.text(`PIX: ${prop.pix}`, 14, y)
      if (prop?.banco) {
        doc.text(`Banco: ${prop.banco}  Ag: ${prop.agencia || '—'}  CC: ${prop.conta_corrente || '—'}`, 14, y + 7)
        y += 7
      }
    }

    const startY = y + 14

    const body = tipo === 'inquilino' ? [
      ['Aluguel', fmt(row.valor_aluguel)],
      ['Condomínio', fmt(row.valor_condominio)],
      ['Taxas Extras Condomínio', fmt(row.taxas_extras_cond)],
      ['IPTU', fmt(row.valor_iptu)],
      ['(-) Manutenções/Abatimentos', fmt(-row.despesas_manutencao)],
      ['(+) Multa por Atraso (2%)', fmt(row.multa)],
      ['(+) Juros (1% a.m.)', fmt(row.juros)],
    ] : [
      ['Aluguel Bruto', fmt(row.valor_aluguel)],
      ['(-) Taxa Adm. Beemob', fmt(-row.taxa_adm_imobiliaria)],
      ['(-) Manutenções Debitadas', fmt(-row.despesas_manutencao)],
    ]

    const total = tipo === 'inquilino' ? row.valor_liquido_inquilino : row.valor_repasse_proprietario

    autoTable(doc, {
      startY,
      head: [['Descrição', 'Valor']],
      body,
      foot: [[tipo === 'inquilino' ? 'TOTAL A PAGAR' : 'VALOR A RECEBER', fmt(total)]],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 11 },
      columnStyles: { 1: { halign: 'right', cellWidth: 50 } },
      styles: { fontSize: 10 },
    })

    // Rodapé
    const pageH = doc.internal.pageSize.height
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Documento gerado por Beemob Imóveis · sistema.beemob.com.br', 105, pageH - 10, { align: 'center' })

    doc.save(`recibo_${tipo}_${row.contrato_id}_${row.periodo_fim?.slice(0,7)}_${seq}.pdf`)
  }

  async function gerarLote() {
    const mesAtual = new Date().toISOString().slice(0, 7)
    const doMes = rows.filter(r => r.periodo_fim?.startsWith(mesAtual))
    if (doMes.length === 0) { toast('Nenhum lançamento no mês atual', 'warning'); return }
    setGerandoLote(true)
    for (const r of doMes) {
      gerarPDF(r, 'inquilino')
      await new Promise(res => setTimeout(res, 300))
      gerarPDF(r, 'proprietario')
      await new Promise(res => setTimeout(res, 300))
    }
    setGerandoLote(false)
    toast(`${doMes.length} recibos gerados!`)
  }

  const filtered = rows.filter(r => {
    const txt = q.toLowerCase()
    const matchQ = !q ||
      r.contrato_id?.toLowerCase().includes(txt) ||
      r.contratos?.inquilinos?.nome?.toLowerCase().includes(txt) ||
      r.contratos?.proprietarios?.nome?.toLowerCase().includes(txt)
    const matchS = !filtroStatus || r.status_pagamento === filtroStatus
    return matchQ && matchS
  })

  const cols = [
    { key: 'contrato_id', label: 'Contrato' },
    { key: 'contratos', label: 'Inquilino', render: (v) => v?.inquilinos?.nome || '—' },
    { key: 'periodo_inicio', label: 'Período', render: (v, row) => `${fmtDate(v)} – ${fmtDate(row.periodo_fim)}` },
    { key: 'valor_liquido_inquilino', label: 'A Receber', render: (v) => fmt(v) },
    { key: 'valor_repasse_proprietario', label: 'A Repassar', render: (v) => fmt(v) },
    { key: 'taxa_adm_imobiliaria', label: 'Taxa Adm', render: (v) => fmt(v) },
    { key: 'status_pagamento', label: 'Status', render: (v) => <Badge variant={statusVariant[v]}>{v}</Badge> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit(row)} title="Editar lançamento"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Edit2 size={14} /></button>
        {row.status_pagamento !== 'pago' && (
          <button onClick={() => marcarPago(row.id)} title="Marcar pago"
            className="p-1.5 rounded hover:bg-green-50 text-green-500"><CheckCircle size={14} /></button>
        )}
        <button onClick={() => gerarPDF(row, 'inquilino')} title="Recibo Inquilino"
          className="p-1.5 rounded hover:bg-blue-50 text-blue-400"><FileDown size={14} /></button>
        <button onClick={() => gerarPDF(row, 'proprietario')} title="Repasse Proprietário"
          className="p-1.5 rounded hover:bg-purple-50 text-purple-400"><FileDown size={14} /></button>
      </div>
    )},
  ]

  const Err = ({ field }) => errors[field]
    ? <p className="text-xs text-red-500 mt-1">{errors[field]}</p>
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
          <p className="text-sm text-slate-500">
            {rows.length} lançamentos · {rows.filter(r => r.status_pagamento === 'pendente').length} pendentes · {rows.filter(r => r.status_pagamento === 'atrasado').length} atrasados
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={gerarLote} disabled={gerandoLote}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            <Package size={16} /> {gerandoLote ? 'Gerando...' : 'Gerar recibos do mês'}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> Novo Lançamento
          </button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contrato, inquilino..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="atrasado">Atrasado</option>
        </select>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        : <Table columns={cols} data={filtered} />
      }

      <Modal open={modal} onClose={() => setModal(false)} title="Novo Lançamento" size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Contrato *</label>
            <select value={form.contrato_id}
              onChange={e => setForm(f => ({ ...f, contrato_id: e.target.value }))}
              className={`input w-full ${errors.contrato_id ? 'border-red-400' : ''}`}>
              <option value="">Selecione o contrato...</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.proprietarios?.nome} / {c.inquilinos?.nome}
                </option>
              ))}
            </select>
            <Err field="contrato_id" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Início do Período *</label>
            <input type="date" value={form.periodo_inicio}
              onChange={e => setForm(f => ({ ...f, periodo_inicio: e.target.value }))}
              className={`input w-full ${errors.periodo_inicio ? 'border-red-400' : ''}`} />
            <Err field="periodo_inicio" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fim do Período *</label>
            <input type="date" value={form.periodo_fim}
              onChange={e => setForm(f => ({ ...f, periodo_fim: e.target.value }))}
              className={`input w-full ${errors.periodo_fim ? 'border-red-400' : ''}`} />
            <Err field="periodo_fim" />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 py-1">
            <input type="checkbox" id="primeiro_mes" checked={form.e_primeiro_mes}
              onChange={e => setForm(f => ({ ...f, e_primeiro_mes: e.target.checked }))}
              className="w-4 h-4 accent-blue-600" />
            <label htmlFor="primeiro_mes" className="text-sm text-slate-700 cursor-pointer">
              É o 1º mês? (calcula valores proporcionais ao período)
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Manutenções / Abatimentos (R$)</label>
            <input type="number" min="0" value={form.despesas_manutencao}
              onChange={e => setForm(f => ({ ...f, despesas_manutencao: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Multa 2% (R$)</label>
            <input type="number" min="0" value={form.multa}
              onChange={e => setForm(f => ({ ...f, multa: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Juros 1% a.m. (R$)</label>
            <input type="number" min="0" value={form.juros}
              onChange={e => setForm(f => ({ ...f, juros: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select value={form.status_pagamento}
              onChange={e => setForm(f => ({ ...f, status_pagamento: e.target.value }))} className="input w-full">
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
            <textarea value={form.observacoes || ''}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={2} className="input w-full resize-none" />
          </div>
        </div>

        {calc && (
          <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Prévia do Cálculo — {calc.diasPeriodo} dias
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {[
                ['Aluguel', calc.aluguel],
                ['Condomínio', calc.condo],
                ['IPTU', calc.iptu],
                ['Taxas', calc.taxasExtras],
                ['(-) Manut.', -calc.manutencao],
                ['(+) Multa', calc.multa],
                ['(+) Juros', calc.juros],
                ['(-) Taxa Adm', -calc.taxaAdm],
              ].map(([label, value]) => (
                <div key={label} className="bg-white rounded-lg p-2 border border-slate-100">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`font-semibold text-sm ${value < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                    {fmt(value)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">Inquilino paga</p>
                <p className="text-lg font-bold text-blue-700">{fmt(calc.valorLiquido)}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600 font-medium">Proprietário recebe</p>
                <p className="text-lg font-bold text-purple-700">{fmt(calc.repasseProp)}</p>
              </div>
            </div>
          </div>
        )}

        {!calc && form.contrato_id && form.periodo_inicio && form.periodo_fim && (
          <p className="text-sm text-red-500 mt-3">Verifique as datas — o fim deve ser após o início.</p>
        )}

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={save} disabled={saving || !calc}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Lançamento'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
