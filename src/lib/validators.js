export function validarCPF(cpf) {
  const s = cpf.replace(/\D/g, '')
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(s[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(s[10])
}

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validarDatas(inicio, fim) {
  if (!inicio || !fim) return true
  return new Date(fim) >= new Date(inicio)
}
