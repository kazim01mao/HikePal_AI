import { createClient } from '@supabase/supabase-js'

// 直接使用 Supabase 凭证（避免环境变量问题）
const supabaseUrl = 'https://ojcvrvutsylptamslntq.supabase.co'
const supabaseKey = 'sb_publishable_UZf341-Gio8qK8M0EZUoQQ_g2X9TW8i'

console.log('✅ Supabase 已初始化')

export const supabase = createClient(supabaseUrl, supabaseKey)

// Mock login for demo/fallback purposes
export const mockLogin = async (email) => {
  const userId = 'mock_' + Date.now()
  const user = {
    id: userId,
    name: email.split('@')[0],
    email: email,
    role: 'hiker'
  }
  return { user, error: null }
}