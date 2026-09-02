const PATRON_CODIGO_BARRA = /^[a-z]{1,3}[^a-z0-9]+[0-9]{1,6}([^a-z0-9]+[0-9]{1,6})*$/i

export function normalizarBusquedaNumero(input: string | null): string | null {
  if (!input) return null
  const t = input.trim()
  if (!PATRON_CODIGO_BARRA.test(t)) return null
  return t.replace(/[^a-z0-9]+/gi, '-')
}
