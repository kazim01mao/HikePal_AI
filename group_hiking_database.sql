-- ============================================================================
-- HikePal AI - Group Hiking System Database Schema
-- ============================================================================
-- 这个脚本扩展现有的数据库，添加 group hiking 功能

-- 1. Teams 表 - 存储团队信息
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- 创建信息
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 可见性和邀请
  is_public BOOLEAN DEFAULT true,
  invite_code VARCHAR(12) UNIQUE NOT NULL,  -- 短唯一码，用于邀请和搜索
  invite_link VARCHAR(512),  -- 完整的分享链接
  
  -- 队伍统计
  team_size INT DEFAULT 1,
  max_team_size INT DEFAULT 10,
  
  -- 综合需求（由 AI 生成）
  hiking_mood VARCHAR,  -- 综合心情
  hiking_difficulty VARCHAR,  -- 综合难度
  hiking_preferences JSONB,  -- 综合需求 {synthesized_condition, considerations}
  
  -- 状态
  status VARCHAR DEFAULT 'planning',  -- 'planning' | 'hiking' | 'completed'
  negotiation_completed BOOLEAN DEFAULT false,
  
  CONSTRAINT teams_invite_code_length CHECK (LENGTH(invite_code) = 6)
);

-- 2. Team Members 表 - 存储队员信息
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关系
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- 角色和状态
  role VARCHAR DEFAULT 'member',  -- 'leader' | 'member'
  preferences_completed BOOLEAN DEFAULT false,
  preferences_completed_at TIMESTAMP,
  
  -- 用户的个人偏好
  user_mood VARCHAR,
  user_difficulty VARCHAR,
  user_condition TEXT,
  user_preferences JSONB,  -- { mood, difficulty, condition, availableTime, maxDistance }
  
  -- 时间戳
  joined_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 约束
  UNIQUE(team_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('leader', 'member', 'organizer'))
);

-- 3. Team Negotiation History 表 - 存储 AI 综合分析记录
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_negotiation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关系
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),  -- 队长
  
  -- 输入信息
  member_preferences JSONB NOT NULL,  -- 所有队员的偏好数组
  member_count INT,
  
  -- AI 生成的综合内容
  ai_analysis TEXT,  -- AI 分析的自然语言描述
  synthesized_mood VARCHAR,
  synthesized_difficulty VARCHAR,
  synthesized_condition TEXT,  -- 综合需求文本
  
  -- 结果
  recommended_routes JSONB,  -- 推荐的 routes 列表 [{ id, name, score, ... }]
  selected_route_id UUID REFERENCES routes(id),  -- 最终选择的路线
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT has_members CHECK (member_count > 0)
);

-- 4. Team Generated Routes 表 - 存储每次生成的路由推荐
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_generated_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关系
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  negotiation_id UUID REFERENCES team_negotiation_history(id),
  
  -- 生成信息
  generated_by UUID NOT NULL REFERENCES auth.users(id),  -- 谁点击的按钮
  generated_at TIMESTAMP DEFAULT NOW(),
  
  -- 结果
  synthetic_query TEXT,  -- AI 生成的综合查询描述
  routes JSONB NOT NULL,  -- 推荐的完整 routes 数据
  auto_generated_title VARCHAR,  -- 自动生成的分组标题
  
  -- 选择状态
  selected_route_id UUID,
  selected_at TIMESTAMP,
  
  CONSTRAINT has_routes CHECK (JSON_ARRAY_LENGTH(routes) > 0)
);

-- 5. Team Invite Links 表 - 管理邀请链接（可选增强）
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  
  -- 邀请码
  invite_code VARCHAR(12) UNIQUE NOT NULL,
  full_link VARCHAR(512),
  
  -- 创建和过期
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP,
  
  -- 使用限制
  max_uses INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT invite_not_overused CHECK (used_count <= COALESCE(max_uses, 999))
);

-- ============================================================================
-- 索引优化
-- ============================================================================

-- Teams 表索引
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON teams(invite_code);
CREATE INDEX IF NOT EXISTS idx_teams_is_public ON teams(is_public);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);

-- Team Members 索引
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_preferences_completed ON team_members(preferences_completed);

-- Team Negotiation History 索引
CREATE INDEX IF NOT EXISTS idx_team_negotiation_history_team_id ON team_negotiation_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_negotiation_history_created_at ON team_negotiation_history(created_at);

-- ============================================================================
-- 视图定义 - 方便查询
-- ============================================================================

-- 获取团队的完整信息（包含成员数和完成状态）
CREATE OR REPLACE VIEW teams_with_members AS
SELECT 
  t.id,
  t.name,
  t.description,
  t.created_by,
  t.created_at,
  t.is_public,
  t.invite_code,
  t.invite_link,
  COUNT(DISTINCT tm.user_id) as current_members,
  t.team_size as expected_members,
  SUM(CASE WHEN tm.preferences_completed THEN 1 ELSE 0 END) as completed_preferences,
  t.hiking_mood,
  t.hiking_difficulty,
  t.status,
  t.negotiation_completed
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id;

-- 获取团队成员的详细信息
CREATE OR REPLACE VIEW team_members_detail AS
SELECT 
  tm.id as member_id,
  tm.team_id,
  tm.user_id,
  t.name as team_name,
  t.created_by as team_leader_id,
  tm.role,
  tm.preferences_completed,
  tm.joined_at,
  tm.user_mood,
  tm.user_difficulty,
  tm.user_condition,
  tm.user_preferences
