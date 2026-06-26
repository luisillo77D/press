'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function handleSignOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
