'use server'

import { createClient, createServiceClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOperatorUser(email: string, password: string, fullName: string) {
  try {
    // 1. Verify current session using the standard client
    const currentSupabase = await createClient()
    const { data: { user } } = await currentSupabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'No has iniciado sesión.' }
    }

    const currentRole = user.app_metadata?.role
    const tenantId = user.app_metadata?.tenant_id

    if (currentRole !== 'owner' && currentRole !== 'administrator') {
      return { success: false, error: 'Acceso denegado. Solo propietarios o administradores pueden agregar personal.' }
    }

    if (!tenantId) {
      return { success: false, error: 'No se encontró el ID de tu negocio.' }
    }

    // 2. Spawn the new operator using the service role client
    const serviceSupabase = await createServiceClient()
    
    const { data, error } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto confirm to speed up local testing
      user_metadata: {
        tenant_id: tenantId,
        full_name: fullName,
        role: 'collector'
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings')
    return { success: true, user: data.user }
    
  } catch (err: any) {
    return { success: false, error: err.message || 'Error del servidor al registrar el cobrador.' }
  }
}
