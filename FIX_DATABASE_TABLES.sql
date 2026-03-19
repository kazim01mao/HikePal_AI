-- ==========================================================
-- 修复 Supabase 数据库缺失表的问题
-- 请复制以下 SQL 代码，在 Supabase 左侧菜单点击 "SQL Editor" -> "New Query" -> 粘贴并运行
-- ==========================================================

-- 1️⃣ 修复 user_stats (用户统计表)
-- 这个表用于存储用户的徒步总距离、完成次数等数据
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_distance_km FLOAT DEFAULT 0,
    total_hikes_completed INT DEFAULT 0,
    total_elevation_gained_m INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 启用 RLS (Row Level Security) 保护数据
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- 允许用户查看自己的统计数据
CREATE POLICY "Users can view own stats" ON public.user_stats
    FOR SELECT USING (auth.uid() = user_id);

-- 允许用户更新自己的统计数据
CREATE POLICY "Users can update own stats" ON public.user_stats
    FOR UPDATE USING (auth.uid() = user_id);

-- 允许插入新数据
CREATE POLICY "Users can insert own stats" ON public.user_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2️⃣ 修复 route_segments (路线片段关联表)
-- 这个表用于连接 "路线(Route)" 和 "路段(Segment)"
-- 它是 "多对多" 关系的中间表，定义了一条路线包含哪些路段，以及顺序
CREATE TABLE IF NOT EXISTS public.route_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL, -- 关联到 routes 表 (或 recommended_routes)
    segment_id UUID NOT NULL, -- 关联到 segments 表
    sort_order INT NOT NULL, -- 路段的顺序 (1, 2, 3...)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 建立索引以加快查询速度
CREATE INDEX IF NOT EXISTS idx_route_segments_route_id ON public.route_segments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_segments_segment_id ON public.route_segments(segment_id);

-- 启用 RLS 这里的策略是公开读取
ALTER TABLE public.route_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route segments are public" ON public.route_segments
    FOR SELECT USING (true);


-- 3️⃣ 补充 profiles 表的缺失字段 (可选)
-- 你的 profiles 表可能缺少 level 和 bio 字段，运行下面代码添加它们
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'level') THEN
        ALTER TABLE public.profiles ADD COLUMN level INT DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio TEXT DEFAULT '';
    END IF;
END $$;
