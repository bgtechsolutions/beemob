import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Table from '../components/Table'
import Modal from '../components/Modal'
import { toast } from '../components/Toast'
import { validarCPF, validarEmail } from '../lib/validators'
import { fmt } from '../lib/format'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'

const empty = {
  id: '', nome: '', cpf: '', rg: '', orgao_emissor: '', data_nasc: '',
  naturalidade: '', estado_civil: '', telefone: '', email: '',
  endereco_proprietario: '', cep_proprietario: '', cidade_uf_proprietario: '',
  endereco_imovel: '', cep_imovel: '', cidade_uf_imovel: '', inscricao_municipal: '',
  valor_aluguel: '', valor_condominio: '0', taxas_extras_cond: '0',
  valor_iptu: '0', dia_vencto_condominio: '', administradora: '', taxas_extras: '0',
  banco: '', agencia: '', conta_corrente: '', pix: '',
  percentual_taxa_adm: '0.10', honorario_adm_primeiro: '0',
  captador_nome: '', corretor_nome: '', gestor_nome: '',
}

export default function Proprietarios() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('geral')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('proprietarios').select('*').order('nome')
    setRows(data || [])
    setLoading(false)
  }

  function openNew() { setForm(empty); setTab('geral'); setModal(true) }
  function openEdit(row) {
    setForm({ ...row, data_nasc: row.data_nasc?.slice(0, 10) || '' })
    setTab('geral')
    setModal(true)
  }

  async function save() {
    if (!form.id.trim()) return toast('Preencha o ID do proprietário.', 'error')
    if (!form.nome.trim()) return toast('Nome é obrigatório.', 'error')
    if (form.cpf && !validarCPF(form.cpf)) return toast('CPF inválido.', 'error')
    if (form.email && !validarEmail(form.email)) return toast('E-mail inválido.', 'error')
    setSaving(true)
    const data = {
      ...form,
      valor_aluguel: parseFloat(form.valor_aluguel) || 0,
      valor_condominio: parseFloat(form.valor_condominio) || 0,
      taxas_extras_cond: parseFloat(form.taxas_extras_cond) || 0,
      valor_iptu: parseFloat(form.valor_iptu) || 0,
      taxas_extras: parseFloat(form.taxas_extras) || 0,
      percentual_taxa_adm: parseFloat(form.percentual_taxa_adm) || 0.10,
      honorario_adm_primeiro: parseFloat(form.honorario_adm_primeiro) || 0,
    }
    try {
      const { error } = form._editing
        ? await supabase.from('proprietarios').update(data).eq('id', form.id)
        : await supabase.from('proprietarios').insert(data)
      if (error) throw error
      toast(form._editing ? 'Proprietário atualizado!' : 'Proprietário cadastrado!', 'success')
      setModal(false)
      load()
    } catch (e) {
      toast(e.message || 'Erro ao salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!confirm('Excluir este proprietário?')) return
    await supabase.from('proprietarios').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter(r =>
    r.nome?.toLowerCase().includes(q.toLowerCase()) ||
    r.id?.toLowerCase().includes(q.toLowerCase()) ||
    r.endereco_imovel?.toLowerCase().includes(q.toLowerCase())
  )

  const cols = [
    { key: 'id', label: 'ID' },
    { key: 'nome', label: 'Nome' },
    { key: 'telefone', label: 'Telefone' },
    { key: 'endereco_imovel', label: 'Imóvel' },
    { key: 'valor_aluguel', label: 'Aluguel', render: (v) => fmt(v) },
    { key: 'pix', label: 'PIX' },
    { key: '_actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEdit({ ...row, _editing: true })} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Edit2 size={14} /></button>
        <button onClick={() => remove(row.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  const tabs = [
    { id: 'geral', label: 'Dados Gerais' },
    { id: 'imovel', label: 'Imóvel' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'comissao', label: 'Comissão' },
  ]

  const f = (key) => ({ value: form[key] || '', onChange: e => setForm(p => ({ ...p, [key]: e.target.value })) })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Proprietários / Imóveis</h1>
          <p className="text-sm text-slate-500">{rows.length} proprietários cadastrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Novo Proprietário
        </button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, ID ou endereço do imóvel..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        : <Table columns={cols} data={filtered} onRowClick={(r) => openEdit({ ...r, _editing: true })} />}

      <Modal open={modal} onClose={() => setModal(false)} title={form._editing ? 'Editar Proprietário' : 'Novo Proprietário'} size="xl">
        <div className="flex gap-1 mb-5 border-b border-slate-200 pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${tab === t.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="ID (código do imóvel)" required><input {...f('id')} disabled={form._editing} className="input" placeholder="2025-001" /></F>
            <F label="Nome completo" required><input {...f('nome')} className="input" /></F>
            <F label="CPF"><input {...f('cpf')} className="input" /></F>
            <F label="RG"><input {...f('rg')} className="input" /></F>
            <F label="Órgão Emissor"><input {...f('orgao_emissor')} className="input" /></F>
            <F label="Data Nascimento"><input type="date" {...f('data_nasc')} className="input" /></F>
            <F label="Naturalidade"><input {...f('naturalidade')} className="input" /></F>
            <F label="Estado Civil">
              <select {...f('estado_civil')} className="input">
                <option value="">Selecione</option>
                {['Solteiro','Casado','Divorciado','Viúvo','União Estável'].map(v => <option key={v}>{v}</option>)}
              </select>
            </F>
            <F label="Telefone"><input {...f('telefone')} className="input" /></F>
            <F label="E-mail"><input type="email" {...f('email')} className="input" /></F>
            <F label="Endereço Proprietário" className="md:col-span-2"><input {...f('endereco_proprietario')} className="input" /></F>
            <F label="CEP"><input {...f('cep_proprietario')} className="input" /></F>
            <F label="Cidade/UF"><input {...f('cidade_uf_proprietario')} className="input" /></F>
          </div>
        )}

        {tab === 'imovel' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Endereço Imóvel" className="md:col-span-2"><input {...f('endereco_imovel')} className="input" /></F>
            <F label="CEP Imóvel"><input {...f('cep_imovel')} className="input" /></F>
            <F label="Cidade/UF Imóvel"><input {...f('cidade_uf_imovel')} className="input" /></F>
            <F label="Inscrição Municipal"><input {...f('inscricao_municipal')} className="input" /></F>
            <F label="Administradora Condomínio"><input {...f('administradora')} className="input" /></F>
            <F label="Valor Aluguel (R$)"><input type="number" {...f('valor_aluguel')} className="input" /></F>
            <F label="Valor Condomínio (R$)"><input type="number" {...f('valor_condominio')} className="input" /></F>
            <F label="Taxas Extras Cond. (R$)"><input type="number" {...f('taxas_extras_cond')} className="input" /></F>
            <F label="Valor IPTU (R$)"><input type="number" {...f('valor_iptu')} className="input" /></F>
            <F label="Dia Vencto Condomínio"><input type="number" {...f('dia_vencto_condominio')} className="input" /></F>
            <F label="Taxas Extras (R$)"><input type="number" {...f('taxas_extras')} className="input" /></F>
          </div>
        )}

        {tab === 'financeiro' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Banco"><input {...f('banco')} className="input" /></F>
            <F label="Agência"><input {...f('agencia')} className="input" /></F>
            <F label="Conta Corrente"><input {...f('conta_corrente')} className="input" /></F>
            <F label="PIX"><input {...f('pix')} className="input" /></F>
            <F label="% Taxa Adm Beemob"><input type="number" step="0.0001" {...f('percentual_taxa_adm')} className="input" /></F>
            <F label="Honorário Adm 1º Aluguel (R$)"><input type="number" {...f('honorario_adm_primeiro')} className="input" /></F>
          </div>
        )}

        {tab === 'comissao' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <F label="Captador"><input {...f('captador_nome')} className="input" /></F>
            <F label="Corretor"><input {...f('corretor_nome')} className="input" /></F>
            <F label="Gestor"><input {...f('gestor_nome')} className="input" /></F>
          </div>
        )}

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
