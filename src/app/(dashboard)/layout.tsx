import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  Wallet, 
  LayoutDashboard, 
  QrCode, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  User as UserIcon,
  Shield
} from 'lucide-react'
import { handleSignOut } from './actions'

interface SidebarLinkProps {
  href: string
  icon: React.ReactNode
  label: string
}

function SidebarLink({ href, icon, label }: SidebarLinkProps) {
  return (
    <Link 
      href={href} 
      className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-white rounded-xl hover:bg-muted transition-all text-sm font-medium group"
    >
      <span className="text-muted-foreground group-hover:text-primary transition-colors">
        {icon}
      </span>
      {label}
    </Link>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile and tenant details
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(name)')
    .eq('id', user.id)
    .single()

  const tenantName = profile?.tenants?.name || 'LendSaaS System'
  const isGlobalAdmin = user.app_metadata?.is_global_admin === true

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col justify-between hidden md:flex shrink-0 z-20 no-print">
        <div className="flex flex-col">
          {/* Header/Logo */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-border">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-white leading-none">LendSaaS</h1>
              <span className="text-[10px] text-primary font-semibold tracking-wider uppercase">
                {isGlobalAdmin ? 'Global Admin' : (profile?.role || 'Collector')}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {!isGlobalAdmin && (
              <>
                <SidebarLink 
                  href="/dashboard" 
                  icon={<LayoutDashboard className="h-5 w-5" />} 
                  label="Inicio" 
                />
                <SidebarLink 
                  href="/collect" 
                  icon={<QrCode className="h-5 w-5" />} 
                  label="Cobro Rápido" 
                />
                <SidebarLink 
                  href="/clients" 
                  icon={<Users className="h-5 w-5" />} 
                  label="Clientes" 
                />
                <SidebarLink 
                  href="/loans" 
                  icon={<FileText className="h-5 w-5" />} 
                  label="Préstamos" 
                />
                <SidebarLink 
                  href="/settings" 
                  icon={<Settings className="h-5 w-5" />} 
                  label="Configuración" 
                />
              </>
            )}

            {isGlobalAdmin && (
              <SidebarLink 
                href="/admin-portal" 
                icon={<Shield className="h-5 w-5" />} 
                label="Admin Global" 
              />
            )}
          </nav>
        </div>

        {/* User Info / Logout */}
        <div className="p-4 border-t border-border bg-black/10">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground border border-border text-sm font-semibold uppercase">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{profile?.full_name || 'Usuario'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <form action={handleSignOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-danger hover:bg-danger-bg hover:border-danger-border border border-transparent rounded-lg transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-6 z-10 no-print">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-white px-3 py-1.5 rounded-lg bg-secondary border border-border">
              {tenantName}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Display profile role on desktop */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserIcon className="h-4 w-4 text-primary" />
              <span>{profile?.full_name || user.email}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
