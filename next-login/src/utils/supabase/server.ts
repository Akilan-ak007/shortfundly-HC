import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  // Developer Bypass / Mock Auth fallback
  const mockSession = cookieStore.get('sb-mock-session')?.value;
  if (mockSession) {
    try {
      const userData = JSON.parse(decodeURIComponent(mockSession));
      return {
        auth: {
          async getUser() {
            return {
              data: {
                user: {
                  email: userData.email || 'mock@example.com',
                  user_metadata: {
                    full_name: userData.name || 'Mock User',
                  },
                  created_at: new Date().toISOString(),
                },
              },
              error: null,
            };
          },
          async signOut() {
            try {
              cookieStore.delete('sb-mock-session');
            } catch (err) {
              console.error('Failed to delete cookie in Server Component:', err);
            }
            return { error: null };
          },
        },
      } as any;
    } catch {
      // Ignore parsing errors and fall back to real Supabase
    }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method can be called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
