import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  adminRole: 'admin', // 'admin' | 'operator'

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    let adminRole = 'admin'

    if (user) {
      adminRole = await fetchAdminRole(user.id)
    }

    set({ session, user, loading: false, adminRole })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null
      let role = 'admin'
      if (user) {
        role = await fetchAdminRole(user.id)
      }
      set({ session, user, adminRole: role })
    })
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const adminRole = await fetchAdminRole(data.user.id)
    set({ session: data.session, user: data.user, adminRole })
    return data
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, adminRole: 'admin' })
  },

  // Helper getters
  isAdmin: () => get().adminRole === 'admin',
  isOperator: () => get().adminRole === 'operator',
}))

// Fetch role dari tabel admin_roles. Jika tidak ada → default 'admin' (backward compatible).
async function fetchAdminRole(authUserId) {
  try {
    const { data, error } = await supabase
      .from('admin_roles')
      .select('role')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (error) {
      // Tabel belum ada (migration belum dijalankan) → anggap admin
      console.warn('admin_roles query failed (migration belum dijalankan?):', error.message)
      return 'admin'
    }

    // Tidak ada entry → default admin
    return data?.role ?? 'admin'
  } catch {
    return 'admin'
  }
}
