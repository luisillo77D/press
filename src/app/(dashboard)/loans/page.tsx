'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  FileText, 
  Plus, 
  Search, 
  User, 
  DollarSign, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ArrowRight,
  TrendingUp,
  Percent,
  Printer,
  Trash2
} from 'lucide-react'

interface Loan {
  id: string
  principal_amount: number
  interest_amount: number
  total_to_pay: number
  term_weeks: number
  status: 'draft' | 'active' | 'paid' | 'defaulted' | 'cancelled'
  payment_frequency: string
  start_date: string
  end_date: string
  created_at: string
  client: {
    first_name: string
    last_name: string
    address: string
    qr_code_identifier: string
  }
  aval?: {
    first_name: string
    last_name: string
    address: string
  }
}

interface Installment {
  id: string
  installment_number: number
  due_date: string
  amount_due: number
  amount_paid: number
  fine_amount: number
  status: 'pending' | 'partially_paid' | 'paid' | 'late'
  paid_at: string | null
}

interface Client {
  id: string
  first_name: string
  last_name: string
}

// -------------------------------------------------------------
// REUSABLE SEARCHABLE SELECT (COMBOBOX) COMPONENT
// -------------------------------------------------------------
interface SearchableSelectProps {
  label: string
  placeholder: string
  options: { id: string; name: string }[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

function SearchableSelect({ label, placeholder, options, value, onChange, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.id === value)
  
  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption.name)
    } else {
      setSearch('')
    }
  }, [selectedOption, value])

  const filtered = options.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        if (selectedOption) {
          setSearch(selectedOption.name)
        } else {
          setSearch('')
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [selectedOption])

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
        <User className="h-3.5 w-3.5 text-muted-foreground/60" />
        {label}
      </label>
      
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={search}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(true)
            if (!e.target.value) {
              onChange('')
            }
          }}
          className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white text-sm focus:outline-none focus:border-primary placeholder-muted-foreground transition-all"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-30 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl max-h-52 overflow-y-auto py-1 glass-card">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">No se encontraron resultados</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id)
                  setSearch(opt.name)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-muted text-white transition-colors flex items-center justify-between ${value === opt.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
              >
                <span>{opt.name}</span>
                {value === opt.id && (
                  <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function formatLocalDateString(dateStr: string | null | undefined) {
  if (!dateStr) return ''
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length === 3) {
    const year = parts[0]
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)
    return `${day}/${month}/${year}`
  }
  return dateStr
}

function getFirstPaymentDateString(startDateStr: string | null | undefined) {
  if (!startDateStr) return ''
  const parts = startDateStr.split('T')[0].split('-')
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const localDate = new Date(year, month, day + 7)
    return `${localDate.getDate()}/${localDate.getMonth() + 1}/${localDate.getFullYear()}`
  }
  return startDateStr
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tenantName, setTenantName] = useState('el Prestamista')
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)

  // New Loan Form States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedAvalId, setSelectedAvalId] = useState('')
  const [principal, setPrincipal] = useState(1000)
  const [interestRate, setInterestRate] = useState(20) // in percent
  const [interestAmount, setInterestAmount] = useState(200)
  const [totalToPay, setTotalToPay] = useState(1200)
  const [termWeeks, setTermWeeks] = useState(15)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')

  // Detail view states
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loadingInstallments, setLoadingInstallments] = useState(false)

  // Print Pagaré State
  const [printLoanId, setPrintLoanId] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch loans, clients, and tenant name
  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsGlobalAdmin(user.app_metadata?.is_global_admin === true)
        if (user.app_metadata?.tenant_id) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', user.app_metadata.tenant_id)
            .single()
          if (tenant) {
            setTenantName(tenant.name)
          }
        }
      }

      // Fetch loans with clients and aval addresses
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select(`
          *,
          client:client_id(first_name, last_name, address, qr_code_identifier),
          aval:aval_id(first_name, last_name, address)
        `)
        .order('created_at', { ascending: false })

      if (loansError) throw loansError
      setLoans(loansData || [])

      // Fetch clients list for the creation dropdowns
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, first_name, last_name')
        .order('last_name', { ascending: true })

      if (clientsError) throw clientsError
      setClients(clientsData || [])
    } catch (err: any) {
      console.error('Error fetching loans data:', err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  const handleDeleteLoan = async (loanId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este préstamo? Esta acción eliminará permanentemente el contrato de préstamo, todas sus cuotas y los pagos asociados.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId)

      if (error) throw error

      // Refresh list
      fetchInitialData()
      
      // Close details if active
      if (activeLoanId === loanId) {
        setActiveLoanId(null)
      }
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al eliminar el préstamo.')
    }
  }

  // Recalculate interest and total when principal or rate change
  // BUT allow manual override of totalToPay and interestAmount
  useEffect(() => {
    const calcInterest = Math.round((principal * (interestRate / 100)) * 100) / 100
    setInterestAmount(calcInterest)
    setTotalToPay(principal + calcInterest)
  }, [principal, interestRate])

  // Fetch installments when viewing details
  const fetchInstallments = async (loanId: string) => {
    if (activeLoanId === loanId) {
      setActiveLoanId(null)
      return
    }
    setActiveLoanId(loanId)
    setLoadingInstallments(true)
    try {
      const { data, error } = await supabase
        .from('installments')
        .select('*')
        .eq('loan_id', loanId)
        .order('installment_number', { ascending: true })

      if (error) throw error
      setInstallments(data || [])
    } catch (err: any) {
      console.error('Error fetching installments:', err.message)
    } finally {
      setLoadingInstallments(false)
    }
  }

  // Handle loan creation using our RPC trigger
  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientId) {
      setModalError('Debes seleccionar un cliente.')
      return
    }
    
    // Validate Aval is distinct from borrower if configured
    if (selectedClientId === selectedAvalId) {
      setModalError('El co-deudor (aval) no puede ser la misma persona que el prestatario.')
      return
    }

    setSubmitting(true)
    setModalError('')

    try {
      // Since database generates first installment at p_start_date + 7 days,
      // we shift p_start_date back by 7 days so that the first installment is due EXACTLY on startDate.
      const dateObj = new Date(startDate + 'T00:00:00')
      dateObj.setDate(dateObj.getDate() - 7)
      const rpcStartDate = dateObj.toISOString().split('T')[0]

      // Call create_loan_with_installments database function
      const { data: loanId, error } = await supabase.rpc('create_loan_with_installments', {
        p_client_id: selectedClientId,
        p_aval_id: selectedAvalId || null,
        p_principal_amount: principal,
        p_interest_amount: interestAmount,
        p_total_to_pay: totalToPay,
        p_term_weeks: termWeeks,
        p_payment_frequency: 'weekly',
        p_start_date: rpcStartDate
      })

      if (error) throw error

      // Success
      setIsModalOpen(false)
      setSelectedClientId('')
      setSelectedAvalId('')
      setPrincipal(1000)
      setInterestRate(20)
      setTermWeeks(15)
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setStartDate(d.toISOString().split('T')[0])
      
      // Auto open print pagare modal
      setPrintLoanId(loanId)
      
      // Refresh
      fetchInitialData()
    } catch (err: any) {
      console.error(err)
      setModalError(err.message || 'Ocurrió un error al registrar el préstamo.')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: Loan['status']) => {
    switch (status) {
      case 'active':
        return 'bg-info-bg border-info-border text-info'
      case 'paid':
        return 'bg-success-bg border-success-border text-success'
      case 'defaulted':
        return 'bg-danger-bg border-danger-border text-danger'
      default:
        return 'bg-secondary border-border text-muted-foreground'
    }
  }

  const getStatusLabel = (status: Loan['status']) => {
    switch (status) {
      case 'active':
        return 'Activo'
      case 'paid':
        return 'Pagado'
      case 'defaulted':
        return 'Atrasado'
      default:
        return 'Borrador'
    }
  }

  const filteredLoans = loans.filter(l => {
    const clientName = `${l.client?.first_name} ${l.client?.last_name}`.toLowerCase()
    return clientName.includes(search.toLowerCase())
  })

  // Selected loan details to print Pagaré
  const printLoan = loans.find(l => l.id === printLoanId)

  return (
    <div className="space-y-6">
      
      {/* Hide dashboard list entirely when print mode is active to prevent overlapping */}
      <div className={printLoanId ? 'no-print hidden' : 'space-y-6'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <FileText className="h-7 w-7 text-primary" />
              Contratos de Préstamos
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Crea financiamientos, visualiza calendarios de cobro y revisa el estatus de amortización.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer text-sm shrink-0"
          >
            <Plus className="h-5 w-5" />
            Registrar Préstamo
          </button>
        </div>

        {/* Filter/Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Buscar préstamos por nombre del cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl text-white placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
            />
          </div>
        </div>

        {/* Loans List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Obteniendo contratos de préstamos...</span>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="glass-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-1">Sin préstamos</h3>
            <p className="text-sm max-w-md mx-auto">
              {search ? 'No se encontraron contratos para el cliente especificado.' : 'Aún no has registrado ningún préstamo en el sistema. Registra uno arriba.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoans.map((loan) => (
              <div key={loan.id} className="glass-card rounded-2xl border border-border overflow-hidden">
                {/* Primary Panel Row */}
                <div 
                  onClick={() => fetchInstallments(loan.id)}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-secondary text-primary border border-border shrink-0">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">
                        {loan.client?.first_name} {loan.client?.last_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getStatusColor(loan.status)}`}>
                          {getStatusLabel(loan.status)}
                        </span>
                        {loan.aval && (
                          <span className="text-[11px] text-muted-foreground">
                            Aval: {loan.aval.first_name} {loan.aval.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-center lg:text-right shrink-0">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Financiado</p>
                      <p className="text-sm font-bold text-white">${Number(loan.principal_amount).toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Interés</p>
                      <p className="text-sm font-semibold text-primary">${Number(loan.interest_amount).toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Monto Total</p>
                      <p className="text-sm font-bold text-white">${Number(loan.total_to_pay).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 border-border pt-3 lg:pt-0">
                    <div className="text-left lg:text-right">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Estructura</p>
                      <p className="text-xs text-white font-medium">{loan.term_weeks} pagos semanales</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintLoanId(loan.id);
                        }}
                        className="flex items-center gap-1.5 py-2 px-3 bg-secondary hover:bg-muted text-xs font-semibold text-white rounded-lg border border-border transition-colors cursor-pointer shrink-0"
                      >
                        <Printer className="h-4.5 w-4.5 text-primary" />
                        Ver Pagaré
                      </button>

                      {isGlobalAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLoan(loan.id);
                          }}
                          className="flex items-center gap-1.5 py-2 px-2.5 bg-danger-bg hover:bg-danger text-danger hover:text-white text-xs font-semibold rounded-lg border border-danger-border transition-colors cursor-pointer shrink-0"
                          title="Eliminar préstamo (Superusuario)"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Installments Expandable Amortization Schedule */}
                {activeLoanId === loan.id && (
                  <div className="bg-black/25 border-t border-border p-5">
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Tabla de Amortización</h4>
                    
                    {loadingInstallments ? (
                      <div className="flex justify-center py-6">
                        <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-muted-foreground">
                          <thead className="bg-secondary text-white font-semibold">
                            <tr>
                              <th className="px-4 py-2.5 rounded-l-lg">Pago #</th>
                              <th className="px-4 py-2.5">Vencimiento</th>
                              <th className="px-4 py-2.5 text-right">Monto Cuota</th>
                              <th className="px-4 py-2.5 text-right">Abonado</th>
                              <th className="px-4 py-2.5 text-right">Multa Activa</th>
                              <th className="px-4 py-2.5">Estatus</th>
                              <th className="px-4 py-2.5 rounded-r-lg">Fecha Pago</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {installments.map((inst) => (
                              <tr key={inst.id} className="hover:bg-muted/5">
                                <td className="px-4 py-2.5 font-semibold text-white">#{inst.installment_number}</td>
                                <td className="px-4 py-2.5">{formatLocalDateString(inst.due_date)}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-white">${Number(inst.amount_due).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right text-emerald-500">${Number(inst.amount_paid).toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right text-danger font-medium">${Number(inst.fine_amount).toFixed(2)}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold ${
                                    inst.status === 'paid' ? 'bg-success-bg border-success-border text-success' :
                                    inst.status === 'partially_paid' ? 'bg-warning-bg border-warning-border text-warning' :
                                    inst.status === 'late' ? 'bg-danger-bg border-danger-border text-danger' :
                                    'bg-secondary border-border text-muted-foreground'
                                  }`}>
                                    {inst.status === 'paid' ? 'Pagado' : inst.status === 'partially_paid' ? 'Abono Parcial' : inst.status === 'late' ? 'Vencido' : 'Pendiente'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {inst.paid_at ? new Date(inst.paid_at).toLocaleDateString() : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE LOAN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto no-print">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 relative my-4 max-h-[90vh] md:max-h-[85vh] flex flex-col">
            <button 
              onClick={() => {
                setIsModalOpen(false)
              }}
              className="absolute top-4 right-4 p-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-lg transition-colors cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="shrink-0 mb-4 pr-8">
              <h3 className="text-xl font-bold text-white">Crear Nuevo Préstamo</h3>
              <p className="text-sm text-muted-foreground mt-1">Asigna un plan de financiamiento a un prestatario.</p>
            </div>

            {modalError && (
              <div className="mb-4 p-4 bg-danger-bg border border-danger-border text-danger text-sm rounded-xl flex gap-2 shrink-0">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLoan} className="space-y-4 overflow-y-auto flex-1 pr-1 scrollbar-thin">
              {/* Searchable Borrower Select */}
              <SearchableSelect
                label="Cliente (Prestatario)"
                placeholder="Escribe el nombre del cliente a buscar..."
                options={clients.map(c => ({ id: c.id, name: `${c.last_name}, ${c.first_name}` }))}
                value={selectedClientId}
                onChange={setSelectedClientId}
              />

              {/* Searchable Aval Select */}
              <SearchableSelect
                label="Co-deudor / Aval"
                placeholder="Escribe el nombre del aval a buscar..."
                options={clients.map(c => ({ id: c.id, name: `${c.last_name}, ${c.first_name}` }))}
                value={selectedAvalId}
                onChange={setSelectedAvalId}
              />

              {/* Financial calculations */}
              <div className="border border-border rounded-xl p-4 bg-secondary space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cálculo de Interés y Montos</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Monto Recibido ($)</label>
                    <input
                      type="number"
                      required
                      min="100"
                      value={principal}
                      onChange={(e) => setPrincipal(Number(e.target.value))}
                      className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-0.5">
                      Tasa sugerida (%)
                      <Percent className="h-2.5 w-2.5" />
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Interés a Pagar ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={interestAmount}
                      onChange={(e) => {
                        setInterestAmount(Number(e.target.value))
                        setTotalToPay(principal + Number(e.target.value))
                      }}
                      className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white uppercase">Monto Total a Cobrar ($)</label>
                    <input
                      type="number"
                      required
                      min="100"
                      value={totalToPay}
                      onChange={(e) => {
                        setTotalToPay(Number(e.target.value))
                        setInterestAmount(Number(e.target.value) - principal)
                      }}
                      className="block w-full px-3 py-1.5 bg-muted border border-primary/40 rounded-xl text-white font-bold text-sm bg-primary/10 border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Term & Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Plazo (Semanas)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="104"
                    value={termWeeks}
                    onChange={(e) => setTermWeeks(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white text-sm"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Fecha del Primer Pago
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full px-3 py-2 bg-muted border border-border rounded-xl text-white text-sm"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    La primera cuota vencerá exactamente en esta fecha.
                  </span>
                </div>
              </div>

              <div className="text-center p-3 bg-secondary/50 rounded-xl text-xs text-muted-foreground mt-4">
                El prestatario pagará <strong className="text-white">${Math.round((totalToPay / termWeeks) * 100) / 100}</strong> semanales por {termWeeks} semanas.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group text-sm mt-6"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generando contrato e intereses...
                  </span>
                ) : (
                  <>
                    Activar y Generar Pagaré
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AUTOMATIC PRINTABLE PAGARÉ MODAL */}
      {printLoanId && printLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto print:bg-white print:p-0">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 md:p-8 relative print:border-none print:shadow-none print:bg-white print:text-black print:max-w-none print:p-0 my-4 md:my-8 flex flex-col max-h-[90vh] md:max-h-[85vh]">
            
            {/* Control Panel (Hidden during printing) */}
            <div className="flex justify-between items-center mb-4 border-b border-border pb-4 no-print shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-base md:text-lg font-bold text-white">Impresión del Pagaré</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="py-1.5 px-3 md:py-2 md:px-4 bg-primary hover:bg-primary-hover text-white text-[11px] md:text-xs font-bold rounded-xl cursor-pointer shadow-md flex items-center gap-1"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
                <button
                  onClick={() => setPrintLoanId(null)}
                  className="py-1.5 px-3 md:py-2 md:px-4 bg-secondary hover:bg-muted text-white text-[11px] md:text-xs font-bold rounded-xl border border-border cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Legal Document Container */}
            <div className="space-y-4 md:space-y-6 text-xs text-muted-foreground leading-relaxed print:text-black print:text-[11px] print:leading-relaxed bg-black/10 p-4 md:p-6 rounded-xl border border-border/30 print:border-none print:bg-transparent print:p-0 overflow-y-auto flex-1 pr-1.5 md:pr-2 print:overflow-visible print:pr-0 scrollbar-thin">
              
              {/* Header Title / Money amount */}
              <div className="flex justify-between items-start border-b border-border/60 pb-3 print:border-black gap-4">
                <div>
                  <h4 className="text-lg md:text-xl font-black text-white print:text-black tracking-tight">PAGARÉ</h4>
                  <span className="text-[10px] text-muted-foreground print:text-black">CONTRATO DE CRÉDITO # {printLoan.id.slice(0,8).toUpperCase()}</span>
                  
                  {printLoan.client.qr_code_identifier && (
                    <div className="mt-2.5 flex items-center gap-2 bg-secondary/35 border border-border/40 p-1 rounded-lg w-fit print:border-none print:bg-transparent print:p-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&color=0f172a&data=${printLoan.client.qr_code_identifier}`}
                        alt="QR Code"
                        className="w-8 h-8 md:w-10 md:h-10 print:w-12 print:h-12 bg-white p-0.5 rounded border border-gray-150 shrink-0"
                      />
                      <div className="text-[8px] md:text-[9px] font-mono leading-tight print:text-black">
                        <p className="font-bold">FICHADO QR</p>
                        <p className="text-muted-foreground print:text-black mt-0.5">{printLoan.client.qr_code_identifier}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs md:text-sm font-black text-white print:text-black bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg print:border-none print:bg-transparent print:p-0">
                    BUENO POR: ${Number(printLoan.total_to_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })} MXN
                  </p>
                  <span className="text-[9px] block text-muted-foreground mt-1 print:text-black">
                    Suscrito en: México, a {new Date(printLoan.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Legal Text Body */}
              <p className="text-white/80 text-justify leading-relaxed print:text-black text-[11px] md:text-xs">
                Por medio de este pagaré, el suscrito <strong className="text-white print:text-black">{printLoan.client.first_name} {printLoan.client.last_name}</strong> prometo y me obligo a pagar incondicionalmente por este Pagaré a la orden de <strong className="text-white print:text-black">{tenantName}</strong>, en su domicilio, la cantidad total de <strong className="text-white print:text-black">${Number(printLoan.total_to_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })} MXN</strong> (con principal de ${Number(printLoan.principal_amount).toLocaleString()} MXN más cargos de financiamiento acordados).
              </p>
              
              <p className="text-white/80 text-justify leading-relaxed print:text-black text-[11px] md:text-xs">
                Dicha cantidad se liquidará mediante <strong className="text-white print:text-black">{printLoan.term_weeks} pagos semanales obligatorios</strong> de <strong className="text-white print:text-black">${Number(printLoan.total_to_pay / printLoan.term_weeks).toFixed(2)} MXN</strong> cada uno, comenzando a amortizar el día <strong className="text-white print:text-black">{getFirstPaymentDateString(printLoan.start_date)}</strong> y venciendo en su totalidad a más tardar el día <strong className="text-white print:text-black">{formatLocalDateString(printLoan.end_date)}</strong>. La falta de pago oportuno de cualquiera de las cuotas devengará un interés moratorio del cobro fijado en las políticas vigentes de la institución.
              </p>

              {/* Signatures & Co-deudor layout */}
              <div className="grid grid-cols-2 gap-4 md:gap-8 pt-4 border-t border-border/40 print:border-black">
                
                {/* Borrower details & signature line */}
                <div className="space-y-3">
                  <h5 className="font-bold text-white print:text-black uppercase text-[10px]">Deudor Principal</h5>
                  <div className="text-[10px] space-y-1">
                    <p><strong className="text-white print:text-black">Nombre:</strong> {printLoan.client.first_name} {printLoan.client.last_name}</p>
                    <p><strong className="text-white print:text-black">Dirección:</strong> {printLoan.client.address}</p>
                  </div>
                  <div className="h-12 md:h-16 border-b border-dashed border-border/50 print:border-black" />
                  <p className="text-center text-[9px] text-muted-foreground/60 print:text-black">Firma del Prestatario</p>
                </div>

                {/* Co-deudor details & signature line */}
                <div className="space-y-3">
                  <h5 className="font-bold text-white print:text-black uppercase text-[10px]">Aval (Co-deudor Solidario)</h5>
                  {printLoan.aval ? (
                    <>
                      <div className="text-[10px] space-y-1">
                        <p><strong className="text-white print:text-black">Nombre:</strong> {printLoan.aval.first_name} {printLoan.aval.last_name}</p>
                        <p><strong className="text-white print:text-black">Dirección:</strong> {printLoan.aval.address}</p>
                      </div>
                      <div className="h-12 md:h-16 border-b border-dashed border-border/50 print:border-black" />
                      <p className="text-center text-[9px] text-muted-foreground/60 print:text-black">Firma del Aval</p>
                    </>
                  ) : (
                    <div className="h-full min-h-[110px] flex items-center justify-center border border-dashed border-border/40 rounded-xl p-4 text-[10px] italic">
                      Sin Aval Solidario Registrado
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
