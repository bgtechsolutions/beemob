import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Table from '../components/Table'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'

const empty = { id: '', nome: '', creci: '', rg: '', cpf: '', endereco: '', telefone: '', tipo: 'corretor' }

const tipoLabel = {
  corretor: 'Corretor',
  gestor: 'Gestor',
  corretor_gestor: 'Corretor e Gestor',
}

const tipoBadge = {
  corretor: 'bg-blue-50 text-blue-700',
  gestor: 'bg-purple-50 text-purple-700',
  corretor_gestor: 'bg-emerald-50 text-emerald-700',
}

export default function Corretores() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('corretores').select('*').order('nome')
    setRows(data || [])
    setLoading(false)
  }

  function openNew() { setForm(empty); setModal(true) }
  function openEdit(row) { setForm({ ...row }); setModal(true) }

  async function save() {
    if (!form.id.trim()) return toast('Preencha o ID do corretor.', 'error')
    if (!form.nome.trim()) return toast('Nome é obrigatório.', 'error')
    setSaving(true)
    try {
      const { error } = form._editing
        ? await supabase.from('corretores').update({ ...form }).eq('id', form.id)
        : await supabase.from('corretores').insert({ ...form })
      if (error) throw error
      toast(form._editing ? 'Corretor atualizado!' : 'Corretor cadastrado!', 'success')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!confirm('Excluir este corretor?')) return
    await supabase.from('corretores').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter(r =>
    r.nome?.toLowerCase().includes(q.toLowerCase()) ||
    r.id?.toLowerCase().includes(q.toLowerCase())
  )

  const cols = [
    { key: 'id', label: 'ID' },
    { key: 'nome', label: 'Nome' },
    { key: 'tipo', label: 'Tipo', render: (v) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tipoBadge[v] || tipoBadge.corretor}`}>
        {tipoLabel[v] || 'Corretor'}
      </span>
    )},
    { key: 'creci', label: 'CRECI' },
    { key: 'cpf', label: 'CPF' },
    { key: 'telefone', label: 'Telefone' },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit({ ...row, _editing: true })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Edit2 size={14} /></button>
        <button onClick={() => remove(row.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Corretores</h1>
          <p className="text-sm text-slate-500">{rows.length} corretores cadastrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Novo Corretor
        </button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou ID..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        : <Table columns={cols} data={filtered} onRowClick={(r) => openEdit({ ...r, _editing: true })} />}

      <Modal open={modal} onClose={() => setModal(false)} title={form._editing ? 'Editar Corretor' : 'Novo Corretor'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <F label="ID" required><input {...f('id')} disabled={form._editing} className="input" placeholder="B-0015" /></F>
          <F label="Nome completo" required><input {...f('nome')} className="input" /></F>

          <F label="Tipo" required>
            <select {...f('tipo')} className="input">
              <option value="corretor">Corretor</option>
              <option value="gestor">Gestor</option>
              <option value="corretor_gestor">Corretor e Gestor</option>
            </select>
          </F>

          {/* Aviso visual quando é gestor */}
          {(form.tipo === 'gestor' || form.tipo === 'corretor_gestor') && (
            <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 md:col-span-1">
              <span className="mt-0.5">👤</span>
              <span>Este profissional aparecerá como opção de <strong>Gestor</strong> nos contratos e imóveis.</span>
            </div>
          )}

          <F label="CRECI"><input {...f('creci')} className="input" /></F>
          <F label="CPF"><input {...f('cpf')} className="input" /></F>
          <F label="RG"><input {...f('rg')} className="input" /></F>
          <F label="Telefone"><input {...f('telefone')} className="input" /></F>
          <F label="Endereço" className="md:col-span-2"><input {...f('endereco')} className="input" /></F>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function F({ label, children, className = '', required }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}
