/**
 * CurrencyInput — input com máscara BRL (R$ 1.500,00)
 * Props:
 *   value: number (valor armazenado)
 *   onChange: (number) => void
 *   className, placeholder, disabled, min
 */
export default function CurrencyInput({ value, onChange, className = 'input', placeholder = 'R$ 0,00', disabled, min = 0 }) {
  function toDisplay(num) {
    if (num === '' || num === null || num === undefined || isNaN(num)) return ''
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
  }

  function handleChange(e) {
    // Remove tudo que não é dígito
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) { onChange(0); return }
    // Divide por 100 para ter centavos
    const num = parseFloat(raw) / 100
    onChange(num)
  }

  function handleFocus(e) {
    // Ao focar, seleciona tudo para facilitar edição
    e.target.select()
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={toDisplay(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      min={min}
    />
  )
}
