import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import CurrencyInput from '../components/CurrencyInput'
import { toast } from '../components/Toast'
import { validarDatas } from '../lib/validators'
import { fmt } from '../lib/format'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'

const statusVariant = { ativo: 'green', encerrado: 'gray', suspenso: 'yellow' }

const empty = {
  id: '', proprietario_id: '', inquilino_id: '', localizacao: '',
  data_inicio: '', data_fim: '', data_primeiro_aluguel: '',
  valor_primeiro_aluguel: '', valor_recorrente: '', percentual_taxa: '0.10',
  captador_nome: '', corretor_nome: '', gestor_nome: '',
  assinatura_prop: false, assinatura_imo: false,
  assinatura_testemunha1: false, assinatura_testemunha2: false,
  status: 'ativo', observacoes: '',
}

export default function Contratos() {
  const [rows, setRows] = useState([])
  const [props, setProps] = useState([])
  const [inqs, setInqs] = useState([])
  const [corretores, setCorretores] = useState([])
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: c }, { data: p }, { data: i }, { data: cor }] = await Promise.all([
      supabase.from('contratos').select('*, proprietarios(nome), inquilinos(nome)').order('created_at', { ascending: false }),
      supabase.from('proprietarios').select('id, nome').order('nome'),
      supabase.from('inquilinos').select('id, nome').order('nome'),
      supabase.from('corretores').select('id, nome, tipo').order('nome'),
    ])
    setRows(c || [])
    setProps(p || [])
    setInqs(i || [])
    setCorretores(cor || [])
    setLoading(false)
  }

  function openNew() { setForm(empty); setModal(true) }
  function openEdit(row) {
    setForm({
      ...row,
      data_inicio: row.data_inicio?.slice(0, 10) || '',
      data_fim: row.data_fim?.slice(0, 10) || '',
      data_primeiro_aluguel: row.data_primeiro_aluguel?.slice(0, 10) || '',
    })
    setModal(true)
  }

  async function save() {
    if (!form.id.trim()) return toast('Preencha o número do contrato.', 'error')
    if (!form.proprietario_id) return toast('Selecione o proprietário.', 'error')
    if (!form.inquilino_id) return toast('Selecione o inquilino.', 'error')
    if (!validarDatas(form.data_inicio, form.data_fim)) return toast('Data fim deve ser posterior à data início.', 'error')
    setSaving(true)
    const { _editing, proprietarios: _p, inquilinos: _i, ...rest } = form
    const data = {
      ...rest,
      valor_primeiro_aluguel: parseFloat(rest.valor_primeiro_aluguel) || 0,
      valor_recorrente: parseFloat(rest.valor_recorrente) || 0,
      percentual_taxa: parseFloat(rest.percentual_taxa) || 0.10,
    }
    try {
      const { error } = _editing
        ? await supabase.from('contratos').update(data).eq('id', data.id)
        : await supabase.from('contratos').insert(data)
      if (error) throw error
      toast(form._editing ? 'Contrato atualizado!' : 'Contrato criado!', 'success')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!confirm('Excluir este contrato?')) return
    await supabase.from('contratos').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter(r =>
    r.id?.toLowerCase().includes(q.toLowerCase()) ||
    r.proprietarios?.nome?.toLowerCase().includes(q.toLowerCase()) ||
    r.inquilinos?.nome?.toLowerCase().includes(q.toLowerCase()) ||
    r.localizacao?.toLowerCase().includes(q.toLowerCase())
  )

  const today = new Date()
  const cols = [
    { key: 'id', label: 'Contrato' },
    { key: 'proprietarios', label: 'Proprietário', render: (v) => v?.nome || '—' },
    { key: 'inquilinos', label: 'Inquilino', render: (v) => v?.nome || '—' },
    { key: 'localizacao', label: 'Endereço' },
    { key: 'valor_recorrente', label: 'Aluguel', render: (v) => fmt(v) },
    { key: 'data_fim', label: 'Vencimento', render: (v) => {
      if (!v) return '—'
      const d = differenceInDays(new Date(v), today)
      return (
        <span className={d < 60 && d > 0 ? 'text-orange-600 font-medium' : d <= 0 ? 'text-red-600' : ''}>
          {format(new Date(v), 'dd/MM/yyyy')}
        </span>
      )
    }},
    { key: 'status', label: 'Status', render: (v) => <Badge variant={statusVariant[v]}>{v}</Badge> },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit({ ...row, _editing: true })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
          <Edit2 size={14} />
        </button>
        <button onClick={() => remove(row.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contratos</h1>
          <p className="text-sm text-slate-500">{rows.length} contratos cadastrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Novo Contrato
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por contrato, proprietário, inquilino ou endereço..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Table columns={cols} data={filtered} />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={form._editing ? 'Editar Contrato' : 'Novo Contrato'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nº Contrato" required>
            <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
              disabled={form._editing}
              className="input" placeholder="2026-009" />
          </Field>

          <Field label="Status">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input">
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
              <option value="suspenso">Suspenso</option>
            </select>
          </Field>

          <Field label="Proprietário" required>
            <select value={form.proprietario_id} onChange={e => setForm(f => ({ ...f, proprietario_id: e.target.value }))} className="input">
              <option value="">Selecione...</option>
              {props.map(p => <option key={p.id} value={p.id}>{p.id} — {p.nome}</option>)}
            </select>
          </Field>

          <Field label="Inquilino" required>
            <select value={form.inquilino_id} onChange={e => setForm(f => ({ ...f, inquilino_id: e.target.value }))} className="input">
              <option value="">Selecione...</option>
              {inqs.map(i => <option key={i.id} value={i.id}>{i.id} — {i.nome}</option>)}
            </select>
          </Field>

          <Field label="Endereço do Imóvel" className="md:col-span-2">
            <input value={form.localizacao} onChange={e => setForm(f => ({ ...f, localizacao: e.target.value }))} className="input" />
          </Field>

          <Field label="Data Início">
            <input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} className="input" />
          </Field>
          <Field label="Data Fim">
            <input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} className="input" />
          </Field>
          <Field label="Data 1º Aluguel">
            <input type="date" value={form.data_primeiro_aluguel} onChange={e => setForm(f => ({ ...f, data_primeiro_aluguel: e.target.value }))} className="input" />
          </Field>
          <Field label="Valor 1º Aluguel (R$)">
            <CurrencyInput value={form.valor_primeiro_aluguel} onChange={v => setForm(f => ({ ...f, valor_primeiro_aluguel: v }))} />
          </Field>
          <Field label="Valor Recorrente (R$)">
            <CurrencyInput value={form.valor_recorrente} onChange={v => setForm(f => ({ ...f, valor_recorrente: v }))} />
          </Field>
          <Field label="% Taxa Adm">
            <div className="relative">
              <input type="number" step="0.01" min="0" max="1" value={form.percentual_taxa} onChange={e => setForm(f => ({ ...f, percentual_taxa: e.target.value }))} className="input pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
            </div>
          </Field>

          <Field label="Captador">
            <select value={form.captador_nome} onChange={e => setForm(f => ({ ...f, captador_nome: e.target.value }))} className="input">
              <option value="">Selecione...</option>
              {corretores.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Corretor">
            <select value={form.corretor_nome} onChange={e => setForm(f => ({ ...f, corretor_nome: e.target.value }))} className="input">
              <option value="">Selecione...</option>
              {corretores.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Gestor">
            <select value={form.gestor_nome} onChange={e => setForm(f => ({ ...f, gestor_nome: e.target.value }))} className="input">
              <option value="">Selecione...</option>
              {corretores
                .filter(c => c.tipo === 'gestor' || c.tipo === 'corretor_gestor')
                .map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>

          <Field label="Observações" className="md:col-span-2">
            <textarea value={form.observacoes || ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={2} className="input resize-none" />
          </Field>

          <div className="md:col-span-2 flex flex-wrap gap-4 text-sm text-slate-600">
            {['prop','imo','testemunha1','testemunha2'].map(k => (
              <label key={k} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[`assinatura_${k}`] || false}
                  onChange={e => setForm(f => ({ ...f, [`assinatura_${k}`]: e.target.checked }))} />
                Assinatura {k === 'prop' ? 'Proprietário' : k === 'imo' ? 'Imobiliária' : `Testemunha ${k.slice(-1)}`}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children, className = '', required }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
