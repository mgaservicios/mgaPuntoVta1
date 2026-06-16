'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Download, Database } from 'lucide-react'

export default function BackupPage() {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/backup')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string }).error ?? 'Error al generar el backup')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `backup-${date}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup descargado correctamente')
    } catch {
      toast.error('Error al generar el backup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Backup del sistema</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">Exportar todos los datos</p>
            <p className="text-xs text-gray-500 mt-1">
              Genera un archivo Excel con toda la información del sistema. Cada tabla queda en una hoja separada.
            </p>
          </div>
        </div>

        <ul className="text-xs text-gray-500 space-y-1 ml-10">
          <li>• Artículos, variantes, categorías, marcas y proveedores</li>
          <li>• Precios y listas de precio</li>
          <li>• Stock por sucursal y movimientos</li>
          <li>• Ventas, órdenes, remitos y cobranzas</li>
          <li>• Caja, fondos y formas de pago</li>
          <li>• Módulo óptica completo</li>
          <li>• Configuración y usuarios</li>
        </ul>
      </div>

      <div className="space-y-2">
        <Button onClick={handleDownload} disabled={loading} className="gap-2">
          <Download className="w-4 h-4" />
          {loading ? 'Generando backup…' : 'Descargar backup'}
        </Button>
        {loading && (
          <p className="text-xs text-gray-400">
            Esto puede demorar unos segundos según la cantidad de datos…
          </p>
        )}
      </div>
    </div>
  )
}
