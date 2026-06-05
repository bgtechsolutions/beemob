export function maskCPF(v = '') {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function maskTelefone(v = '') {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '')
}

export function maskCEP(v = '') {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2').replace(/-$/, '')
}

export async function buscarCEP(cep) {
  const c = cep.replace(/\D/g, '')
  if (c.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return {
      endereco: `${data.logradouro}${data.bairro ? ', ' + data.bairro : ''}`,
      cidade_uf: `${data.localidade}/${data.uf}`,
    }
  } catch { return null }
}
