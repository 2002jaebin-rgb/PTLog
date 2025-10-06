import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ✅ logout 요청만 204 → 200 변환, 나머지는 그대로 통과
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (input, init) => {
      try {
        const url = typeof input === 'string' ? input : input?.url

        // 로그아웃 요청만 예외 처리
        if (url?.includes('/auth/v1/logout')) {
          const response = await fetch(input, init)
          if (response.status === 204) {
            console.warn('[PTLog] logout 204 → 200 변환')
            return new Response('', { status: 200, statusText: 'OK' })
          }
          return response
        }

        // ✅ 그 외의 요청은 원본 그대로
        return await fetch(input, init)
      } catch (err) {
        console.error('[PTLog] Fetch error', err)
        throw err
      }
    },
  },
})
