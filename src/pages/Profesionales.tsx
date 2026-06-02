import { useState } from 'react'
import { MessageCircle, Plus, X, RefreshCw } from 'lucide-react'
import { useProfesionales, type Profesional } from '@/hooks/useProfesionales'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

function waLink(p: string) {
  const c = p.replace(/[\s\-\(\)\+\.]/g,'')
  return c.startsWith('54') ? `https://wa.me/${c}` : `https://wa.me/54${c}`
}

const ESPEC: Record<string, string> = {
  arquitecto:'Arquitecto/a', ingeniero_civil:'Ing. Civil', escribano:'Escribano/a',
  maestro_mayor_obras:'MMO', ingeniero_electrico:'Ing. Eléctrico', abogado:'Abogado/a', otro:'Otro',
}

function DetalleModal({ prof, onClose }: { prof: Profesional; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{prof.apellido}, {prof.nombre}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="badge badge-info">{ESPEC[prof.especialidad??''] ?? prof.especialidad}</span>
            {prof.matricula&&<span className="badge badge-gray text-[10px]">Mat. {prof.matricula}</span>}
            <span className={cn('badge text-[10px]',prof.estado==='activo'?'badge-success':'badge-danger')}>{prof.estado}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['CUIT',prof.cuit??'—'],['Email',prof.email??'—'],['Teléfono',prof.telefono??'—']].map(([l,v])=>(
              <div key={l}><p className="text-[10px] text-gray-400 uppercase tracking-widest">{l}</p><p className="text-sm font-medium text-gray-800">{v}</p></div>
            ))}
          </div>
          {prof.notas&&<p className="text-sm text-gray-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100">{prof.notas}</p>}
          {prof.whatsapp&&(
            <a href={waLink(prof.whatsapp)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
              <MessageCircle size={15}/> WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Profesionales() {
  const [selected, setSelected] = useState<Profesional|null>(null)
  const { data, loading, error, reload } = useProfesionales()

  return (
    <div className="flex flex-col h-full">
      <Header title="Profesionales"
        subtitle={`${data.filter(p=>p.estado==='activo').length} activos`}
        actions={
          <div className="flex gap-2">
            <button className="btn-primary flex items-center gap-2"><Plus size={16}/> Nuevo</button>
            <button onClick={reload} className="btn-ghost"><RefreshCw size={15}/></button>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-10">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map(p => (
              <div key={p.id} onClick={()=>setSelected(p)}
                className="card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                    {p.nombre[0]}{p.apellido[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{p.apellido}, {p.nombre}</p>
                      <span className={cn('badge text-[10px]',p.estado==='activo'?'badge-success':'badge-gray')}>{p.estado}</span>
                    </div>
                    <span className="badge badge-info text-[9px] mt-1">{ESPEC[p.especialidad??'']??p.especialidad}</span>
                    {p.matricula&&<p className="text-[10px] text-gray-400 mt-0.5">Mat. {p.matricula}</p>}
                  </div>
                </div>
                {p.telefono&&<p className="text-xs text-gray-500 mt-2">{p.telefono}</p>}
                {p.email&&<p className="text-xs text-gray-400 truncate">{p.email}</p>}
              </div>
            ))}
            {!data.length&&<div className="col-span-3 text-center text-gray-400 py-12">Sin profesionales cargados</div>}
          </div>
        )}
      </div>
      {selected&&<DetalleModal prof={selected} onClose={()=>setSelected(null)}/>}
    </div>
  )
}
