'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  Mail, 
  QrCode, 
  FileText, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  ArrowRight,
  Pencil
} from 'lucide-react'

interface Client {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  address: string
  qr_code_identifier: string
  ine_front_url: string
  ine_back_url: string
  address_proof_url: string
  created_at: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState<string | null>(null)
  
  // Registration modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [ineFront, setIneFront] = useState<File | null>(null)
  const [ineBack, setIneBack] = useState<File | null>(null)
  const [addressProof, setAddressProof] = useState<File | null>(null)
  const [registering, setRegistering] = useState(false)
  const [modalError, setModalError] = useState('')

  // View client details state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [qrModalClient, setQrModalClient] = useState<Client | null>(null)
  const [signedUrls, setSignedUrls] = useState<{ [key: string]: string }>({})
  const [loadingDocs, setLoadingDocs] = useState(false)

  const openRegisterModal = () => {
    setEditingClient(null)
    setFirstName('')
    setLastName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setIneFront(null)
    setIneBack(null)
    setAddressProof(null)
    setModalError('')
    setIsModalOpen(true)
  }

  const openEditModal = (client: Client) => {
    setEditingClient(client)
    setFirstName(client.first_name)
    setLastName(client.last_name)
    setPhone(client.phone)
    setEmail(client.email || '')
    setAddress(client.address)
    setIneFront(null)
    setIneBack(null)
    setAddressProof(null)
    setModalError('')
    setIsModalOpen(true)
  }

  const supabase = createClient()

