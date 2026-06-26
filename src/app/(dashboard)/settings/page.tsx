'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { createOperatorUser } from './actions'
import { 
  Settings, 
  Building2, 
  Percent, 
  Clock, 
  AlertTriangle, 
  UserPlus, 
  Users, 
  Mail, 
  CheckCircle2, 
  CircleAlert, 
  ShieldCheck,
  ToggleLeft
} from 'lucide-react'

interface TenantSettings {
  interest_rate_default: number
  term_weeks_default: number
  is_aval_mandatory: boolean
  penalty_type: string
  penalty_amount_default: number
  grace_period_days: number
}

interface Profile {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'administrator' | 'collector'
  created_at: string
}

export default function SettingsPage() {
  const [tenantName, setTenantName] = useState('')
  const [settings, setSettings] = useState<TenantSettings>({
    interest_rate_default: 20,
    term_weeks_default: 15,
    is_aval_mandatory: true,
    penalty_type: 'flat',
    penalty_amount_default: 50,
    grace_period_days: 1
  })
  
  const [team, setTeam] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  
  // Settings edit messages
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState('')
  const [updatingSettings, setUpdatingSettings] = useState(false)

  // Team creation form states
  const [opEmail, setOpEmail] = useState('')
  const [opPassword, setOpPassword] = useState('')
  const [opFullName, setOpFullName] = useState('')
  const [teamError, setTeamError] = useState('')
  const [teamSuccess, setTeamSuccess] = useState('')
  const [addingOp, setAddingOp] = useState(false)

  const supabase = createClient()

  const fetchSettingsAndTeam = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userRole = user.app_metadata?.role
      setRole(userRole || 'collector')
      const tenantId = user.app_metadata?.tenant_id

      if (!tenantId) return

      // 1. Fetch Tenant Name and Settings
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('name, settings')
        .eq('id', tenantId)
        .single()

      if (tenantError) throw tenantError
      if (tenant) {
        setTenantName(tenant.name)
        setSettings(tenant.settings as unknown as TenantSettings)
      }

      // 2. Fetch Team Members
      const { data: teamData, error: teamError } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('role', { ascending: true })

      if (teamError) throw teamError
      setTeam(teamData || [])

    } catch (err: any) {
      console.error(err)
      setSettingsError('Error al cargar la configuración de la cuenta.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchSettingsAndTeam()
  }, [fetchSettingsAndTeam])

  // Handle tenant parameters update
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpdatingSettings(true)
    setSettingsError('')
    setSettingsSuccess('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const tenantId = user?.app_metadata?.tenant_id

      if (!tenantId) throw new Error('No se encontró el ID de tu negocio.')

      const { error } = await supabase
        .from('tenants')
        .update({
          name: tenantName,
          settings: settings as any
        })
        .eq('id', tenantId)

      if (error) throw error

      setSettingsSuccess('Configuraciones guardadas correctamente.')
    } catch (err: any) {
      console.error(err)
      setSettingsError(err.message || 'Error al guardar la configuración.')
    } finally {
      setUpdatingSettings(false)
    }
  }

  // Handle collector onboarding invitation
  const handleAddCollector = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingOp(true)
    setTeamError('')
    setTeamSuccess('')

    if (opPassword.length < 6) {
      setTeamError('La contraseña del cobrador debe tener al menos 6 caracteres.')
      setAddingOp(false)
      return
    }

    const res = await createOperatorUser(opEmail, opPassword, opFullName)

    if (!res.success) {
      setTeamError(res.error || 'Error al crear el usuario.')
    } else {
      setTeamSuccess(`Cobrador ${opFullName} registrado correctamente.`)
      setOpEmail('')
      setOpPassword('')
      setOpFullName('')
      // Refresh team list
      fetchSettingsAndTeam()
    }
    setAddingOp(false)
  }

  const isEditable = role === 'owner' || role === 'administrator'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
        <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm">Cargando configuraciones...</span>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Settings className="h-7 w-7 text-primary" />
          Configuración
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura tus plazos y multas, y administra las cuentas de tus cobradores.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Parameters Forms */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl border border-border p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Parámetros Generales de Préstamo
            </h3>

            {settingsError && (
              <div className="mb-4 p-4 bg-danger-bg border border-danger-border text-danger text-sm rounded-xl flex gap-2">
                <CircleAlert className="h-5 w-5 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className="mb-4 p-4 bg-success-bg border border-success-border text-success text-sm rounded-xl flex gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Nombre de la Organización</label>
                <input
                  type="text"
                  required
                  disabled={!isEditable || updatingSettings}
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-sm disabled:opacity-50"
                  placeholder="Ej: Préstamos del Istmo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Percent className="h-3.5 w-3.5" />
                    Tasa de Interés Sugerida (%)
                  </label>
                  <input
                    type="number"
                    required
                    disabled={!isEditable || updatingSettings}
                    value={settings.interest_rate_default}
                    onChange={(e) => setSettings({ ...settings, interest_rate_default: Number(e.target.value) })}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-sm disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Plazo Sugerido (Semanas)
                  </label>
                  <input
                    type="number"
                    required
                    disabled={!isEditable || updatingSettings}
                    value={settings.term_weeks_default}
                    onChange={(e) => setSettings({ ...settings, term_weeks_default: Number(e.target.value) })}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                    Multa Vencimiento Fija ($)
                  </label>
                  <input
                    type="number"
                    required
                    disabled={!isEditable || updatingSettings}
                    value={settings.penalty_amount_default}
                    onChange={(e) => setSettings({ ...settings, penalty_amount_default: Number(e.target.value) })}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-sm disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Días de Gracia (Multas)</label>
                  <input
                    type="number"
                    required
                    disabled={!isEditable || updatingSettings}
                    value={settings.grace_period_days}
                    onChange={(e) => setSettings({ ...settings, grace_period_days: Number(e.target.value) })}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Aval mandatory toggle */}
              <div className="flex items-center justify-between gap-4 p-4 bg-secondary rounded-xl border border-border">
                <div>
                  <h4 className="text-xs font-semibold text-white">Aval (Co-deudor) Obligatorio</h4>
                  <p className="text-[10px] text-muted-foreground">Bloquea la activación del préstamo en el sistema si no hay aval registrado.</p>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditable || updatingSettings}
                  checked={settings.is_aval_mandatory}
                  onChange={(e) => setSettings({ ...settings, is_aval_mandatory: e.target.checked })}
                  className="h-5 w-5 text-primary rounded border-border"
                />
              </div>

              {isEditable && (
                <button
                  type="submit"
                  disabled={updatingSettings}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition-all cursor-pointer text-sm disabled:opacity-50 mt-4"
                >
                  {updatingSettings ? 'Guardando...' : 'Guardar Parámetros'}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Team Onboarding & Invite Collector */}
        <div className="space-y-6">
          {/* List Team */}
          <div className="glass-card rounded-2xl border border-border p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Equipo y Roles
            </h3>

            <div className="divide-y divide-border/40">
              {team.map((member) => (
                <div key={member.id} className="py-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-xs truncate">{member.full_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase shrink-0 ${
                    member.role === 'owner' ? 'bg-success-bg border-success-border text-success' :
                    member.role === 'administrator' ? 'bg-info-bg border-info-border text-info' :
                    'bg-secondary border-border text-muted-foreground'
                  }`}>
                    {member.role === 'owner' ? 'Propietario' : member.role === 'administrator' ? 'Admin' : 'Cobrador'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Create Collector Form */}
          {isEditable && (
            <div className="glass-card rounded-2xl border border-border p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Registrar Cobrador (Personal)
              </h3>

              {teamError && (
                <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger text-xs rounded-xl flex gap-1.5">
                  <CircleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{teamError}</span>
                </div>
              )}

              {teamSuccess && (
                <div className="mb-4 p-3 bg-success-bg border border-success-border text-success text-xs rounded-xl flex gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{teamSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddCollector} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre del Cobrador</label>
                  <input
                    type="text"
                    required
                    value={opFullName}
                    onChange={(e) => setOpFullName(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white text-xs focus:outline-none focus:border-primary"
                    placeholder="Ej: Pedro Ruiz"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={opEmail}
                    onChange={(e) => setOpEmail(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white text-xs focus:outline-none focus:border-primary"
                    placeholder="pedro@ejemplo.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Contraseña Temporal</label>
                  <input
                    type="password"
                    required
                    value={opPassword}
                    onChange={(e) => setOpPassword(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white text-xs focus:outline-none focus:border-primary"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingOp}
                  className="w-full py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {addingOp ? 'Registrando cobrador...' : 'Crear Cuenta Cobrador'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
