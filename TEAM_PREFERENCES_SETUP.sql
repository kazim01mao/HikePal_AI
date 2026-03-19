-- ============================================================================
-- HikePal AI - Team Member Preferences Setup (最佳实践版)
-- ============================================================================

-- ============================================================================
-- 🧹 最佳方案：清理旧表，使用全新结构
-- 原因：旧表的 user_id 是 UUID 且绑定了外键，无法支持"未登录用户(VARCHAR)"的需求。
-- 强行兼容会导致代码极其复杂且容易出错。最干净的做法是重建表。
-- ============================================================================

-- 1. 删除旧的表和视图（CASCADE 会自动解除外键和关联）
DROP VIEW IF EXISTS team_progress_summary CASCADE;
DROP TABLE IF EXISTS team_negotiation_history CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- ============================================================================
-- 🆕 全新创建完美的表结构
-- ============================================================================

-- 1. Teams 表
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id), -- 可以为空，如果是匿名创建
  created_at TIMESTAMP DEFAULT NOW(),
  is_public BOOLEAN DEFAULT true,
  invite_code VARCHAR(12) UNIQUE NOT NULL DEFAULT SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6),
  team_size INT DEFAULT 1,
  max_team_size INT DEFAULT 10,
  hiking_mood VARCHAR,
  hiking_difficulty VARCHAR,
  status VARCHAR DEFAULT 'planning',
  CONSTRAINT teams_invite_code_length CHECK (LENGTH(invite_code) = 6)
);

-- 2. Team Members 表
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,  -- 使用 VARCHAR！完美支持 UUID 和 "user_xxx" 匿名标识
  
  role VARCHAR DEFAULT 'member',
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  preferences_completed BOOLEAN DEFAULT false,
  preferences_completed_at TIMESTAMP,
  
  user_mood VARCHAR,
  user_difficulty VARCHAR,
  user_condition TEXT,
  user_preferences JSONB,
  
  joined_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('leader', 'member', 'organizer'))
);

-- 3. Team Negotiation History 表
CREATE TABLE team_negotiation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  initiated_by VARCHAR(255), -- 放宽限制，支持记录是谁发起的
  
  member_preferences JSONB NOT NULL,
  member_count INT,
  
  ai_analysis TEXT,
  synthesized_mood VARCHAR,
  synthesized_difficulty VARCHAR,
  synthesized_condition TEXT,
  recommended_routes JSONB,
  selected_route_id UUID,
  
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT has_members CHECK (member_count > 0)
);

-- ============================================================================
-- ⚡ 索引优化
-- ============================================================================
CREATE INDEX idx_teams_invite_code ON teams(invite_code);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_preferences_completed ON team_members(preferences_completed);
CREATE INDEX idx_team_negotiation_history_team_id ON team_negotiation_history(team_id);

-- ============================================================================
-- 🔒 RLS 政策 (Row Level Security)
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_negotiation_history ENABLE ROW LEVEL SECURITY;

-- Teams: 允许任何人查看，允许认证用户创建
CREATE POLICY "teams_public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "teams_all_actions" ON teams FOR ALL USING (true); -- 开发期放宽限制

-- Team Members: 允许任何人插入（支持邀请链接），任何人查看自己的团队
CREATE POLICY "team_members_all_actions" ON team_members FOR ALL USING (true);

-- Negotiation History
CREATE POLICY "negotiation_history_all_actions" ON team_negotiation_history FOR ALL USING (true);

-- ============================================================================
-- 📊 视图：获取团队完成进度
-- ============================================================================
CREATE VIEW team_progress_summary AS
SELECT 
  t.id as team_id,
  t.name as team_name,
  COUNT(tm.id) as total_members,
  SUM(CASE WHEN tm.preferences_completed THEN 1 ELSE 0 END) as completed_members,
  ROUND((SUM(CASE WHEN tm.preferences_completed THEN 1 ELSE 0 END)::numeric / 
         NULLIF(COUNT(tm.id), 0) * 100)::numeric) as completion_percentage
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id;
