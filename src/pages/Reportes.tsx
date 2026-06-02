import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FileDown, FileText, TrendingUp, Users, Building2, DollarSign, Clock, BarChart3, RefreshCw, type LucideIcon } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { useDashboard } from '@/hooks/useDashboard'
import { useContratos } from '@/hooks/useContratos'
import { useEmprendimientos } from '@/hooks/useEmprendimientos'
import { useTodasLasCuotas } from '@/hooks/useContratos'
import { fmt, fmtUSD } from '@/lib/currency'
import Header from '@/components/layout/Header'
import { cn } from '@/utils/cn'

// ── Componente genérico de reporte ────────────────────────────────────────────

interface ReportCardProps {
  icon: LucideIcon
  title: string; subtitle: string; color: string
  children: React.ReactNode
  onPDF?: () => void; onExcel?: () => void
  loading?: boolean
}

function ReportCard({ icon: Icon, title, subtitle, color, children, onPDF, onExcel, loading }: ReportCardProps) {
  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
            <Icon size={18} className="text-white"/>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            <p className="text-[10px] text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {onPDF && <button onClick={onPDF} disabled={loading} className="flex items-center gap-1.5 text-xs text-primary border border-primary/20 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-40"><FileText size={12}/> PDF</button>}
          {onExcel && <button onClick={onExcel} disabled={loading} className="flex items-center gap-1.5 text-xs text-green-700 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors font-medium disabled:opacity-40"><FileDown size={12}/> Excel</button>}
        </div>
      </div>
      {loading ? <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div> : children}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function Reportes() {
  const { flujo, vencidas, stats, loading: loadDash, reload: reloadDash } = useDashboard()
  const { data: contratos, loading: loadCo } = useContratos()
  const { data: emprendimientos, loading: loadEmp } = useEmprendimientos()
  const { data: cuotas, loading: loadCuotas } = useTodasLasCuotas()
  const [clienteSelId, setClienteSelId] = useState('')


  // Rentabilidad por emprendimiento
  const rentData = emprendimientos.map(e => {
    const cosContratos = contratos.filter(c => c.emprendimiento_id === e.id)
    const ventas   = cosContratos.reduce((s, c) => s + c.precio_total, 0)
    const cobrado  = cuotas.filter(c => cosContratos.find(co => co.id === c.contrato_id) && c.estado === 'pagada')
                          .reduce((s, c) => s + (c.monto_pagado ?? c.monto_original), 0)
    const unidsTot = e.unidades?.length ?? 0
    const unidsVend= e.unidades?.filter(u => u.estado === 'vendida').length ?? 0
    return { emprendimiento: e.nombre, ventas, cobrado, avance: e.avance ?? 0, unidsTot, unidsVend }
  })

  // Comisiones por vendedor (vendedor_id → nombre)
  const vendedores = [...new Set(contratos.filter(c => c.estado !== 'cancelado').map(c => {
    const v = c as { vendedor?: { nombre?: string; apellido?: string } }
    return v.vendedor ? `${v.vendedor.nombre ?? ''} ${v.vendedor.apellido ?? ''}`.trim() : null
  }).filter(Boolean) as string[])]

  const comisionesData = vendedores.map(v => {
    const vCo = contratos.filter(c => {
      const cv = c as { vendedor?: { nombre?: string; apellido?: string } }
      return cv.vendedor && `${cv.vendedor.nombre??''} ${cv.vendedor.apellido??''}`.trim() === v && c.estado !== 'cancelado'
    })
    const base = vCo.reduce((s, c) => s + c.precio_total, 0)
    return { vendedor: v, contratos: vCo.length, base, comision: base * 0.02 }
  })

  // Aging (cuotas vencidas agrupadas por cliente)
  const agingMap: Record<string, { cliente: string; cuotas: number; total: number; maxDias: number }> = {}
  vencidas.forEach(v => {
    const k = v.cliente || 'Desconocido'
    if (!agingMap[k]) agingMap[k] = { cliente: k, cuotas: 0, total: 0, maxDias: 0 }
    agingMap[k].cuotas++
    agingMap[k].total += v.monto
    agingMap[k].maxDias = Math.max(agingMap[k].maxDias, v.dias)
  })
  const agingData = Object.values(agingMap).sort((a, b) => b.maxDias - a.maxDias)

  // Exportadores
  const exportarFlujoExcel = () => {
    const ws = XLSX.utils.json_to_sheet(flujo.map(d => ({ Mes: d.mes, 'Proyectado (k USD)': d.proyectado, 'Cobrado (k USD)': d.cobrado })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Flujo')
    XLSX.writeFile(wb, 'flujo_caja_civilmar.xlsx')
  }

  const exportarFlujoP = () => {
    const doc = new jsPDF()
    doc.setFillColor(26,58,92); doc.rect(0,0,210,20,'F')
    doc.setTextColor(255); doc.setFontSize(14); doc.text('Civilmar ERP — Flujo de caja proyectado',15,13)
    doc.setTextColor(0)
    autoTable(doc, {
      startY: 28,
      head: [['Mes','Proyectado (k U$D)','Cobrado (k U$D)']],
      body: flujo.map(d=>[d.mes,`${d.proyectado}k`,`${d.cobrado}k`]),
      styles:{fontSize:9}, headStyles:{fillColor:[26,58,92],textColor:255},
      margin:{left:15,right:15},
    })
    doc.save('flujo_caja_civilmar.pdf')
  }

  const exportarAgingExcel = () => {
    const ws = XLSX.utils.json_to_sheet(agingData.map(d=>({Cliente:d.cliente,'Cuotas vencidas':d.cuotas,'Total vencido (U$D)':d.total,'Días máx. mora':d.maxDias})))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Aging')
    XLSX.writeFile(wb, 'aging_civilmar.xlsx')
  }

  const exportarRentExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rentData.map(d=>({Emprendimiento:d.emprendimiento,'Ventas (U$D)':d.ventas,'Cobrado (U$D)':d.cobrado,'Avance obra %':d.avance,'Unidades total':d.unidsTot,'Unidades vendidas':d.unidsVend})))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Rentabilidad')
    XLSX.writeFile(wb, 'rentabilidad_civilmar.xlsx')
  }

  const exportarComisionesExcel = () => {
    const ws = XLSX.utils.json_to_sheet(comisionesData.map(c=>({Vendedor:c.vendedor,Contratos:c.contratos,'Base cálculo (U$D)':c.base,'Comisión 2% (U$D)':c.comision})))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Comisiones')
    XLSX.writeFile(wb, 'comisiones_civilmar.xlsx')
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Reportes" subtitle="Reportes ejecutivos exportables a PDF y Excel"
        actions={<button onClick={reloadDash} className="btn-ghost flex items-center gap-1.5 text-xs"><RefreshCw size={13}/> Actualizar</button>}
      />
      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* 1. Flujo de caja */}
        <ReportCard icon={TrendingUp} title="Flujo de caja proyectado" subtitle="Últimos 6 meses — U$D miles" color="bg-primary" loading={loadDash} onPDF={exportarFlujoP} onExcel={exportarFlujoExcel}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={flujo} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="mes" tick={{fontSize:11,fill:'#9ca3af'}}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickFormatter={v=>`${v}k`}/>
              <Tooltip formatter={(v:number)=>[`${v}k U$D`]}/>
              <Bar dataKey="proyectado" name="Proyectado" fill="#e2e8f0" radius={[4,4,0,0]}/>
              <Bar dataKey="cobrado"    name="Cobrado"    fill="#1a3a5c" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          {stats && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              {[
                {label:'Proyectado total',value:fmtUSD(flujo.reduce((s,d)=>s+d.proyectado,0)*1000)},
                {label:'Cobrado',value:fmtUSD(flujo.reduce((s,d)=>s+d.cobrado,0)*1000)},
                {label:'Pendiente',value:fmtUSD(flujo.reduce((s,d)=>s+d.proyectado-d.cobrado,0)*1000)},
              ].map(s=>(
                <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-sm font-bold text-primary">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* 2. Aging */}
        <ReportCard icon={Clock} title="Aging de deuda — Clientes" subtitle="Cuotas vencidas por cliente" color="bg-red-600" loading={loadDash} onExcel={exportarAgingExcel}>
          {agingData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin deuda vencida — todos los clientes al día</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-center">Cuotas</th>
                  <th className="px-3 py-2 text-right">Total vencido</th>
                  <th className="px-3 py-2 text-right">Días mora máx.</th>
                  <th className="px-3 py-2 text-center">Urgencia</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {agingData.map((d,i)=>(
                    <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                      <td className="px-3 py-2 font-medium text-gray-800">{d.cliente}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{d.cuotas}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-danger">{fmtUSD(d.total)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.maxDias}d</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('badge text-[9px]',d.maxDias>60?'badge-danger':d.maxDias>30?'badge-warning':'badge-info')}>
                          {d.maxDias>60?'CRÍTICO':d.maxDias>30?'ALTO':'MODERADO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportCard>

        {/* 3. Rentabilidad */}
        <ReportCard icon={Building2} title="Rentabilidad por emprendimiento" subtitle="Ventas, cobros y avance" color="bg-green-700" loading={loadEmp||loadCo||loadCuotas} onExcel={exportarRentExcel}>
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Emprendimiento</th>
              <th className="px-3 py-2 text-right">Ventas (U$D)</th>
              <th className="px-3 py-2 text-right">Cobrado (U$D)</th>
              <th className="px-3 py-2 text-center">% cobrado</th>
              <th className="px-3 py-2 text-center">Avance obra</th>
              <th className="px-3 py-2 text-center">Unidades</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rentData.map((d,i)=>{
                const pctCob = d.ventas>0?(d.cobrado/d.ventas)*100:0
                return (
                  <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                    <td className="px-3 py-2 font-medium text-gray-800">{d.emprendimiento}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-primary">{fmtUSD(d.ventas)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-success">{fmtUSD(d.cobrado)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width:`${pctCob}%`}}/></div>
                        <span className="text-xs text-gray-600 w-8">{pctCob.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{width:`${d.avance}%`}}/></div>
                        <span className="text-xs text-gray-600 w-8">{d.avance}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">{d.unidsVend}/{d.unidsTot}</td>
                  </tr>
                )
              })}
              {!rentData.length&&<tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Sin emprendimientos</td></tr>}
            </tbody>
          </table>
        </ReportCard>

        {/* 4. Comisiones */}
        <ReportCard icon={Users} title="Comisiones de vendedores" subtitle="Base 2% sobre precio total de contratos vigentes" color="bg-amber-600" loading={loadCo} onExcel={exportarComisionesExcel}>
          {comisionesData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin datos de vendedores</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {comisionesData.map(c=>(
                <div key={c.vendedor} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="font-bold text-gray-900 text-base">{c.vendedor}</p>
                  <div className="mt-3 space-y-2">
                    {[['Contratos',`${c.contratos}`],['Base (U$D)',fmt(c.base,'USD')],['Comisión 2% (U$D)',fmt(c.comision,'USD')]].map(([l,v])=>(
                      <div key={l} className="flex justify-between text-sm">
                        <span className="text-gray-500">{l}</span>
                        <span className="font-semibold text-gray-900">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* 5. Avance de obras */}
        <ReportCard icon={BarChart3} title="Avance de obra vs. cronograma" subtitle="Estado de los emprendimientos activos" color="bg-blue-700" loading={loadEmp}
          onPDF={() => {
            const doc = new jsPDF()
            doc.setFillColor(26,58,92); doc.rect(0,0,210,20,'F')
            doc.setTextColor(255); doc.setFontSize(14); doc.text('Civilmar — Avance de obras',15,13)
            doc.setTextColor(0)
            autoTable(doc, {
              startY:28,
              head:[['Emprendimiento','Estado','Avance','Localidad']],
              body: emprendimientos.map(e=>[e.nombre,e.estado,`${e.avance??0}%`,e.localidad]),
              styles:{fontSize:9}, headStyles:{fillColor:[26,58,92],textColor:255},
              margin:{left:15,right:15},
            })
            doc.save('avance_obras_civilmar.pdf')
          }}>
          <div className="space-y-3">
            {emprendimientos.map(e=>(
              <div key={e.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.nombre}</p>
                  <p className="text-xs text-gray-400">{e.localidad} · {e.estado}</p>
                </div>
                <div className="flex items-center gap-3 w-52 shrink-0">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', (e.avance??0)>=70?'bg-green-500':(e.avance??0)>=40?'bg-amber-400':'bg-primary')}
                      style={{width:`${e.avance??0}%`}}/>
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-10 text-right">{e.avance??0}%</span>
                </div>
              </div>
            ))}
            {!emprendimientos.length&&<p className="text-sm text-gray-400 text-center py-4">Sin emprendimientos</p>}
          </div>
        </ReportCard>

        {/* 6. Estado de cuenta */}
        <ReportCard icon={DollarSign} title="Estado de cuenta por cliente" subtitle="Generá el PDF de cuenta corriente de un cliente" color="bg-teal-600">
          <div className="flex items-center gap-3">
            <select
              value={clienteSelId}
              onChange={e => setClienteSelId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— Seleccioná un cliente —</option>
              {contratos.filter((v,i,a)=>a.findIndex(c=>c.cliente_id===v.cliente_id)===i).map(c=>(
                <option key={c.cliente_id} value={c.cliente_id}>
                  {c.cliente ? `${c.cliente.apellido??''}, ${c.cliente.nombre}`.replace(/^,\s*/,'') : c.cliente_id}
                </option>
              ))}
            </select>
            <button
              disabled={!clienteSelId}
              onClick={() => {
                const cliContratos = contratos.filter(c => c.cliente_id === clienteSelId)
                const cliCuotas    = cuotas.filter(c => cliContratos.find(co => co.id === c.contrato_id))
                const cliente      = cliContratos[0]?.cliente
                const nombreCli    = cliente ? `${cliente.apellido??''}, ${cliente.nombre}`.replace(/^,\s*/,'') : clienteSelId
                const doc = new jsPDF()
                doc.setFillColor(26,58,92); doc.rect(0,0,210,20,'F')
                doc.setTextColor(255); doc.setFontSize(13)
                doc.text('Civilmar — Estado de cuenta',15,13)
                doc.text(format(new Date(),'dd/MM/yyyy',{locale:es}),195,13,{align:'right'})
                doc.setTextColor(0); doc.setFontSize(11)
                doc.text(`Cliente: ${nombreCli}`,15,30)
                autoTable(doc,{
                  startY:36,
                  head:[['Contrato','Emprendimiento','Total','Cuotas pag.','Vencidas','Estado']],
                  body: cliContratos.map(c=>[
                    c.numero,
                    c.emprendimiento?.nombre??'—',
                    `${c.moneda} ${c.precio_total.toLocaleString()}`,
                    String(cliCuotas.filter(q=>q.contrato_id===c.id&&q.estado==='pagada').length),
                    String(cliCuotas.filter(q=>q.contrato_id===c.id&&q.estado==='vencida').length),
                    c.estado,
                  ]),
                  styles:{fontSize:8}, headStyles:{fillColor:[26,58,92],textColor:255},
                  margin:{left:15,right:15},
                })
                const y = (doc as unknown as {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+8
                autoTable(doc,{
                  startY:y,
                  head:[['Contrato','N° cuota','Vencimiento','Monto','Estado']],
                  body: cliCuotas.slice(0,50).map(c=>[
                    c.contrato_numero??'',
                    String(c.numero_cuota),
                    c.fecha_vencimiento,
                    `${c.moneda??'USD'} ${c.monto_original.toLocaleString()}`,
                    c.estado,
                  ]),
                  styles:{fontSize:7}, headStyles:{fillColor:[45,90,142],textColor:255},
                  alternateRowStyles:{fillColor:[248,249,250]},
                  margin:{left:15,right:15},
                })
                doc.save(`estado_cuenta_${nombreCli.replace(/[^a-zA-Z0-9]/g,'_')}.pdf`)
              }}
              className="btn-primary flex items-center gap-2 shrink-0 disabled:opacity-50">
              <FileText size={15}/> Generar PDF
            </button>
          </div>
          <p className="text-xs text-gray-400">Incluye contratos, cuotas pagadas, pendientes y vencidas del cliente.</p>
        </ReportCard>

      </div>
    </div>
  )
}
