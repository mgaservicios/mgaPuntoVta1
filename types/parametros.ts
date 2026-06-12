export interface Parametro {
  clave: string
  valor: string
  tipo: 'booleano' | 'numero' | 'lista_precio'
  descripcion: string | null
}

export type ParametrosMap = Record<string, string>
