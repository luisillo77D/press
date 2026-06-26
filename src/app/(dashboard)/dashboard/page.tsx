import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Wallet,
  Clock,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

interface MetricCardProps {
  title: string
  value: string
  subtext: string
  icon: React.ReactNode
  colorClass: string
}

function MetricCard({ title, value, subtext, icon, colorClass }: MetricCardProps) {
  return (
    <div className="glass-card rounded-2xl border border-border p-6 shadow-lg flex items-center justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-black text-white tracking-tight">{value}</h3>
        <p className="text-[11px] text-muted-foreground">{subtext}</p>
      </div>
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${colorClass} shrink-0`}>
        {icon}
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const threeDaysLater = new Date()
  threeDaysLater.setDate(threeDaysLater.getDate() + 3)

  // Fetch all metrics concurrently in a single network roundtrip timeline
  const [
    loansRes,
    todayPaymentsRes,
    clientsRes,
    overdueRes,
    recentRes,
    upcomingRes
  ] = await Promise.all([
    supabase
      .from('loans')
      .select('principal_amount, total_to_pay, status')
      .in('status', ['active', 'defaulted']),
      
    supabase
      .from('payments')
      .select('amount, fine_applied')
      .gte('payment_date', today.toISOString()),
      
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true }),
      
    supabase
      .from('installments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'late'),
      
    supabase
      .from('payments')
      .select(`
        amount,
        payment_date,
        payment_method,
        loans (
          principal_amount,
          clients:client_id (
            first_name,
            last_name
          )
        ),
        profiles:registered_by (
          full_name
        )
      `)
      .order('payment_date', { ascending: false })
      .limit(5),
      
    supabase
      .from('installments')
      .select(`
        id,
        installment_number,
        due_date,
        amount_due,
        amount_paid,
        loans (
          clients:client_id (
            first_name,
            last_name
          )
        )
      `)
      .eq('status', 'pending')
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', threeDaysLater.toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .limit(4)
  ])

  const loans = loansRes.data
  const todayPayments = todayPaymentsRes.data
  const clientsCount = clientsRes.count
  const overdueCount = overdueRes.count
  const recentPayments = recentRes.data
  const upcomingInstallments = upcomingRes.data

  const activeLoansCount = loans?.length || 0
  const activePrincipalSum = loans?.reduce((sum, l) => sum + Number(l.principal_amount), 0) || 0
  const activeTotalExpectedSum = loans?.reduce((sum, l) => sum + Number(l.total_to_pay), 0) || 0

  const collectedTodaySum = todayPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
  const finesCollectedToday = todayPayments?.reduce((sum, p) => sum + Number(p.fine_applied), 0) || 0

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Inicio</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen operativo y financiero de tu negocio de préstamos.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Cartera Activa (Capital)" 
          value={`$${activePrincipalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext={`Préstamos activos: ${activeLoansCount}`}
          icon={<TrendingUp className="h-6 w-6" />}
          colorClass="bg-info-bg border-info-border text-info shadow-[0_8px_16px_rgba(59,130,246,0.1)]"
        />
        
        <MetricCard 
          title="Cobrado Hoy" 
          value={`$${collectedTodaySum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext={`Multas cobradas: $${finesCollectedToday.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6" />}
          colorClass="bg-success-bg border-success-border text-success shadow-[0_8px_16px_rgba(16,185,129,0.1)]"
        />

        <MetricCard 
          title="Total Prestatarios" 
          value={(clientsCount || 0).toString()}
          subtext="Expedientes de clientes registrados"
          icon={<Users className="h-6 w-6" />}
          colorClass="bg-primary/10 border-primary/20 text-primary shadow-[0_8px_16px_rgba(16,185,129,0.1)]"
        />

        <MetricCard 
          title="Cuotas Vencidas" 
          value={(overdueCount || 0).toString()}
          subtext="Instalmentos marcados en mora"
          icon={<AlertTriangle className="h-6 w-6" />}
          colorClass="bg-danger-bg border-danger-border text-danger shadow-[0_8px_16px_rgba(239,68,68,0.1)]"
        />
      </div>

      {/* Detailed Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Payments Ledger */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-border p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-white text-base">Últimos Pagos Recibidos</h3>
            <Link href="/collect" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              Cobrar cuota <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!recentPayments || recentPayments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No se han registrado pagos en el sistema todavía.
            </div>
          ) : (
            <div className="divide-y divide-border/35">
              {recentPayments.map((payment, index) => {
                const clientObj = (payment.loans as any)?.clients
                const clientName = clientObj ? `${clientObj.first_name} ${clientObj.last_name}` : 'Cliente'
                return (
                  <div key={index} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-primary border border-border">
                        <Wallet className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{clientName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Método: <span className="capitalize">{payment.payment_method}</span> • Cobrado por: {(payment.profiles as any)?.full_name || 'Desconocido'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-500 text-sm">+${Number(payment.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action Panel / Upcoming due dates */}
        <div className="glass-card rounded-2xl border border-border p-6 shadow-xl space-y-5">
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-white text-base">Próximos Vencimientos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Siguientes 3 días.</p>
          </div>

          {!upcomingInstallments || upcomingInstallments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No hay vencimientos programados en los próximos días.
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingInstallments.map((inst) => {
                const clientObj = (inst.loans as any)?.clients
                const clientName = clientObj ? `${clientObj.first_name} ${clientObj.last_name}` : 'Cliente'
                return (
                  <div key={inst.id} className="p-3 bg-secondary rounded-xl border border-border flex justify-between items-center text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-white">{clientName}</p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" />
                        Pago #{inst.installment_number} • Vence {new Date(inst.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-white">${Number(inst.amount_due - inst.amount_paid).toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
