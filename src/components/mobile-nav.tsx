'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  QrCode, 
  Users, 
  FileText, 
  Settings 
} from 'lucide-react'

export default function MobileNav({ isGlobalAdmin }: { isGlobalAdmin: boolean }) {
  const pathname = usePathname()

  if (isGlobalAdmin) {
    return null // Global admin doesn't need mobile navigation bar
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
    { href: '/collect', icon: QrCode, label: 'Cobrar' },
    { href: '/clients', icon: Users, label: 'Clientes' },
    { href: '/loans', icon: FileText, label: 'Préstamos' },
    { href: '/settings', icon: Settings, label: 'Config' },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around z-30 md:hidden no-print shadow-[0_-4px_16px_rgba(0,0,0,0.4)]">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 w-14 h-12 rounded-xl transition-all ${
              isActive 
                ? 'text-primary font-bold scale-105' 
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Icon className={`h-5 w-5 transition-transform ${isActive ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[9px] tracking-tight">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
