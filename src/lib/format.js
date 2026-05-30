import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export const fmtDate = (d) =>
  d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '—'

export const fmtMonth = (d) =>
  d ? format(new Date(d), 'MMMM/yyyy', { locale: ptBR }) : '—'
