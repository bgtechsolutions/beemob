import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { toast } from '../components/Toast'
import { fmt, fmtDate } from '../lib/format'
import {
  ClipboardCheck, Plus, Search, AlertTriangle, ArrowRight,
  ChevronDown, ChevronRight,
} from 'lucide-react'

const TIPOS = {
  entrada: { rotulo: 'Entrada', cor: 'green' },
  saida: { rotulo: 'Saída', cor: 'orange' },
  periodica: { rotulo: 'Periódica', cor: 'blue' },
}

const STATUS = {
  rascunho: { rotulo: 'Rascunho', cor: 'gray' },
  concluida: { rotulo: 'Concluída', cor: 'blue' },
  assinada: { rotulo: 'Assinada', cor: 'green' },
  cancelada: { rotulo: 'Cancelada', cor: 'red' },
}

// Ordem decrescente de conservação. A saída compara contra a entrada.
const ESTADOS = [
  { valor: 'novo', rotulo: 'Novo', cor: 'text-green-700 bg-green-50 border-green-200' },
  { valor: 'bom', rotulo: 'Bom', cor: 'text-green-600 bg-green-50 border-green-200' },
  { valor: 'regular', rotulo: 'Regular', cor: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { valor: 'ruim', rotulo: 'Ruim', cor: 'text-orange-700 bg-orange-50 border-orange-200' },
  { valor: 'danificado', rotulo: 'Danificado', cor: 'text-red-700 bg-red-50 border-red-200' },
  { valor: 'ausente', rotulo: 'Ausente', cor: 'text-red-800 bg-red-100 border-red-300' },
]

export default function Vistorias() {
  const [vistorias, setVistorias] = useState([])
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [novaAberta, setNovaAberta] = useState(false)
  const [detalhe, setDetalhe] = useState(null)

  // `vivo` evita atualizar estado depois que o componente sai de tela.
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false }
  }, [])

  async function carregar() {
    try {
      const [v, c] = await Promise.all([
        supabase.from('vistorias')
          .select('*, imoveis(endereco, cidade_uf), contratos(inquilinos(nome), proprietarios(nome))')
          .order('data_vistoria', { ascending: false }),
        supabase.from('contratos')
          .select('id, imovel_id, status, inquilinos(nome), proprietarios(nome), imoveis(endereco)')
          .eq('status', 'ativo'),
      ])
      if (!vivo.current) return
      if (v.error) throw v.error
      if (c.error) throw c.error
      setVistorias(v.data || [])
      setContratos(c.data || [])
      setErro(null)
    } catch (e) {
      if (vivo.current) setErro(e.message || 'Falha ao carregar vistorias')
    } finally {
      if (vivo.current) setLoading(false)
    }
  }

  // Busca inicial. O lint sinaliza setState dentro de efeito, mas aqui o
  // estado só muda depois do await e a flag `vivo` protege o unmount.
  // Mesmo padrão já usado em Dashboard e Financeiro.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  const filtradas = vistorias.filter(v => {
    if (filtroTipo && v.tipo !== filtroTipo) return false
    if (!busca) return true
    const alvo = [
      v.contratos?.inquilinos?.nome,
      v.contratos?.proprietarios?.nome,
      v.imoveis?.endereco,
      v.contrato_id,
      v.responsavel_nome,
    ].filter(Boolean).join(' ').toLowerCase()
    return alvo.includes(busca.toLowerCase())
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vistorias</h1>
          <p className="text-sm text-slate-500 mt-1">
            Laudos de entrada, saída e periódicas — base para cobrar danos na rescisão
          </p>
        </div>
        <button onClick={() => setNovaAberta(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg
                     text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nova vistoria
        </button>
      </div>

      {erro && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">{erro}</p>
            <p className="text-xs text-red-600 mt-1">
              Se a mensagem citar uma relação inexistente, rode <code>supabase_vistorias.sql</code> no SQL Editor.
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por inquilino, proprietário ou endereço"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([v, { rotulo }]) => (
            <option key={v} value={v}>{rotulo}</option>
          ))}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <Vazio temVistorias={vistorias.length > 0} onNova={() => setNovaAberta(true)} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3">Imóvel / Inquilino</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Responsável</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Danos</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map(v => (
                <tr key={v.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => setDetalhe(v)}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-700">
                      {v.contratos?.inquilinos?.nome || v.contrato_id || '—'}
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-xs">
                      {v.imoveis?.endereco || '—'}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={TIPOS[v.tipo]?.cor}>{TIPOS[v.tipo]?.rotulo || v.tipo}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{fmtDate(v.data_vistoria)}</td>
                  <td className="px-5 py-3 text-slate-600">{v.responsavel_nome || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge variant={STATUS[v.status]?.cor}>{STATUS[v.status]?.rotulo || v.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-700">
                    {v.valor_danos > 0 ? fmt(v.valor_danos) : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-300"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Montados só quando abertos: cada abertura começa com estado limpo,
          sem precisar de efeito para resetar o formulário. */}
      {novaAberta && (
        <ModalNovaVistoria onClose={() => setNovaAberta(false)}
          contratos={contratos} onCriada={() => { setNovaAberta(false); carregar() }} />
      )}

      {detalhe && (
        <ModalDetalhe vistoria={detalhe} onClose={() => setDetalhe(null)}
          onAlterada={carregar} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Vazio({ temVistorias, onNova }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
      <ClipboardCheck size={36} className="mx-auto text-slate-300" />
      <p className="text-sm font-medium text-slate-600 mt-3">
        {temVistorias ? 'Nenhuma vistoria encontrada com esse filtro' : 'Nenhuma vistoria registrada'}
      </p>
      {!temVistorias && (
        <>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            A vistoria de entrada é o que permite cobrar danos na saída. Sem ela,
            a imobiliária não tem como provar o estado original do imóvel.
          </p>
          <button onClick={onNova}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                       rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={15} /> Criar a primeira
          </button>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function ModalNovaVistoria({ onClose, contratos, onCriada }) {
  const [form, setForm] = useState({
    contrato_id: '', tipo: 'entrada',
    data_vistoria: new Date().toISOString().slice(0, 10),
    responsavel_nome: '', acompanhante_nome: '', usarModelo: true,
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    if (!form.contrato_id) return toast('Selecione o contrato', 'warning')
    setSalvando(true)
    try {
      const contrato = contratos.find(c => c.id === form.contrato_id)

      const { data: vistoria, error } = await supabase.from('vistorias').insert({
        contrato_id: form.contrato_id,
        imovel_id: contrato?.imovel_id || null,
        tipo: form.tipo,
        data_vistoria: form.data_vistoria,
        responsavel_nome: form.responsavel_nome || null,
        acompanhante_nome: form.acompanhante_nome || null,
        status: 'rascunho',
      }).select().single()
      if (error) throw error

      if (form.usarModelo) await aplicarModelo(vistoria.id)

      toast('Vistoria criada')
      onCriada()
    } catch (e) {
      toast(e.message || 'Erro ao criar vistoria', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova vistoria">
      <form onSubmit={salvar} className="space-y-4">
        <Campo label="Contrato">
          <select value={form.contrato_id} required
            onChange={e => setForm({ ...form, contrato_id: e.target.value })}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white">
            <option value="">Selecione…</option>
            {contratos.map(c => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.inquilinos?.nome || 'sem inquilino'}
              </option>
            ))}
          </select>
          {contratos.length === 0 && (
            <p className="text-xs text-orange-600 mt-1">
              Nenhum contrato ativo encontrado.
            </p>
          )}
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white">
              {Object.entries(TIPOS).map(([v, { rotulo }]) => (
                <option key={v} value={v}>{rotulo}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Data">
            <input type="date" value={form.data_vistoria} required
              onChange={e => setForm({ ...form, data_vistoria: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Responsável (Beemob)">
            <input value={form.responsavel_nome}
              onChange={e => setForm({ ...form, responsavel_nome: e.target.value })}
              placeholder="Quem vistoriou"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
          </Campo>
          <Campo label="Acompanhante">
            <input value={form.acompanhante_nome}
              onChange={e => setForm({ ...form, acompanhante_nome: e.target.value })}
              placeholder="Inquilino ou proprietário"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm" />
          </Campo>
        </div>

        <label className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg cursor-pointer">
          <input type="checkbox" checked={form.usarModelo} className="mt-0.5"
            onChange={e => setForm({ ...form, usarModelo: e.target.checked })} />
          <span className="text-sm text-slate-600">
            Preencher com o checklist padrão
            <span className="block text-xs text-slate-400 mt-0.5">
              Cria os ambientes e itens usuais já prontos para avaliar. Você ajusta depois.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button type="submit" disabled={salvando}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium
                       hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Criando…' : 'Criar vistoria'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

async function aplicarModelo(vistoriaId) {
  const { data: modelo, error } = await supabase.from('vistoria_modelo')
    .select('*').order('ordem_ambiente').order('ordem_item')
  if (error || !modelo?.length) return

  const porAmbiente = {}
  modelo.forEach(m => {
    if (!porAmbiente[m.ambiente]) porAmbiente[m.ambiente] = { ordem: m.ordem_ambiente, itens: [] }
    porAmbiente[m.ambiente].itens.push(m)
  })

  const ambientes = Object.entries(porAmbiente).map(([nome, { ordem }]) => ({
    vistoria_id: vistoriaId, nome, ordem,
  }))
  const { data: criados, error: e2 } = await supabase
    .from('vistoria_ambientes').insert(ambientes).select()
  if (e2 || !criados) return

  const itens = []
  criados.forEach(a => {
    porAmbiente[a.nome]?.itens.forEach(m => {
      itens.push({ ambiente_id: a.id, descricao: m.item, estado: 'bom', ordem: m.ordem_item })
    })
  })
  if (itens.length) await supabase.from('vistoria_itens').insert(itens)
}

/* ------------------------------------------------------------------ */

function ModalDetalhe({ vistoria, onClose, onAlterada }) {
  const [ambientes, setAmbientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [abertos, setAbertos] = useState({})

  const vistoriaId = vistoria.id

  useEffect(() => {
    let cancelado = false
    void (async () => {
      const { data } = await supabase.from('vistoria_ambientes')
        .select('*, vistoria_itens(*)')
        .eq('vistoria_id', vistoriaId)
        .order('ordem')
      if (cancelado) return
      const lista = (data || []).map(a => ({
        ...a,
        vistoria_itens: (a.vistoria_itens || []).sort((x, y) => (x.ordem || 0) - (y.ordem || 0)),
      }))
      setAmbientes(lista)
      // Abre o primeiro ambiente para a lista não nascer toda fechada
      setAbertos(Object.fromEntries(lista.map((a, i) => [a.id, i === 0])))
      setCarregando(false)
    })()
    return () => { cancelado = true }
  }, [vistoriaId])

  async function mudarEstado(itemId, estado) {
    setAmbientes(prev => prev.map(a => ({
      ...a,
      vistoria_itens: a.vistoria_itens.map(i => i.id === itemId ? { ...i, estado } : i),
    })))
    const { error } = await supabase.from('vistoria_itens').update({ estado }).eq('id', itemId)
    if (error) toast('Não foi possível salvar: ' + error.message, 'error')
  }

  async function mudarStatus(status) {
    const { error } = await supabase.from('vistorias').update({ status }).eq('id', vistoria.id)
    if (error) return toast(error.message, 'error')
    toast(`Vistoria marcada como ${STATUS[status].rotulo.toLowerCase()}`)
    onAlterada()
    onClose()
  }

  const totalItens = ambientes.reduce((s, a) => s + a.vistoria_itens.length, 0)
  const problemas = ambientes.flatMap(a =>
    a.vistoria_itens.filter(i => ['ruim', 'danificado', 'ausente'].includes(i.estado))
      .map(i => ({ ...i, ambiente: a.nome })))

  return (
    <Modal open onClose={onClose} size="lg"
      title={`Vistoria de ${TIPOS[vistoria.tipo]?.rotulo.toLowerCase()} — ${fmtDate(vistoria.data_vistoria)}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
          <Info rotulo="Inquilino" valor={vistoria.contratos?.inquilinos?.nome} />
          <Info rotulo="Imóvel" valor={vistoria.imoveis?.endereco} />
          <Info rotulo="Responsável" valor={vistoria.responsavel_nome} />
          <Info rotulo="Acompanhante" valor={vistoria.acompanhante_nome} />
        </div>

        {problemas.length > 0 && (
          <div className="flex items-start gap-3 p-3.5 bg-orange-50 border border-orange-200 rounded-xl">
            <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {problemas.length} item{problemas.length !== 1 ? 'ns' : ''} com problema
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {problemas.slice(0, 4).map(p => `${p.ambiente}: ${p.descricao}`).join(' · ')}
                {problemas.length > 4 && ` · +${problemas.length - 4}`}
              </p>
            </div>
          </div>
        )}

        {carregando ? (
          <p className="text-sm text-slate-400 text-center py-8">Carregando checklist…</p>
        ) : ambientes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Esta vistoria não tem ambientes cadastrados.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'} em {ambientes.length} ambientes
            </p>
            {ambientes.map(a => (
              <div key={a.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setAbertos(o => ({ ...o, [a.id]: !o[a.id] }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50
                             hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-medium text-slate-700">{a.nome}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {a.vistoria_itens.length} itens
                    {abertos[a.id] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>
                </button>
                {abertos[a.id] && (
                  <div className="divide-y divide-slate-100">
                    {a.vistoria_itens.map(i => (
                      <div key={i.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-600 flex-1">{i.descricao}</span>
                        <select value={i.estado} onChange={e => mudarEstado(i.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1.5 rounded-lg border cursor-pointer
                            ${ESTADOS.find(x => x.valor === i.estado)?.cor || ''}`}>
                          {ESTADOS.map(e => (
                            <option key={e.valor} value={e.valor}>{e.rotulo}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <Badge variant={STATUS[vistoria.status]?.cor}>
            {STATUS[vistoria.status]?.rotulo}
          </Badge>
          <div className="flex gap-2">
            {vistoria.status === 'rascunho' && (
              <button onClick={() => mudarStatus('concluida')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
                           hover:bg-blue-700 flex items-center gap-2">
                Concluir <ArrowRight size={14} />
              </button>
            )}
            {vistoria.status === 'concluida' && (
              <button onClick={() => mudarStatus('assinada')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium
                           hover:bg-green-700">
                Marcar como assinada
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Info({ rotulo, valor }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{rotulo}</p>
      <p className="text-sm text-slate-700 mt-0.5 truncate">{valor || '—'}</p>
    </div>
  )
}
