import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isPathAllowedForTinytoast,
  isTinytoastUserEmail,
  resolveWorkspaceAccess,
} from '@/lib/crm/workspace-access';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/confirm', '/offline'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  // Accounts flagged by an admin must pick a personal password before using the CRM.
  if (
    user
    && user.user_metadata?.must_set_password === true
    && !isPublicPath(request.nextUrl.pathname)
    && request.nextUrl.pathname !== '/account'
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/account';
    redirectUrl.search = '?reset=1';
    return NextResponse.redirect(redirectUrl);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = resolveWorkspaceAccess(user.email).homePath;
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }
  if (user && isTinytoastUserEmail(user.email) && !isPathAllowedForTinytoast(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/funnel';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