  // Fetch current user tenant info
  useEffect(() => {
    async function getTenant() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setTenantId(user.app_metadata?.tenant_id || null)
      }
    }
    getTenant()
  }, [supabase])

  // Fetch clients from database
  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(data || [])
    } catch (err: any) {
      console.error('Error fetching clients:', err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Fetch signed URLs for viewing document uploads securely
  const fetchClientDocuments = async (client: Client) => {
    if (!tenantId) return
    setLoadingDocs(true)
    setSelectedClient(client)
    setSignedUrls({})

    try {
      const urlsToFetch = []
      if (client.ine_front_url) urlsToFetch.push({ key: 'ine_front', path: client.ine_front_url })
      if (client.ine_back_url) urlsToFetch.push({ key: 'ine_back', path: client.ine_back_url })
      if (client.address_proof_url) urlsToFetch.push({ key: 'address_proof', path: client.address_proof_url })

      const newUrls: { [key: string]: string } = {}
      for (const doc of urlsToFetch) {
        const { data, error } = await supabase.storage
          .from('client-documents')
          .createSignedUrl(doc.path, 60 * 15) // valid for 15 mins
        
        if (error) {
          console.error(`Error signing URL for ${doc.key}:`, error.message)
        } else if (data) {
          newUrls[doc.key] = data.signedUrl
        }
      }
      setSignedUrls(newUrls)
    } catch (err) {
      console.error('Error getting documents:', err)
    } finally {
      setLoadingDocs(false)
    }
  }

  // Handle client registration and file upload in sequence
  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return
    setRegistering(true)
    setModalError('')

    try {
      let clientId: string

      if (editingClient) {
        // Update client record
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone,
            email: email || null,
            address
          })
          .eq('id', editingClient.id)

        if (updateError) throw updateError
        clientId = editingClient.id
      } else {
        // 1. Generate unique QR Code identifier C-XXXXXX (sparse alphanumeric for fast scanning)
        const uniqueQR = 'C-' + Math.random().toString(36).substring(2, 8).toUpperCase()

        // 2. Insert Client record
        const { data: newClient, error: insertError } = await supabase
          .from('clients')
          .insert({
            tenant_id: tenantId,
            first_name: firstName,
            last_name: lastName,
            phone,
            email: email || null,
            address,
            qr_code_identifier: uniqueQR
          })
          .select()
          .single()

        if (insertError) throw insertError
        clientId = newClient.id
      }

      // 3. Upload files to Storage if present
      const updates: Partial<Client> = {}

      const uploadFile = async (file: File, fileType: string) => {
        const extension = file.name.split('.').pop()
        const path = `${tenantId}/${clientId}/${fileType}_${Date.now()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('client-documents')
          .upload(path, file)
        
        if (uploadError) throw uploadError
        return path
      }

      if (ineFront) {
        updates.ine_front_url = await uploadFile(ineFront, 'ine_front')
      }
      if (ineBack) {
        updates.ine_back_url = await uploadFile(ineBack, 'ine_back')
      }
      if (addressProof) {
        updates.address_proof_url = await uploadFile(addressProof, 'address_proof')
      }

      // 4. Update Client record with file URLs
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', clientId)

        if (updateError) throw updateError
      }

      // Success
      setIsModalOpen(false)
      // Reset form fields
      setFirstName('')
      setLastName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setIneFront(null)
      setIneBack(null)
      setAddressProof(null)
      setEditingClient(null)
      
      // Refresh list
      fetchClients()
    } catch (err: any) {
      console.error(err)
      setModalError(err.message || 'Error al guardar el cliente o subir documentos.')
    } finally {
      setRegistering(false)
    }
  }

  // Filter clients dynamically in search bar
  const filteredClients = clients.filter(c => {
    const query = search.toLowerCase()
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(query) ||
      (c.phone && c.phone.includes(query)) ||
      (c.qr_code_identifier && c.qr_code_identifier.toLowerCase().includes(query))
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            Directorio de Clientes
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Administra los datos personales, INE y avales de tus prestatarios.
          </p>
        </div>
        <button
          onClick={openRegisterModal}
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer text-sm shrink-0"
        >
          <Plus className="h-5 w-5" />
          Registrar Cliente
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o código QR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl text-white placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
          />
        </div>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
          <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Cargando directorio...</span>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="glass-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">Sin clientes</h3>
          <p className="text-sm max-w-md mx-auto">
            {search ? 'No se encontraron clientes que coincidan con la búsqueda.' : 'Aún no has registrado ningún cliente. Haz clic en el botón de arriba para comenzar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div key={client.id} className="glass-card rounded-2xl border border-border p-6 glass-card-hover flex flex-col justify-between">
              <div>
                {/* Header Name & QR Code */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {client.first_name} {client.last_name}
                    </h3>
                    <button
                      onClick={() => setQrModalClient(client)}
                      className="flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-secondary hover:bg-muted border border-border w-fit text-[10px] font-semibold text-primary cursor-pointer transition-colors"
                      title="Ver Tarjeta de Pago QR"
                    >
                      <QrCode className="h-3 w-3" />
                      {client.qr_code_identifier || 'Sin código'}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => openEditModal(client)}
                      className="p-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-xl border border-border transition-colors cursor-pointer"
                      title="Editar cliente"
                    >
                      <Pencil className="h-4.5 w-4.5" />
                    </button>
                    <button 
                      onClick={() => fetchClientDocuments(client)}
                      className="p-2 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-xl border border-border transition-colors cursor-pointer"
                      title="Ver documentación"
                    >
                      <Eye className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2.5 text-sm text-muted-foreground mt-4">
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    <span>{client.phone || 'Sin teléfono'}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{client.address}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-6 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                  { (client.ine_front_url && client.ine_back_url && client.address_proof_url) ? 'Documentos completos' : 'Documentos incompletos' }
                </span>
                <span>Reg: {new Date(client.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 relative my-4 max-h-[90vh] flex flex-col">
            <button 
              onClick={() => {
                setIsModalOpen(false)
                setEditingClient(null)
              }}
              className="absolute top-4 right-4 p-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-lg transition-colors cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="shrink-0 mb-4 pr-8">
              <h3 className="text-xl font-bold text-white">
                {editingClient ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingClient ? 'Modifica los datos del cliente o actualiza sus documentos.' : 'Completa los datos del cliente y sube su papelería legal.'}
              </p>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-danger-bg border border-danger-border text-danger text-xs rounded-xl flex gap-2 shrink-0">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterClient} className="space-y-3.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nombre(s)</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs"
                    placeholder="Ej: Juan"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs"
                    placeholder="Ej: Pérez"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Teléfono (Celular)</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs"
                    placeholder="Ej: 5512345678"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email (Opcional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Domicilio Completo</label>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="block w-full px-3 py-1.5 bg-muted border border-border rounded-xl text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs resize-none"
                  placeholder="Calle, Número, Colonia, Municipio, Código Postal"
                />
              </div>

              {/* Document uploads */}
              <div className="border-t border-border pt-3 space-y-2.5">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Documentación Legal (Opcional)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* INE Front */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-secondary rounded-xl border border-border min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-white truncate">INE Frente</p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {ineFront ? ineFront.name : 'No seleccionado'}
                      </p>
                    </div>
                    <label className="flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-border text-[10px] font-semibold text-white rounded-lg border border-border cursor-pointer transition-colors shrink-0">
                      <Upload className="h-3 w-3" />
                      Subir
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setIneFront(e.target.files?.[0] || null)}
                        className="hidden" 
                      />
                    </label>
                  </div>

                  {/* INE Back */}
                  <div className="flex items-center justify-between gap-2 p-2.5 bg-secondary rounded-xl border border-border min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-white truncate">INE Reverso</p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {ineBack ? ineBack.name : 'No seleccionado'}
                      </p>
                    </div>
                    <label className="flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-border text-[10px] font-semibold text-white rounded-lg border border-border cursor-pointer transition-colors shrink-0">
                      <Upload className="h-3 w-3" />
                      Subir
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setIneBack(e.target.files?.[0] || null)}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {/* Proof of Address */}
                <div className="flex items-center justify-between gap-2 p-2.5 bg-secondary rounded-xl border border-border min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-white truncate">Comprobante de Domicilio</p>
                    <p className="text-[9px] text-muted-foreground truncate">
                      {addressProof ? addressProof.name : 'No seleccionado'}
                    </p>
                  </div>
                  <label className="flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-border text-[10px] font-semibold text-white rounded-lg border border-border cursor-pointer transition-colors shrink-0">
                    <Upload className="h-3 w-3" />
                    Subir
                    <input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={(e) => setAddressProof(e.target.files?.[0] || null)}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary hover:bg-primary-hover text-white font-medium rounded-xl shadow-lg hover:shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group text-xs mt-4 shrink-0"
              >
                {registering ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Procesando registro...
                  </span>
                ) : (
                  <>
                    {editingClient ? 'Guardar Cambios' : 'Crear Expediente de Cliente'}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT VIEWER MODAL */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative max-h-[90vh] md:max-h-[85vh] flex flex-col">
            <button 
              onClick={() => setSelectedClient(null)}
              className="absolute top-4 right-4 p-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-lg transition-colors cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="shrink-0 mb-4 pr-8">
              <h3 className="text-xl font-bold text-white mb-1">
                Documentación de {selectedClient.first_name} {selectedClient.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">Expediente digital del cliente.</p>
            </div>

            {loadingDocs ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4 shrink-0">
                <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Generando accesos seguros a documentos...</span>
              </div>
            ) : Object.keys(signedUrls).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground shrink-0">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm">Este cliente no cuenta con ningún archivo digitalizado cargado aún.</p>
              </div>
            ) : (
              <div className="space-y-6 overflow-y-auto flex-1 pr-2 scrollbar-thin">
                {Object.entries(signedUrls).map(([key, url]) => (
                  <div key={key} className="border border-border rounded-xl p-4 bg-secondary">
                    <h4 className="text-xs font-semibold text-white uppercase mb-3 flex items-center justify-between">
                      <span>
                        {key === 'ine_front' ? 'INE Frente' : key === 'ine_back' ? 'INE Reverso' : 'Comprobante de Domicilio'}
                      </span>
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline hover:text-primary-hover font-normal"
                      >
                        Abrir pantalla completa
                      </a>
                    </h4>
                    
                    {url.includes('.pdf') ? (
                      <div className="h-96 w-full rounded-lg bg-background flex items-center justify-center border border-border">
                        <embed src={url} type="application/pdf" className="w-full h-full rounded-lg" />
                      </div>
                    ) : (
                      <div className="relative max-h-96 w-full overflow-hidden rounded-lg bg-background border border-border flex items-center justify-center p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={url} 
                          alt="Documento" 
                          className="max-h-80 max-w-full rounded object-contain" 
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {qrModalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl p-6 relative text-center">
            <button 
              onClick={() => setQrModalClient(null)}
              className="absolute top-4 right-4 p-1.5 bg-secondary hover:bg-muted text-muted-foreground hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">Tarjeta de Pago QR</h3>
            <p className="text-xs text-muted-foreground mb-6">Muestra o imprime este código para cobros rápidos.</p>

            {/* QR Card Frame */}
            <div className="bg-white p-5 rounded-2xl w-fit mx-auto border border-gray-200 shadow-inner flex flex-col items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=0f172a&data=${qrModalClient.qr_code_identifier}`}
                alt={`QR ${qrModalClient.qr_code_identifier}`}
                className="w-44 h-44 bg-white"
              />
              <span className="text-slate-900 font-mono font-bold text-sm mt-3 tracking-wider">
                {qrModalClient.qr_code_identifier}
              </span>
            </div>

            <div className="mt-6 text-xs text-muted-foreground">
              <p className="font-bold text-white text-sm mb-1">{qrModalClient.first_name} {qrModalClient.last_name}</p>
              <p>Escanea esta tarjeta en la pantalla de Cobro Rápido para registrar abonos.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
