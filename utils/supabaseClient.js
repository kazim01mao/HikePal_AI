// src/lib/supabaseClient.js (或你的路径)
import { createClient } from '@supabase/supabase-js';

// 🔧 Vite 项目：使用 import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ojcvrvutsylptamslntq.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_UZf341-Gio8qK8M0EZUoQQ_g2X9TW8i';

// 🚀 初始化 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase 已初始化:', supabaseUrl);

// 🔐 Mock 登录函数（保留你的原有逻辑）
export const mockLogin = async (email) => {
  const userId = 'mock_' + Date.now();
  const user = {
    id: userId,
    name: email.split('@')[0],
    email: email,
    role: 'hiker'
  };
  return { user, error: null };
};

// 🔧 辅助函数：获取当前用户 ID
export const getCurrentUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;
  return 'mock_' + Date.now();
};