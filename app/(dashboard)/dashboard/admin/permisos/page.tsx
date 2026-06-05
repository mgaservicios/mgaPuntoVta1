'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/types/auth'
import { PERM_MODULES } from '@/lib/perm-groups'

type PermRow = { operation: string; allowed: boolean }

function TriCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
    />
  )
}

function triState(vals: boolean[]): 'all' | 'some' | 'none' {
  if (vals.every(Boolean)) return 'all'
  if (vals.some(Boolean)) return 'some'
  return 'none'
}

export default function PermisosPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [roleId, setRoleId] = useState('')
  const [perms, setPerms] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // open state for modules and submodules
  const [openMods, setOpenMods] = useState<Set<string>>(() => new Set(PERM_MODULES.map((m) => m.id)))
  const [openSubs, setOpenSubs] = useState<Set<string>>(() =>
    new Set(PERM_MODULES.flatMap((m) => m.subs.map((s) => s.id)))
  )

  useEffect(() => {
    fetch('/api/dashboard/admin/roles')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setRoles(list)
        if (list.length > 0) setRoleId(String(list[0].id))
      })
  }, [])

  const fetchPerms = useCallback(async (rid: string) => {
    if (!rid) return
    setLoading(true)
    const res = await fetch(`/api/dashboard/admin/permisos?role_id=${rid}`)
    const data = await res.json()
    const map: Record<string, boolean> = {}
    for (const p of data.permissions ?? []) map[p.operation] = p.allowed
    setPerms(map)
    setLoading(false)
  }, [])

  useEffect(() => { if (roleId) fetchPerms(roleId) }, [roleId, fetchPerms])

  function get(op: string) { return perms[op] ?? false }

  function toggle(op: string) {
    setPerms((prev) => ({ ...prev, [op]: !prev[op] }))
  }

  function setOps(ops: string[], value: boolean) {
    setPerms((prev) => {
      const next = { ...prev }
      for (const op of ops) next[op] = value
      return next
    })
  }

  function toggleMod(modId: string) {
    setOpenMods((prev) => { const n = new Set(prev); n.has(modId) ? n.delete(modId) : n.add(modId); return n })
  }

  function toggleSub(subId: string) {
    setOpenSubs((prev) => { const n = new Set(prev); n.has(subId) ? n.delete(subId) : n.add(subId); return n })
  }

  async function handleSave() {
    setSaving(true)
    const permissions = Object.entries(perms).map(([operation, allowed]) => ({ operation, allowed }))
    const res = await fetch('/api/dashboard/admin/permisos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: parseInt(roleId, 10), permissions }),
    })
    setSaving(false)
    if (res.ok) toast.success('Permisos guardados')
    else toast.error('Error al guardar')
  }

  const hasPerms = Object.keys(perms).length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Permisos por rol</h2>
        <Button onClick={handleSave} disabled={saving || !roleId || !hasPerms}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      <div className="mb-6 w-64">
        <Select value={roleId} onValueChange={(v) => { if (v) setRoleId(v) }}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccioná un rol">
              {roles.find((r) => String(r.id) === roleId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando…</p>
      ) : hasPerms && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Módulo / Pantalla / Operación</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-28">Permitido</th>
              </tr>
            </thead>
            <tbody>
              {PERM_MODULES.map((mod) => {
                const modOps = mod.subs.flatMap((s) => s.ops.map((o) => o.id))
                const modVals = modOps.map(get)
                const modState = triState(modVals)
                const modOpen = openMods.has(mod.id)

                return (
                  <Fragment key={mod.id}>
                    {/* NIVEL 1 — Módulo */}
                    <tr
                      className="bg-gray-100/80 border-t border-gray-200 cursor-pointer select-none hover:bg-gray-200/50"
                      onClick={() => toggleMod(mod.id)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 font-bold text-gray-800 text-sm">
                          {modOpen
                            ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          }
                          {mod.label}
                          <span className="text-xs font-normal text-gray-400">({modOps.length} operaciones)</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <TriCheckbox
                          checked={modState === 'all'}
                          indeterminate={modState === 'some'}
                          onChange={() => setOps(modOps, modState !== 'all')}
                        />
                      </td>
                    </tr>

                    {modOpen && mod.subs.map((sub) => {
                      const subOps = sub.ops.map((o) => o.id)
                      const subVals = subOps.map(get)
                      const subState = triState(subVals)
                      const subOpen = openSubs.has(sub.id)

                      return (
                        <Fragment key={sub.id}>
                          {/* NIVEL 2 — Submodulo */}
                          <tr
                            className="bg-gray-50/60 border-t border-gray-100 cursor-pointer select-none hover:bg-gray-100/50"
                            onClick={() => toggleSub(sub.id)}
                          >
                            <td className="py-2 pl-10 pr-4">
                              <div className="flex items-center gap-2 font-semibold text-gray-700">
                                {subOpen
                                  ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                }
                                {sub.label}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <TriCheckbox
                                checked={subState === 'all'}
                                indeterminate={subState === 'some'}
                                onChange={() => setOps(subOps, subState !== 'all')}
                              />
                            </td>
                          </tr>

                          {/* NIVEL 3 — Operaciones */}
                          {subOpen && sub.ops.map((op) => (
                            <tr key={op.id} className="border-t border-gray-50 hover:bg-blue-50/30">
                              <td className="py-1.5 pl-16 pr-4 text-gray-600 text-sm">{op.label}</td>
                              <td className="py-1.5 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={get(op.id)}
                                  onChange={() => toggle(op.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                                />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
