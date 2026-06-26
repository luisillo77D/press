'use server'

import { createClient, createServiceClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTenantWithOwner(
  tenantName: string,
  subdomain: string | null,
  ownerName: string,
  ownerEmail: string,
  ownerPassword: string
) {
  try {
    // 1. Verify current user is a global admin
    const currentSupabase = await createClient()
    const { data: { user } } = await currentSupabase.auth.getUser()

    if (!user || user.app_metadata?.is_global_admin !== true) {
      return { success: false, error: 'No autorizado. Solo el Administrador Global puede dar de alta prestamistas.' }
    }

    const serviceSupabase = await createServiceClient()

    // 2. Insert the tenant record using the service role client
    const { data: tenant, error: tenantError } = await serviceSupabase
      .from('tenants')
      .insert({
        name: tenantName,
        subdomain: subdomain ? subdomain.toLowerCase() : null
      })
      .select('id')
      .single()

    if (tenantError) {
      return { success: false, error: `Error al registrar prestamista: ${tenantError.message}` }
    }

    const tenantId = tenant.id

    // 3. Create the Owner user account in auth.users
    const { data: authUser, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true, // auto confirm locally/development
      user_metadata: {
        tenant_id: tenantId,
        full_name: ownerName,
        role: 'owner'
      }
    })

    if (authError) {
      // Rollback tenant creation on user error
      await serviceSupabase.from('tenants').delete().eq('id', tenantId)
      return { success: false, error: `Error al crear la cuenta del propietario: ${authError.message}` }
    }

    revalidatePath('/admin-portal')
    return { success: true }

  } catch (err: any) {
    return { success: false, error: err.message || 'Error del servidor al registrar el prestamista.' }
  }
}
