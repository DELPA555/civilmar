import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus, Search, MessageCircle, X, LayoutGrid, List, ChevronRight, RefreshCw } from 'lucide-react'
import { useClientes, type Cliente, type ClienteInput } from '@/hooks/useClientes'
import type { EstadoCRM } from '@/types'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

export const CRM_CFG: Record<EstadoCRM, { label: string; cls: string; col: string; dot: string }> = {
  interesado:  { label: 'Interesado',  cls: 'bg-gray-100 text-gray-600',   col: 'bg-gray-50 border-gray-200',   dot: 'bg-gray-400' },
  prospecto:   { label: 'Prospecto',   cls: 'bg-blue-100 text-blue-700',   col: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500' },
  reservado:   { label: 'Reservado',   cls: 'bg-amber-100 text-amber-800', col: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  comprador:   { label: 'Comprador',   cls: 'bg-green-100 text-green-800', col: 'bg-green-50 border-green-200', dot: 'bg-green-600' },
  escriturado: { label: 'Escriturado', cls: 'bg-teal-100 text-teal-800',   col: 'bg-teal-50 border-teal-200',   dot: 'bg-teal-600' },
  inactivo:    { label: 'Inactivo',    cls: 'bg-red-100 text-red-700',     col: 'bg-red-50 border-red-200',     dot: 'bg-red-500' },
}
const ESTADOS_CRM: EstadoCRM[] = ['interesado', 'prospecto', 'reservado', 'comprador', 'escriturado']

export function waLink(phone: string): string {
  const c = phone.replace(/[\s\-\(\)\+\.]/g, '')
  if (c.startsWith('54')) return `https://wa.me/${c}`
  if (c.startsWith('0'))  return `https://wa.me/54${c.slice(1)}`
  return `https://wa.me/54${c}`
}
export function nombreCompleto(c: Cliente): string {
  if (c.tipo === 'persona_juridica') return c.razon_social ?? c.nombre
  return [c.apellido, c.nombre].filter(Boolean).join(', ')
}
const COLORS = ['bg-primary','bg-primary-light','bg-accent','bg-success','bg-teal-600','bg-purple-600']
export function Avatar({ cliente, size = 'md' }: { cliente: Cliente; size?: 'sm'|'md'|'lg' }) {
  const idx = (cliente.id.charCodeAt(0) ?? 0) % COLORS.length
  const sz  = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'
  const ini = cliente.tipo === 'persona_juridica'
    ? (cliente.razon_social ?? cliente.nombre ?? 'E')[0].toUpperCase()
    : `${cliente.nombre[0]}${cliente.apellido?.[0] ?? ''}`.toUpperCase()
  return <div className={cn('rounded-full flex items-center justify-center font-bold text-white shrink-0', sz, COLORS[idx])}>{ini}</div>
}

// ── Modal Nuevo Cliente ───────────────────────────────────────────────────────
function NuevoClienteModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: ClienteInput) => Promise<void> }) {
  const [tipo, setTipo] = useState<'persona_fisica'|'persona_juridica'>('persona_fisica')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre:'',apellido:'',razon_social:'',dni:'',cuit:'',email:'',telefono:'',whatsapp:'',localidad:'Mar del Plata',provincia:'Buenos Aires',pais:'Argentina',estado_crm:'interesado',origen:'',notas:'',vendedor_id:'' })
  const F = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const fi = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary'
  const lb = 'block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1'

  const save = async () => {
    setSaving(true)
    try {
      await onCreate({ ...form, tipo } as ClienteInput)
      onClose()
    } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <div className="flex rounded-lg overflow-hidden border border-gray-200 h-9">
            {(['persona_fisica','persona_juridica'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={cn('flex-1 text-sm font-medium transition-colors', tipo===t?'bg-primary text-white':'bg-white text-gray-500 hover:bg-gray-50')}>
                {t === 'persona_fisica' ? 'Persona física' : 'Persona jurídica'}
              </button>
            ))}
          </div>
          {tipo === 'persona_fisica' ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lb}>Nombre *</label><input className={fi} autoFocus value={form.nombre} onChange={e=>F('nombre',e.target.value)}/></div>
              <div><label className={lb}>Apellido</label><input className={fi} value={form.apellido} onChange={e=>F('apellido',e.target.value)}/></div>
              <div><label className={lb}>DNI</label><input className={fi} value={form.dni} onChange={e=>F('dni',e.target.value)}/></div>
              <div><label className={lb}>CUIT</label><input className={fi} value={form.cuit} onChange={e=>F('cuit',e.target.value)}/></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lb}>Razón social *</label><input className={fi} autoFocus value={form.razon_social} onChange={e=>F('razon_social',e.target.value)}/></div>
              <div><label className={lb}>CUIT</label><input className={fi} value={form.cuit} onChange={e=>F('cuit',e.target.value)}/></div>
              <div><label className={lb}>Nombre contacto</label><input className={fi} value={form.nombre} onChange={e=>F('nombre',e.target.value)}/></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lb}>Email</label><input type="email" className={fi} value={form.email} onChange={e=>F('email',e.target.value)}/></div>
            <div><label className={lb}>Teléfono</label><input className={fi} value={form.telefono} onChange={e=>F('telefono',e.target.value)}/></div>
            <div><label className={lb}>WhatsApp</label><input className={fi} value={form.whatsapp} onChange={e=>F('whatsapp',e.target.value)}/></div>
            <div><label className={lb}>Estado CRM</label>
              <select className={fi} value={form.estado_crm} onChange={e=>F('estado_crm',e.target.value)}>
                {Object.entries(CRM_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label className={lb}>Localidad</label><input className={fi} value={form.localidad} onChange={e=>F('localidad',e.target.value)}/></div>
            <div><label className={lb}>Origen</label><input className={fi} value={form.origen} onChange={e=>F('origen',e.target.value)} placeholder="Referido, portal..."/></div>
          </div>
          <div><label className={lb}>Notas</label><textarea className={fi} rows={2} value={form.notas} onChange={e=>F('notas',e.target.value)}/></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving || (!form.nombre.trim() && !form.razon_social.trim())}
            className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Crear cliente'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Clientes() {
  const navigate = useNavigate()
  const [search,     setSearch]     = useState('')
  const [filtroEst,  setFiltroEst]  = useState('todos')
  const [vista,      setVista]      = useState<'tabla'|'kanban'>('tabla')
  const [showNew,    setShowNew]    = useState(false)
  const { data, loading, error, reload, create } = useClientes()

  const filtrados = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(c => {
      if (filtroEst !== 'todos' && c.estado_crm !== filtroEst) return false
      if (!q) return true
      const nm = nombreCompleto(c).toLowerCase()
      return nm.includes(q) || (c.dni??'').includes(q) || (c.cuit??'').includes(q)
        || (c.telefono??'').replace(/\D/g,'').includes(q) || (c.email??'').toLowerCase().includes(q)
    })
  }, [data, search, filtroEst])

  return (
    <div className="flex flex-col h-full">
      <Header title="Clientes / CRM" subtitle={`${data.length} clientes`}
        actions={<button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2"><Plus size={16}/> Nuevo cliente</button>}
      />
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Nombre, DNI, teléfono, email..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filtroEst} onChange={e=>setFiltroEst(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.entries(CRM_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
            {(['tabla','kanban'] as const).map(v=>(
              <button key={v} onClick={()=>setVista(v)}
                className={cn('p-1.5 rounded transition-colors', vista===v?'bg-primary text-white':'text-gray-400 hover:text-gray-600')}>
                {v==='tabla'?<List size={15}/>:<LayoutGrid size={15}/>}
              </button>
            ))}
          </div>
          <button onClick={reload} className="text-gray-400 hover:text-primary transition-colors"><RefreshCw size={15}/></button>
          <span className="text-xs text-gray-400">{filtrados.length} resultado{filtrados.length!==1?'s':''}</span>
        </div>
      </div>

      <div className={cn('flex-1 overflow-auto p-6', vista==='kanban'&&'flex flex-col')}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        ) : vista === 'tabla' ? (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">DNI / CUIT</th>
                <th className="px-4 py-3 text-left">Contacto</th>
                <th className="px-4 py-3 text-center">Estado CRM</th>
                <th className="px-4 py-3 text-left">Vendedor</th>
                <th className="px-4 py-3 text-left">Alta</th>
                <th className="px-4 py-3 w-8"/>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map((c,i)=>{
                  const crm = CRM_CFG[c.estado_crm]
                  return (
                    <tr key={c.id} onClick={()=>navigate(`/clientes/${c.id}`)}
                      className={cn('cursor-pointer hover:bg-blue-50/40 transition-colors', i%2===0?'bg-white':'bg-gray-50/30')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar cliente={c} size="sm"/>
                          <span className="font-semibold text-gray-900 text-sm">{nombreCompleto(c)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{c.dni??c.cuit??'—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.telefono&&<span className="text-xs text-gray-500">{c.telefono}</span>}
                          {c.whatsapp&&<a href={waLink(c.whatsapp)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="p-1 text-green-600 hover:bg-green-50 rounded"><MessageCircle size={13}/></a>}
                        </div>
                        {c.email&&<p className="text-[10px] text-gray-400 truncate max-w-[160px]">{c.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-center"><span className={cn('badge text-[10px]',crm.cls)}>{crm.label}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.vendedor ? `${c.vendedor.nombre} ${c.vendedor.apellido}` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(c.created_at),'dd/MM/yy',{locale:es})}</td>
                      <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-300"/></td>
                    </tr>
                  )
                })}
                {filtrados.length===0&&<tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin clientes que coincidan</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban */
          <div className="flex gap-4 overflow-x-auto pb-3 h-full">
            {ESTADOS_CRM.map(estado=>{
              const cfg = CRM_CFG[estado]
              const list = filtrados.filter(c=>c.estado_crm===estado)
              return (
                <div key={estado} className={cn('flex-shrink-0 w-56 rounded-xl border flex flex-col',cfg.col)}>
                  <div className="px-3 py-2.5 border-b border-inherit flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full',cfg.dot)}/>
                      <span className="text-xs font-bold text-gray-700">{cfg.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 bg-white rounded-full px-2 py-0.5 border border-gray-200">{list.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {list.map(c=>(
                      <div key={c.id} onClick={()=>navigate(`/clientes/${c.id}`)}
                        className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar cliente={c} size="sm"/>
                          <p className="text-xs font-semibold text-gray-800 truncate flex-1">{nombreCompleto(c)}</p>
                          {c.whatsapp&&<a href={waLink(c.whatsapp)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="p-1 text-green-600 hover:bg-green-50 rounded"><MessageCircle size={12}/></a>}
                        </div>
                        {c.origen&&<p className="text-[10px] text-gray-400">{c.origen}</p>}
                      </div>
                    ))}
                    {list.length===0&&<p className="text-[10px] text-gray-400 text-center py-6">Sin clientes</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {showNew&&<NuevoClienteModal onClose={()=>setShowNew(false)} onCreate={create}/>}
    </div>
  )
}
