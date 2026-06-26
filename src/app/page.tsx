import React from 'react'
import Link from 'next/link'
import { Wallet, Shield, Zap, Sliders, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-white flex flex-col justify-between overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[70%] h-[70%] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Navbar */}
      <header className="max-w-7xl mx-auto w-full px-6 h-20 flex items-center justify-between border-b border-border/40 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Wallet className="h-5.5 w-5.5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">LendSaaS</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-semibold hover:text-primary transition-colors">
            Iniciar Sesión
          </Link>
          <Link href="/signup" className="py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-primary/10">
            Comenzar Gratis
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto w-full px-6 py-12 md:py-24 relative z-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" />
              SaaS Multi-tenant Listo para Operar
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black leading-[1.1] text-gradient">
              Gestión inteligente para prestamistas independientes.
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Administra tu cartera, genera pagarés imprimibles, registra pagos en segundos y reduce la morosidad con políticas RLS y aislamiento total de datos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link 
                href="/signup" 
                className="flex items-center justify-center gap-2 py-3.5 px-6 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg hover:shadow-primary/25 transition-all group cursor-pointer text-sm"
              >
                Crear mi Negocio ahora
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link 
                href="/login" 
                className="flex items-center justify-center gap-2 py-3.5 px-6 bg-secondary hover:bg-muted text-white font-bold rounded-xl border border-border transition-colors cursor-pointer text-sm"
              >
                Panel de Control
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            <div className="glass-card rounded-2xl border border-border p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Aislamiento Total</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cada prestamista posee RLS (Row Level Security) estricto. Tus datos están 100% protegidos y aislados.
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-border p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-info-bg border border-info-border text-info flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Cobro Ultra-Rápido</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Optimizado para horas pico. Escanea el código QR de tus clientes y registra cuotas en un clic.
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-border p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Sliders className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Reglas Flexibles</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configura tus propios plazos, tasas de interés sugeridas y penalizaciones por mora según el cliente.
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-border p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Pagaré Digital</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Genera de manera automática el pagaré listo para imprimir con la firma digital y los datos del aval.
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-center z-10 px-6 mt-12">
        <p>© {new Date().getFullYear()} LendSaaS. Todos los derechos reservados. Diseñado para prestamistas independientes.</p>
      </footer>
    </div>
  )
}