FROM team_members tm
JOIN teams t ON tm.team_id = t.id;

-- ============================================================================
-- RLS 政策 (Row Level Security)
-- ============================================================================

-- 启用 RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_negotiation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_generated_routes ENABLE ROW LEVEL SECURITY;

-- Teams RLS: 公开团队任何人可读；创建者可修改
CREATE POLICY "teams_public_read" ON teams
  FOR SELECT USING (is_public = true);

CREATE POLICY "teams_creator_all" ON teams
  FOR ALL USING (created_by = auth.uid());

-- Team Members RLS: 团队成员可见自己的信息及团队成员列表
CREATE POLICY "team_members_view" ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm2 
      WHERE tm2.team_id = team_members.team_id 
      AND tm2.user_id = auth.uid()
    )
  );

CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_members_update_own" ON team_members
  FOR UPDATE USING (user_id = auth.uid());

-- Negotiation History RLS: 团队成员可见
CREATE POLICY "negotiation_history_view" ON team_negotiation_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_negotiation_history.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- Generated Routes RLS: 团队成员可见
CREATE POLICY "generated_routes_view" ON team_generated_routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_generated_routes.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 触发器函数
-- ============================================================================

-- 1. 自动生成 invite_code 和 invite_link
CREATE OR REPLACE FUNCTION generate_team_invite_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(6);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- 生成随机 6 位字符码 (alphanumeric)
    new_code := SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM 1 FOR 1) ||
                SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM FLOOR(RANDOM() * 36 + 1) FOR 1) ||
                SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM FLOOR(RANDOM() * 36 + 1) FOR 1) ||
                SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM FLOOR(RANDOM() * 36 + 1) FOR 1) ||
                SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM FLOOR(RANDOM() * 36 + 1) FOR 1) ||
                SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' FROM FLOOR(RANDOM() * 36 + 1) FOR 1);
    
    -- 检查是否已存在
    SELECT EXISTS(SELECT 1 FROM teams WHERE invite_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.invite_code := new_code;
  NEW.invite_link := 'https://hikepal.com/join?code=' || new_code;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_invite_code_before_insert
  BEFORE INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION generate_team_invite_code();

-- 2. 当所有成员都完成偏好后，更新团队状态
CREATE OR REPLACE FUNCTION check_all_preferences_completed()
RETURNS TRIGGER AS $$
DECLARE
  total_members INT;
  completed_members INT;
BEGIN
  -- 获取该团队的总成员数
  SELECT COUNT(*) INTO total_members FROM team_members WHERE team_id = NEW.team_id;
  
  -- 获取已完成偏好的成员数
  SELECT COUNT(*) INTO completed_members FROM team_members 
  WHERE team_id = NEW.team_id AND preferences_completed = true;
  
  -- 如果所有成员都完成，更新团队状态
  IF total_members > 0 AND total_members = completed_members THEN
    UPDATE teams SET updated_at = NOW() WHERE id = NEW.team_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_preferences_completed
  AFTER UPDATE ON team_members
  FOR EACH ROW
  WHEN (NEW.preferences_completed = true AND OLD.preferences_completed = false)
  EXECUTE FUNCTION check_all_preferences_completed();

-- ============================================================================
-- 示例数据（用于测试，发布前删除）
-- ============================================================================

-- 如果需要测试，可以插入示例团队


-- ============================================================================
-- 辅助函数
-- ============================================================================

-- 函数：检查用户是否是某个团队的成员
CREATE OR REPLACE FUNCTION is_team_member(team_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = team_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 函数：检查用户是否是团队的队长
CREATE OR REPLACE FUNCTION is_team_leader(team_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = team_uuid AND user_id = user_uuid AND role = 'leader'
  );
END;
$$ LANGUAGE plpgsql;

-- 函数：获取团队的完成进度 (百分比)
CREATE OR REPLACE FUNCTION get_team_completion_percentage(team_uuid UUID)
RETURNS INT AS $$
DECLARE
  total_members INT;
  completed_members INT;
  percentage INT;
BEGIN
  SELECT COUNT(*) INTO total_members FROM team_members WHERE team_id = team_uuid;
  
  IF total_members = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO completed_members FROM team_members 
  WHERE team_id = team_uuid AND preferences_completed = true;
  
  percentage := ROUND((completed_members * 100) / total_members);
  RETURN LEAST(percentage, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 权限和安全性检查
-- ============================================================================

-- 确保只有队长能启动 negotiation
CREATE OR REPLACE FUNCTION validate_negotiation_initiator()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_team_leader(NEW.team_id, NEW.initiated_by) THEN
    RAISE EXCEPTION 'Only team leader can initiate negotiation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_negotiation_initiator_trigger
  BEFORE INSERT ON team_negotiation_history
  FOR EACH ROW
  EXECUTE FUNCTION validate_negotiation_initiator();

-- ============================================================================
-- 日志和审计 (可选)
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR,  -- 'created', 'joined', 'preferences_updated', 'negotiation_started', etc.
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_team_activity_log_team_id ON team_activity_log(team_id);
CREATE INDEX idx_team_activity_log_created_at ON team_activity_log(created_at);
