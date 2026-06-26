'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { createTenantWithOwner } from './actions'
import { 
  Shield, 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle,
  User,
  Mail,
  Lock,
  ArrowRight
} from 'lucide-react'

interface Tenant {
  id: string
  name: string
  subdomain: string | null
  is_active: boolean
  created_at: string
}

export default function AdminPortalPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Create Tenant + Owner Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTenantName, setNewTenantName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  
  // Owner info
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Global Metrics
  const [globalLoansSum, setGlobalLoansSum] = useState(0)
  const [globalPaymentsSum, setGlobalPaymentsSum] = useState(0)
  const [globalClientsCount, setGlobalClientsCount] = useState(0)

  const supabase = createClient()

  // Fetch all tenants and global aggregates
  const fetchAdminData = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      // 1. Fetch all tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })

      if (tenantsError) throw tenantsError
      setTenants(tenantsData || [])

      // 2. Fetch global loans aggregate
      const { data: loansData } = await supabase
        .from('loans')
        .select('principal_amount')
      setGlobalLoansSum(loansData?.reduce((sum, l) => sum + Number(l.principal_amount), 0) || 0)

      // 3. Fetch global payments aggregate
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount')
      setGlobalPaymentsSum(paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0)

      // 4. Fetch global clients count
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
      setGlobalClientsCount(count || 0)

    } catch (err: any) {
      console.error(err)
      setErrorMsg('Error al consultar datos globales de administración. Verifica tus credenciales de Superadmin.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchAdminData()
  }, [fetchAdminData])

  // Handle tenant manual creation with owner
  const handleCreateTenantWithOwner = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    if (ownerPassword.length < 6) {
      setErrorMsg('La contraseña del propietario debe tener al menos 6 caracteres.')
      setSubmitting(false)
      return
    }

    try {
      const res = await createTenantWithOwner(
        newTenantName,
        subdomain || null,
        ownerName,
        ownerEmail,
        ownerPassword
      )

      if (!res.success) {
        setErrorMsg(res.error || 'Error al registrar el prestamista.')
        return
      }

      setSuccessMsg(`Negocio "${newTenantName}" y cuenta de propietario registradas con éxito.`)
      setIsModalOpen(false)
      
      // Reset Form fields
      setNewTenantName('')
      setSubdomain('')
      setOwnerName('')
      setOwnerEmail('')
      setOwnerPassword('')
      
      // Refresh
      fetchAdminData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Error al registrar el tenant.')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle tenant state (Active/Suspended)
  const toggleTenantStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ is_active: !currentStatus })
        .eq('id', tenantId)

      if (error) throw error
      
      setSuccessMsg('Estado del prestamista actualizado.')
      fetchAdminData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Error al cambiar estatus del prestamista.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            Panel de Administración Global (SaaS)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Supervisa los prestamistas activos en la plataforma, monitorea métricas agregadas y gestiona los tenants.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer text-sm shrink-0"
        >
          <Plus className="h-5 w-5" />
          Registrar Prestamista (Tenant)
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger-bg border border-danger-border text-danger text-sm rounded-xl flex gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-success-bg border border-success-border text-success text-sm rounded-xl flex gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Global SaaS Aggregates */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card rounded-2xl border border-border p-5 shadow-lg space-y-2">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Prestamistas (Tenants)</span>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-white">{tenants.length}</h4>
            <Building2 className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border p-5 shadow-lg space-y-2">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Capital Colocado Global</span>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-white">${globalLoansSum.toLocaleString()}</h4>
            <TrendingUp className="h-5 w-5 text-info" />
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border p-5 shadow-lg space-y-2">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Recaudación Total</span>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-white">${globalPaymentsSum.toLocaleString()}</h4>
            <DollarSign className="h-5 w-5 text-success" />
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border p-5 shadow-lg space-y-2">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold">Prestatarios Globales</span>
          <div className="flex items-center justify-between">
            <h4 className="text-2xl font-black text-white">{globalClientsCount}</h4>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden shadow-xl">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold text-white text-base">Negocios Registrados (Tenants)</h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs">Cargando prestamistas...</span>
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Ningún prestamista registrado en el SaaS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="bg-secondary text-white font-semibold">
                <tr>
                  <th className="px-6 py-3.5">ID del Tenant</th>
                  <th className="px-6 py-3.5">Nombre del Prestamista</th>
                  <th className="px-6 py-3.5">Subdominio</th>
                  <th className="px-6 py-3.5">Fecha Registro</th>
                  <th className="px-6 py-3.5 text-center">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/5">
                    <td className="px-6 py-4 font-mono text-[10px] text-muted-foreground shrink-0">{t.id}</td>
                    <td className="px-6 py-4 font-bold text-white text-sm">{t.name}</td>
                    <td className="px-6 py-4 text-xs text-primary">{t.subdomain || 'Básico (s/d)'}</td>
                    <td className="px-6 py-4">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                        t.is_active ? 'bg-success-bg border-success-border text-success' : 'bg-danger-bg border-danger-border text-danger'
                      }`}>
                        {t.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleTenantStatus(t.id, t.is_active)}
                        className={`inline-flex items-center gap-1 py-1.5 px-3 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                          t.is_active ? 'bg-danger-bg border-danger-border/30 text-danger hover:bg-danger/20' : 'bg-success-bg border-success-border/30 text-success hover:bg-success/20'
                        }`}
                      >
                        {t.is_active ? 'Suspender' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE TENANT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 relative my-4 max-h-[90vh] md:max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-lg transition-colors cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="shrink-0 mb-4 pr-8">
              <h3 className="text-xl font-bold text-white">Registrar Prestamista y Propietario</h3>
              <p className="text-sm text-muted-foreground mt-1">Da de alta una nueva franquicia y crea la cuenta del dueño del negocio en una sola operación.</p>
            </div>

            <form onSubmit={handleCreateTenantWithOwner} className="space-y-4 overflow-y-auto flex-1 pr-1 scrollbar-thin">
              <div className="border-b border-border pb-3 mb-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Datos del Negocio</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre Comercial</label>
                  <input
                    type="text"
                    required
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-xs"
                    placeholder="Ej: Préstamos del Centro"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Subdominio (Opcional)</label>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-xs"
                    placeholder="ej: centro"
                  />
                </div>
              </div>

              <div className="border-b border-border pb-3 pt-2 mb-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Datos del Propietario</h4>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-xs"
                  placeholder="Ej: Alejandro Gómez"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-xs"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-xs"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer text-sm mt-6 disabled:opacity-50"
              >
                {submitting ? 'Creando tenant y propietario...' : 'Dar de alta Prestamista y Propietario'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
