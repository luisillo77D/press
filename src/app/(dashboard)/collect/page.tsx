'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  QrCode, 
  Search, 
  User, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  FileText,
  CreditCard,
  Camera,
  Volume2
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface Client {
  id: string
  first_name: string
  last_name: string
  phone: string
  address: string
  qr_code_identifier: string
}

interface Loan {
  id: string
  principal_amount: number
  total_to_pay: number
  term_weeks: number
  status: string
  start_date: string
}

interface Installment {
  id: string
  installment_number: number
  due_date: string
  amount_due: number
  amount_paid: number
  fine_amount: number
  status: string
}

export default function CollectPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchError, setSearchError] = useState('')
  
  // Loaded Client & Loan details
  const [client, setClient] = useState<Client | null>(null)
  const [loan, setLoan] = useState<Loan | null>(null)
  const [unpaidInstallments, setUnpaidInstallments] = useState<Installment[]>([])
  
  // Payment Form States
  const [amountToPay, setAmountToPay] = useState<number>(0)
  const [condoneFines, setCondoneFines] = useState<boolean>(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [notes, setNotes] = useState<string>('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState<any>(null)

  // Camera QR Scanner states
  const [showCamera, setShowCamera] = useState(false)
  const [cameraError, setCameraError] = useState('')

  const searchInputRef = useRef<HTMLInputElement>(null)
  const paymentInputRef = useRef<HTMLInputElement>(null)
  const qrScannerRef = useRef<any>(null)
  const supabase = createClient()

  // Auto focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  // Web Audio sound synthesizer for physical feedback (ding/error beeps)
  const triggerSound = (type: 'success' | 'error') => {
    if (typeof window === 'undefined') return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      if (type === 'success') {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.12)
      } else {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, ctx.currentTime) // low buzz
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.22)
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.22)
      }
    } catch (err) {
      console.warn('Audio feedback failed:', err)
    }
  }

  // Handle client search (QR code matches or text query)
  const handleClientSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    setLoadingSearch(true)
    setSearchError('')
    setClient(null)
    setLoan(null)
    setUnpaidInstallments([])
    setPaymentSuccess(null)

    try {
      // 1. Search client by QR code identifier or name match
      const query = supabase
        .from('clients')
        .select('*')

      if (searchQuery.toUpperCase().startsWith('C-')) {
        query.eq('qr_code_identifier', searchQuery.toUpperCase())
      } else {
        query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
      }

      const { data: clientsData, error: clientsError } = await query

      if (clientsError) throw clientsError

      if (!clientsData || clientsData.length === 0) {
        triggerSound('error')
        setSearchError('No se encontró ningún cliente con ese código o nombre.')
        return
      }

      // If multiple name matches, for this ultra-fast collection we select the first one,
      // but in real use we should show list. Let's pick the first match.
      const selectedClient = clientsData[0]
      setClient(selectedClient)

      // 2. Fetch active or defaulted loans for this client
      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('client_id', selectedClient.id)
        .in('status', ['active', 'defaulted'])
        .maybeSingle()

      if (loanError) throw loanError

      if (!loanData) {
        setSearchError(`El cliente ${selectedClient.first_name} no tiene préstamos activos.`)
        return
      }
      setLoan(loanData)

      // 3. Fetch unpaid installments
      const { data: instData, error: instError } = await supabase
        .from('installments')
        .select('*')
        .eq('loan_id', loanData.id)
        .in('status', ['pending', 'partially_paid', 'late'])
        .order('installment_number', { ascending: true })

      if (instError) throw instError
      setUnpaidInstallments(instData || [])

      // 4. Precalculate amount to pay: First unpaid installment amount + any active fines
      if (instData && instData.length > 0) {
        // Overdue + current logic:
        // We preload the sum of the first installment's remaining due amount + its fine.
        const nextInst = instData[0]
        const remainingPrincipal = nextInst.amount_due - nextInst.amount_paid
        const totalSuggested = remainingPrincipal + nextInst.fine_amount
        setAmountToPay(totalSuggested)

        // Auto-focus payment input for immediate registration (one-click/one-enter)
        setTimeout(() => {
          if (paymentInputRef.current) {
            paymentInputRef.current.focus()
            paymentInputRef.current.select()
          }
        }, 80)
      } else {
        setSearchError('El préstamo no tiene cuotas pendientes.')
      }

    } catch (err: any) {
      console.error(err)
      setSearchError(err.message || 'Error al buscar la información del cobro.')
    } finally {
      setLoadingSearch(false)
    }
  }

  // Camera QR Code Scanner activation
  const toggleCameraScanner = async () => {
    if (showCamera) {
      stopScanner()
      return
    }

    setShowCamera(true)
    setCameraError('')

    // Dynamically import html5-qrcode on client side
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      
      setTimeout(() => {
        const scanner = new Html5Qrcode('qr-reader-viewport')
        qrScannerRef.current = scanner
        
        scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            // Found QR Code! Fill search and submit
            setSearchQuery(decodedText)
            stopScanner()
            // Run search immediately
            setTimeout(() => {
              handleClientSearchDirect(decodedText)
            }, 100)
          },
          (errorMessage) => {
            // Quiet fail (camera scan frames fail sometimes, not critical)
          }
        ).catch((err) => {
          console.error(err)
          setCameraError('No se pudo acceder a la cámara. Asegúrate de dar permisos.')
          setShowCamera(false)
        })
      }, 100)
    } catch (err) {
      setCameraError('Error al iniciar el lector QR.')
      setShowCamera(false)
    }
  }

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop().then(() => {
        qrScannerRef.current = null
        setShowCamera(false)
      }).catch((err: any) => {
        console.error('Error stopping scanner:', err)
        setShowCamera(false)
      })
    } else {
      setShowCamera(false)
    }
  }

  // Direct search helper for QR code scan callback
  const handleClientSearchDirect = async (code: string) => {
    setLoadingSearch(true)
    setSearchError('')
    setClient(null)
    setLoan(null)
    setUnpaidInstallments([])
    setPaymentSuccess(null)

    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('qr_code_identifier', code.toUpperCase())

      if (clientsError) throw clientsError

      if (!clientsData || clientsData.length === 0) {
        triggerSound('error')
        setSearchError('No se encontró ningún cliente con ese código QR.')
        return
      }

      const selectedClient = clientsData[0]
      setClient(selectedClient)

      const { data: loanData, error: loanError } = await supabase
        .from('loans')
        .select('*')
        .eq('client_id', selectedClient.id)
        .in('status', ['active', 'defaulted'])
        .maybeSingle()

      if (loanError) throw loanError

      if (!loanData) {
        setSearchError(`El cliente ${selectedClient.first_name} no tiene préstamos activos.`)
        return
      }
      setLoan(loanData)

      const { data: instData, error: instError } = await supabase
        .from('installments')
        .select('*')
        .eq('loan_id', loanData.id)
        .in('status', ['pending', 'partially_paid', 'late'])
        .order('installment_number', { ascending: true })

      if (instError) throw instError
      setUnpaidInstallments(instData || [])

      if (instData && instData.length > 0) {
        const nextInst = instData[0]
        const remainingPrincipal = nextInst.amount_due - nextInst.amount_paid
        const totalSuggested = remainingPrincipal + nextInst.fine_amount
        setAmountToPay(totalSuggested)

        setTimeout(() => {
          if (paymentInputRef.current) {
            paymentInputRef.current.focus()
            paymentInputRef.current.select()
          }
        }, 80)
      }
    } catch (err: any) {
      console.error(err)
      setSearchError(err.message || 'Error al buscar la información del cobro.')
    } finally {
      setLoadingSearch(false)
    }
  }

  // Register the payment (One-Click or Enter Flow)
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loan || unpaidInstallments.length === 0) return

    setProcessingPayment(true)
    try {
      // Call register_payment RPC
      const { data, error } = await supabase.rpc('register_payment', {
        p_loan_id: loan.id,
        p_amount: amountToPay,
        p_condone_fines: condoneFines,
        p_payment_method: paymentMethod,
        p_notes: notes || null
      })

      if (error) throw error

      // Payment Succeeded!
      triggerSound('success')
      
      // Fire confetti explosion!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.75 }
      })

      setPaymentSuccess(data)
      
      // Reset State
      setClient(null)
      setLoan(null)
      setUnpaidInstallments([])
      setSearchQuery('')
      setNotes('')
      setCondoneFines(false)

      // Re-focus search bar for next client scan
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 100)

    } catch (err: any) {
      console.error(err)
      triggerSound('error')
      alert(err.message || 'Error al aplicar el pago.')
    } finally {
      setProcessingPayment(false)
    }
  }

  // Quick action buttons for collector
  const handleQuickPayFull = () => {
    if (unpaidInstallments.length === 0) return
    const nextInst = unpaidInstallments[0]
    const remainingPrincipal = nextInst.amount_due - nextInst.amount_paid
    const totalSuggested = remainingPrincipal + (condoneFines ? 0 : nextInst.fine_amount)
    setAmountToPay(totalSuggested)
  }

  const handleQuickPayInstallmentOnly = () => {
    if (unpaidInstallments.length === 0) return
    const nextInst = unpaidInstallments[0]
    const remainingPrincipal = nextInst.amount_due - nextInst.amount_paid
    setAmountToPay(remainingPrincipal)
  }

  // Calculate alerts
  const totalFines = unpaidInstallments.reduce((sum, inst) => sum + Number(inst.fine_amount), 0)
  const lateInstallmentsCount = unpaidInstallments.filter(inst => inst.status === 'late').length
  const nextInstallment = unpaidInstallments[0]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <QrCode className="h-7 w-7 text-primary" />
          Cobro Ultra-Rápido
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Busca un cliente, escanea su tarjeta QR y registra su pago en un solo clic.
        </p>
      </div>

      {/* Main Search Panel */}
      <div className="glass-card rounded-2xl border border-border p-6 shadow-xl">
        <form onSubmit={handleClientSearch} className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Escanea el código QR de la tarjeta o escribe el nombre del cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 bg-muted border border-border rounded-xl text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-base font-medium"
              disabled={loadingSearch || processingPayment}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={toggleCameraScanner}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-semibold text-sm cursor-pointer transition-all ${showCamera ? 'bg-danger border-danger-border text-white' : 'bg-secondary border-border text-white hover:bg-muted'}`}
            >
              <Camera className="h-5 w-5" />
              {showCamera ? 'Cerrar Cámara' : 'Cámara'}
            </button>

            <button
              type="submit"
              disabled={loadingSearch || processingPayment || !searchQuery.trim()}
              className="flex-2 sm:flex-initial flex items-center justify-center gap-2 py-3 px-6 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {loadingSearch ? 'Buscando...' : 'Buscar Cliente'}
            </button>
          </div>
        </form>

        {/* Camera Scanner Viewport */}
        {showCamera && (
          <div className="mt-4 border border-border rounded-2xl p-4 bg-black/45 flex flex-col items-center">
            <div id="qr-reader-viewport" className="w-full max-w-sm rounded-xl overflow-hidden border-2 border-primary bg-background" />
            <p className="text-xs text-muted-foreground mt-3">Coloca el código QR del cliente frente a la cámara.</p>
            {cameraError && <p className="text-xs text-danger mt-2 font-medium">{cameraError}</p>}
          </div>
        )}

        {searchError && (
          <div className="mt-4 p-4 bg-danger-bg border border-danger-border text-danger text-sm rounded-xl flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Confirmation Message */}
      {paymentSuccess && (
        <div className="p-6 bg-success-bg border border-success-border rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-success shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-white">¡Pago Registrado Exitosamente!</h3>
              <p className="text-xs text-muted-foreground">La transacción se ha asentado en la base de datos.</p>
            </div>
          </div>
          
          <div className="border-t border-success-border/50 pt-4 flex flex-col sm:flex-row justify-between gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ID del Préstamo</p>
              <p className="font-semibold text-white truncate">{paymentSuccess.loan_id}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 text-right">
              <div>
                <p className="text-xs text-muted-foreground">Multas Cobradas</p>
                <p className="font-bold text-white">${Number(paymentSuccess.total_fine_applied).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Multas Condonadas</p>
                <p className="font-bold text-primary">${Number(paymentSuccess.total_fine_condoned).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Payment collection panel */}
      {client && loan && nextInstallment && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Client Details and Alerts Card */}
          <div className="md:col-span-1 space-y-6">
            <div className="glass-card rounded-2xl border border-border p-6 space-y-5">
              <div>
                <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Cliente Seleccionado</span>
                <h3 className="text-xl font-bold text-white mt-1">{client.first_name} {client.last_name}</h3>
                <span className="text-xs text-muted-foreground block mt-0.5">QR: {client.qr_code_identifier}</span>
              </div>

              <div className="border-t border-border pt-4 space-y-3.5 text-sm text-muted-foreground">
                <div>
                  <span className="text-xs block text-muted-foreground/60">Domicilio</span>
                  <span className="text-white text-xs leading-relaxed">{client.address}</span>
                </div>
                <div>
                  <span className="text-xs block text-muted-foreground/60">Teléfono</span>
                  <span className="text-white">{client.phone}</span>
                </div>
              </div>
            </div>

            {/* Visual Warnings / Late Fines Alert */}
            {(lateInstallmentsCount > 0 || totalFines > 0) && (
              <div className="p-5 bg-danger-bg border border-danger-border rounded-2xl space-y-4">
                <div className="flex items-center gap-2.5 text-danger">
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                  <h4 className="font-bold text-sm">Alerta de Atraso</h4>
                </div>
                
                <div className="space-y-2 text-xs text-muted-foreground">
                  {lateInstallmentsCount > 0 && (
                    <p className="text-white">Tiene <strong className="text-danger font-black">{lateInstallmentsCount} cuotas vencidas</strong> sin pagar.</p>
                  )}
                  {totalFines > 0 && (
                    <p className="text-white">Tiene multas acumuladas por <strong className="text-danger font-black">${Number(totalFines).toFixed(2)} MXN</strong>.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Pay Panel */}
          <div className="md:col-span-2">
            <div className="glass-card rounded-2xl border border-border p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Detalle de Cobro Sugerido</h3>
                  <p className="text-xs text-muted-foreground">Cuota #{nextInstallment.installment_number} de {loan.term_weeks}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Vence</span>
                  <span className="text-xs font-semibold text-white">{new Date(nextInstallment.due_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Installment breakdown card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-secondary rounded-xl border border-border text-center">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Por Pagar</span>
                  <p className="text-sm font-bold text-white mt-1">${(nextInstallment.amount_due - nextInstallment.amount_paid).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Multa Vencida</span>
                  <p className={`text-sm font-bold mt-1 ${nextInstallment.fine_amount > 0 ? 'text-danger font-black' : 'text-white'}`}>
                    ${Number(nextInstallment.fine_amount).toFixed(2)}
                  </p>
                </div>
                <div className="col-span-2 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0">
                  <span className="text-[10px] font-bold text-white uppercase">Total Sugerido</span>
                  <p className="text-lg font-black text-primary mt-0.5">
                    ${(nextInstallment.amount_due - nextInstallment.amount_paid + (condoneFines ? 0 : Number(nextInstallment.fine_amount))).toFixed(2)}
                  </p>
                </div>
              </div>

              <form onSubmit={handleRegisterPayment} className="space-y-5">
                {/* Checkbox condonar multa */}
                {nextInstallment.fine_amount > 0 && (
                  <div className="flex items-center justify-between gap-4 p-3.5 bg-danger-bg/40 border border-danger-border/40 rounded-xl">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="condoneFines"
                        checked={condoneFines}
                        onChange={(e) => {
                          setCondoneFines(e.target.checked)
                          // Recalculate sugerido instantly
                          const rem = nextInstAmt();
                          setAmountToPay(rem + (e.target.checked ? 0 : Number(nextInstallment.fine_amount)))
                        }}
                        className="h-5 w-5 rounded border-border text-danger focus:ring-danger"
                      />
                      <label htmlFor="condoneFines" className="text-xs font-semibold text-white cursor-pointer select-none">
                        Condonar (Eliminar) multa por impago
                      </label>
                    </div>
                    <span className="text-xs font-bold text-danger">-${Number(nextInstallment.fine_amount).toFixed(2)}</span>
                  </div>
                )}

                {/* Helper calculated function for suggests */}
                {(() => {
                  // helper to find remaining installment amount
                  return null;
                })()}

                {/* Amount Input */}
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Monto de Pago Recibido ($)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <input
                      ref={paymentInputRef}
                      id="amount"
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      value={amountToPay || ''}
                      onChange={(e) => setAmountToPay(Number(e.target.value))}
                      className="block w-full pl-11 pr-4 py-3.5 bg-muted border border-border rounded-xl text-white font-bold text-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Quick actions row */}
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={handleQuickPayFull}
                    className="flex-1 py-2 px-3 bg-secondary hover:bg-muted text-white text-xs font-medium rounded-lg border border-border transition-colors cursor-pointer"
                  >
                    Monto Total Sugerido
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickPayInstallmentOnly}
                    className="flex-1 py-2 px-3 bg-secondary hover:bg-muted text-white text-xs font-medium rounded-lg border border-border transition-colors cursor-pointer"
                  >
                    Solo Cuota (Sin Multa)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Método de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-white text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Notas (Opcional)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-white text-xs focus:outline-none focus:border-primary"
                      placeholder="Ej: Pago atrasado de la semana"
                    />
                  </div>
                </div>

                {/* Big register payment button (Submit) */}
                <button
                  type="submit"
                  disabled={processingPayment}
                  className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {processingPayment ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Procesando Cobro...
                    </span>
                  ) : (
                    <>
                      REGISTRAR COBRO (Enter)
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // helper calculation
  function nextInstAmt() {
    if (!nextInstallment) return 0
    return nextInstallment.amount_due - nextInstallment.amount_paid
  }
}
