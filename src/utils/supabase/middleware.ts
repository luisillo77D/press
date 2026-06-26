import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Safely refresh session and verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  // Protect dashboard routes
  const isDashboardRoute = url.pathname.startsWith('/dashboard') || 
                           url.pathname.startsWith('/clients') || 
                           url.pathname.startsWith('/loans') || 
                           url.pathname.startsWith('/collect') || 
                           url.pathname.startsWith('/settings');
  
  const isAdminRoute = url.pathname.startsWith('/admin-portal');

  if (!user && (isDashboardRoute || isAdminRoute)) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users trying to access login/signup/home
  if (user && (url.pathname === '/login' || url.pathname === '/signup' || url.pathname === '/')) {
    const isGlobalAdmin = user.app_metadata?.is_global_admin === true;
    if (isGlobalAdmin) {
      url.pathname = '/admin-portal';
    } else {
      url.pathname = '/dashboard';
    }
    return NextResponse.redirect(url);
  }

  // Prevent non-admins from accessing the admin portal
  if (user && isAdminRoute) {
    const isGlobalAdmin = user.app_metadata?.is_global_admin === true;
    if (!isGlobalAdmin) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
