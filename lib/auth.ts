import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseMaster } from '@/services/supabase-master'
import { getTenantAdminClient } from '@/services/supabase-tenant'
import '@/types/auth'

const credentialsSchema = z.object({
  empresa_codigo: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        empresa_codigo: { label: 'Código de empresa', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { empresa_codigo, email, password } = parsed.data

        // 1. Lookup empresa en la base maestra
        const { data: empresa } = await supabaseMaster
          .from('empresas')
          .select('id, nombre, codigo, activo, supabase_url, supabase_anon_key, supabase_service_key')
          .eq('codigo', empresa_codigo.toUpperCase().trim())
          .eq('activo', true)
          .single()

        if (!empresa) return null

        // 2. Autenticar contra Supabase Auth del tenant
        const tenantAnonClient = createClient(
          empresa.supabase_url as string,
          empresa.supabase_anon_key as string,
          { auth: { persistSession: false } }
        )
        const { data: authData, error } = await tenantAnonClient.auth.signInWithPassword({
          email,
          password,
        })
        if (error || !authData.user) return null

        // 3. Perfil de usuario del tenant
        const tenantAdmin = await getTenantAdminClient(empresa.id as string)
        const { data: profile } = await tenantAdmin
          .from('users')
          .select('id, email, name, role_id')
          .eq('id', authData.user.id)
          .single()

        if (!profile) return null

        // 4. Nombre del rol
        const { data: roleData } = await tenantAdmin
          .from('roles')
          .select('name')
          .eq('id', profile.role_id)
          .single()

        // 5. Módulos activos para esta empresa
        const { data: modulesData } = await supabaseMaster
          .from('empresa_modulos')
          .select('modulo')
          .eq('empresa_id', empresa.id)
          .eq('activo', true)

        const modules = (modulesData ?? []).map((m: { modulo: string }) => m.modulo)

        return {
          id: profile.id as string,
          email: profile.email as string,
          name: (profile.name as string | null) ?? '',
          role: (roleData?.name as string) ?? 'Vendedor',
          role_id: profile.role_id as number,
          empresa_id: empresa.id as string,
          empresa_codigo: empresa.codigo as string,
          modules,
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/signin' },

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.role_id = user.role_id
        token.empresa_id = user.empresa_id
        token.empresa_codigo = user.empresa_codigo
        token.modules = user.modules
      }
      return token
    },
    session({ session, token }) {
      session.user.id = (token.id ?? token.sub) as string
      session.user.role = token.role as string
      session.user.role_id = token.role_id as number
      session.user.empresa_id = (token.empresa_id ?? '') as string
      session.user.empresa_codigo = (token.empresa_codigo ?? '') as string
      session.user.modules = (token.modules ?? []) as string[]
      return session
    },
  },
})

export const { GET, POST } = handlers
