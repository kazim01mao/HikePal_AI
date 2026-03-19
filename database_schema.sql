-- ============================================================================
-- HikePal AI - Segment-Based Route System Database Schema
-- Created: 2026-02-27
-- ============================================================================

-- 1️⃣ SEGMENTS 表 - 存储登山步道片段（最核心的数据）
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name TEXT NOT NULL,
  description TEXT,
  region TEXT NOT NULL,
  
  -- 路线质量属性
  difficulty INT CHECK(difficulty >= 1 AND difficulty <= 5), -- 1=非常简单, 5=非常困难
  distance FLOAT, -- 公里
  duration_minutes INT, -- 分钟
  elevation_gain INT, -- 米
  elevation_loss INT, -- 米
  
  -- 位置信息 (GeoJSON LineString format)
  start_point GEOMETRY(Point, 4326),
  end_point GEOMETRY(Point, 4326),
  coordinates JSONB NOT NULL, -- [[lat, lng], [lat, lng], ...] 完整路线坐标
  
  -- 标签系统 - AI匹配的关键
  tags JSONB NOT NULL, -- ["scenic", "historic", "water_view", "forest", "rocky", "urban", "beginner_friendly", "photo_spot", ...]
  
  -- 天气和季节属性
  best_seasons JSONB, -- ["spring", "autumn"]
  weather_conditions JSONB, -- ["sunny", "partly_cloudy"]
  
  -- 景点信息
  highlights JSONB, -- ["Dragon's Back Peak", "Victoria Harbour View", ...]
  
  -- 用户贡献
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- SEO 和发现
  is_published BOOLEAN DEFAULT false,
  popularity_score INT DEFAULT 0,
  
  -- 索引优化
  CONSTRAINT min_coordinates CHECK (jsonb_array_length(coordinates) >= 2)
);

-- 创建地理索引
CREATE INDEX idx_segments_start_geom ON segments USING GIST(start_point);
CREATE INDEX idx_segments_end_geom ON segments USING GIST(end_point);
CREATE INDEX idx_segments_tags ON segments USING GIN(tags);
CREATE INDEX idx_segments_difficulty ON segments(difficulty);
CREATE INDEX idx_segments_region ON segments(region);


-- 2️⃣ ROUTES 表 - 修改以支持 segment-based composition
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  
  -- 这个字段标识路线是由 segments 组成的
  is_segment_based BOOLEAN DEFAULT false,
  
  -- 冗余存储：完整路线的聚合信息（用于快速查询）
  total_distance FLOAT,
  total_duration_minutes INT,
  total_elevation_gain INT,
  difficulty_level INT,
  
  -- 综合标签 - 所有 segments 标签的并集
  tags JSONB, -- ["scenic", "forest", "moderate", ...]
  
  -- 元数据
  difficulty INT CHECK(difficulty >= 1 AND difficulty <= 5),
  imageUrl TEXT,
  startPoint TEXT,
  endPoint TEXT,
  
  -- 用户信息
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- 发行状态
  is_published BOOLEAN DEFAULT false,
  is_template BOOLEAN DEFAULT false, -- 是否是推荐模板
  
  visibility TEXT DEFAULT 'public', -- 'public', 'private', 'friends'
  
  CONSTRAINT valid_duration CHECK(total_duration_minutes > 0),
  CONSTRAINT valid_distance CHECK(total_distance > 0)
);

CREATE INDEX idx_routes_tags ON routes USING GIN(tags);
CREATE INDEX idx_routes_difficulty ON routes(difficulty_level);
CREATE INDEX idx_routes_region ON routes(region);
CREATE INDEX idx_routes_segment_based ON routes(is_segment_based);


-- 3️⃣ ROUTE_SEGMENTS 表 - 关联表：路线是由多个有序 segments 组成
CREATE TABLE IF NOT EXISTS route_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  
  -- 关键：segments 在 route 中的顺序
  segment_order INT NOT NULL, -- 0, 1, 2, 3...
  
  -- 连接质量
  is_connected BOOLEAN DEFAULT true, -- segment 的 end_point 是否与下一个 segment 的 start_point 相连
  connection_distance FLOAT, -- 如果不连接，需要多少额外距离
  
  created_at TIMESTAMP DEFAULT now(),
  
  -- 确保每个路线中的 segments 顺序唯一
  CONSTRAINT unique_route_segment_order UNIQUE(route_id, segment_order),
  CONSTRAINT unique_route_segment_pair UNIQUE(route_id, segment_id)
);

CREATE INDEX idx_route_segments_route ON route_segments(route_id);
CREATE INDEX idx_route_segments_segment ON route_segments(segment_id);
CREATE INDEX idx_route_segments_order ON route_segments(route_id, segment_order);


-- 4️⃣ AI_ROUTE_MATCHES 表 - 用户输入与推荐路线的匹配记录
CREATE TABLE IF NOT EXISTS ai_route_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- 关联 hike_sessions.id
  
  -- 用户输入信息
  user_mood TEXT, -- "Energetic", "Peaceful", "Adventurous", "Scenic"
  user_difficulty TEXT, -- "easy", "medium", "hard"
  user_condition TEXT, -- 用户输入的条件描述
  
  -- AI 分析结果
  matched_routes JSONB, -- [{route_id, match_score, reason}, ...]
  top_route_id UUID REFERENCES routes(id),
  
  -- 元数据
  created_at TIMESTAMP DEFAULT now(),
  used_at TIMESTAMP -- 用户选择使用这条路线时的时间
);

CREATE INDEX idx_ai_matches_user ON ai_route_matches(user_id);
CREATE INDEX idx_ai_matches_session ON ai_route_matches(session_id);


-- 5️⃣ GENERATED_ROUTES 表 - AI 为用户生成的可选路线（私有，仅用户可见）
CREATE TABLE IF NOT EXISTS generated_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  user_prefs JSONB,
  generated_routes JSONB, -- 存储 AI 返回的推荐路线列表
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_generated_routes_user ON generated_routes(user_id);


-- 6️⃣ UPLOADED_ROUTES 表 - 用户上传分享的路线（公开可见）
CREATE TABLE IF NOT EXISTS uploaded_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  route_data JSONB,
  tags JSONB,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_uploaded_routes_user ON uploaded_routes(user_id);
CREATE INDEX idx_uploaded_routes_published ON uploaded_routes(is_published);


-- 7️⃣ SEGMENT_TAGS 表（可选）- 标准化 tags，便于管理
CREATE TABLE IF NOT EXISTS segment_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_name TEXT UNIQUE NOT NULL,
  tag_category TEXT, -- "environment", "difficulty", "atmosphere", "activity"
  description TEXT,
  emoji TEXT, -- 用于 UI 显示
  created_at TIMESTAMP DEFAULT now()
);

-- 预填充常用 tags
INSERT INTO segment_tags (tag_name, tag_category, description, emoji) VALUES
('scenic', 'environment', 'Beautiful views and scenery', '🏞️'),
('forest', 'environment', 'Dense forest, green vegetation', '🌲'),
('water_view', 'environment', 'Near water, rivers, or ocean', '💧'),
('rocky', 'terrain', 'Rocky or stone paths', '🪨'),
('urban', 'environment', 'City or urban area', '🏙️'),
('historic', 'culture', 'Historical sites or cultural heritage', '🏛️'),
('beginner_friendly', 'difficulty', 'Easy for beginners', '🟢'),
('photo_spot', 'activity', 'Great for photography', '📸'),
('steep', 'terrain', 'Steep uphill sections', '⛰️'),
('shaded', 'environment', 'Mostly shaded from sun', '🌳'),
('coastal', 'environment', 'Coastal area', '🏖️'),
('mountain_peak', 'feature', 'Reaches a mountain peak', '⛩️'),
('quiet', 'atmosphere', 'Peaceful, not crowded', '🤫'),
('adventurous', 'difficulty', 'Challenging and adventurous', '🔴'),
('family_friendly', 'difficulty', 'Suitable for families', '👨‍👩‍👧‍👦'),
('wildflowers', 'season', 'Wildflowers bloom here', '🌸'),
('autumn_colors', 'season', 'Beautiful autumn foliage', '🍂'),
('sunrise_spot', 'feature', 'Great for sunrise viewing', '🌅'),
('sunset_spot', 'feature', 'Great for sunset viewing', '🌇'),
('workout', 'activity', 'Good cardio workout', '💪') ON CONFLICT DO NOTHING;


-- 6️⃣ RLS 政策（Row Level Security）- 保护用户隐私
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- 所有人可以读取已发布的 segments
CREATE POLICY "Public segments readable" ON segments
  FOR SELECT USING (is_published = true OR created_by = auth.uid());

-- 只有创建者可以修改自己的 segments
CREATE POLICY "Segments updateable by creator" ON segments
  FOR UPDATE USING (created_by = auth.uid());

-- 所有人可以读取已发布的 routes
CREATE POLICY "Public routes readable" ON routes
  FOR SELECT USING (is_published = true OR created_by = auth.uid());

-- 仅允许用户读取/写入自己的 AI 生成路线
ALTER TABLE generated_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can read own generated routes" ON generated_routes
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "User can insert generated routes" ON generated_routes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "User can update own generated routes" ON generated_routes
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "User can delete own generated routes" ON generated_routes
  FOR DELETE USING (user_id = auth.uid());

-- 公开的用户上传路线（仅公开已发布的）
ALTER TABLE uploaded_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public uploaded routes readable" ON uploaded_routes
  FOR SELECT USING (is_published = true OR user_id = auth.uid());
CREATE POLICY "Uploader can insert uploaded routes" ON uploaded_routes
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Uploader can update own uploaded routes" ON uploaded_routes
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Uploader can delete own uploaded routes" ON uploaded_routes
  FOR DELETE USING (user_id = auth.uid());


-- 7️⃣ 视图 - 方便查询完整路线信息
CREATE OR REPLACE VIEW routes_with_segments AS
SELECT 
  r.id,
  r.name,
  r.description,
  r.region,
  r.total_distance,
  r.total_duration_minutes,
  r.total_elevation_gain,
  r.difficulty_level,
  r.tags,
  r.is_segment_based,
  r.created_by,
  r.created_at,
  -- 聚合所有 segments
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'segment_id', s.id,
      'segment_name', s.name,
      'segment_order', rs.segment_order,
      'difficulty', s.difficulty,
      'distance', s.distance,
      'duration', s.duration_minutes,
      'elevation_gain', s.elevation_gain,
      'tags', s.tags,
      'highlights', s.highlights,
      'coordinates', s.coordinates
    ) ORDER BY rs.segment_order
  ) as segments
FROM routes r
LEFT JOIN route_segments rs ON r.id = rs.route_id
LEFT JOIN segments s ON rs.segment_id = s.id
WHERE r.is_segment_based = true
GROUP BY r.id, r.name, r.description, r.region, r.total_distance, 
         r.total_duration_minutes, r.total_elevation_gain, r.difficulty_level, 
         r.tags, r.is_segment_based, r.created_by, r.created_at;


-- 8️⃣ 事件触发器 - 自动更新 routes 的聚合信息
CREATE OR REPLACE FUNCTION update_route_metadata()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE routes
  SET 
    total_distance = (
      SELECT COALESCE(SUM(s.distance), 0)
      FROM route_segments rs
      JOIN segments s ON rs.segment_id = s.id
      WHERE rs.route_id = NEW.route_id
    ),
    total_duration_minutes = (
      SELECT COALESCE(SUM(s.duration_minutes), 0)
      FROM route_segments rs
      JOIN segments s ON rs.segment_id = s.id
      WHERE rs.route_id = NEW.route_id
    ),
    total_elevation_gain = (
      SELECT COALESCE(SUM(s.elevation_gain), 0)
      FROM route_segments rs
      JOIN segments s ON rs.segment_id = s.id
      WHERE rs.route_id = NEW.route_id
    ),
    difficulty_level = (
      SELECT COALESCE(MAX(s.difficulty), 1)
      FROM route_segments rs
      JOIN segments s ON rs.segment_id = s.id
      WHERE rs.route_id = NEW.route_id
    ),
    tags = (
      SELECT JSONB_AGG(DISTINCT tag)
      FROM route_segments rs
      JOIN segments s ON rs.segment_id = s.id,
      JSONB_ARRAY_ELEMENTS(s.tags) as tag
      WHERE rs.route_id = NEW.route_id
    ),
    updated_at = now()
  WHERE id = NEW.route_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_route_metadata
AFTER INSERT OR DELETE ON route_segments
FOR EACH ROW
EXECUTE FUNCTION update_route_metadata();


-- ============================================================================
-- 数据初始化示例 - Dragon's Back Trail Segments
-- ============================================================================

-- 示例 segments - Dragon's Back Trail 分成 7 段
INSERT INTO segments (name, description, region, difficulty, distance, duration_minutes, elevation_gain, elevation_loss, 
  start_point, end_point, coordinates, tags, best_seasons, highlights, is_published) VALUES

-- 第 1 段：Stanley Beach - Big Wave Bay
('Stanley Peak South Ridge', 
 'The scenic southern ridge of Stanley Peak offering stunning harbor views.',
 'Hong Kong Island', 2, 3.5, 60, 200, 180,
 ST_GeomFromText('POINT(114.2228 22.2252)', 4326),
 ST_GeomFromText('POINT(114.2315 22.2275)', 4326),
 '[[114.2228, 22.2252], [114.2250, 22.2260], [114.2285, 22.2270], [114.2315, 22.2275]]'::jsonb,
 '["scenic", "forest", "beginner_friendly", "photo_spot", "shaded"]'::jsonb,
 '["spring", "autumn"]'::jsonb,
 '["Victoria Harbour", "Repulse Bay View"]'::jsonb,
 true),

-- 第 2 段：Big Wave Bay - Shek O Peak
('Big Wave Bay to Shek O Peak',
 'Moderate climb with excellent views of the eastern coast.',
 'Hong Kong Island', 3, 4.2, 90, 320, 150,
 ST_GeomFromText('POINT(114.2315 22.2275)', 4326),
 ST_GeomFromText('POINT(114.2420 22.2180)', 4326),
 '[[114.2315, 22.2275], [114.2350, 22.2250], [114.2390, 22.2210], [114.2420, 22.2180]]'::jsonb,
 '["scenic", "rocky", "moderate", "mountain_peak", "photo_spot"]'::jsonb,
 '["spring", "autumn"]'::jsonb,
 '["Shek O Peak", "East Coast Views", "Shek O Village"]'::jsonb,
 true),

-- 第 3 段：Shek O Peak - Pottinger Peak
('Shek O Peak to Pottinger Peak',
 'Undulating trail with historical interest and coastal views.',
 'Hong Kong Island', 2, 5.0, 100, 250, 280,
 ST_GeomFromText('POINT(114.2420 22.2180)', 4326),
 ST_GeomFromText('POINT(114.2580 22.2120)', 4326),
 '[[114.2420, 22.2180], [114.2470, 22.2150], [114.2530, 22.2130], [114.2580, 22.2120]]'::jsonb,
 '["scenic", "historic", "beginner_friendly", "quiet"]'::jsonb,
 '["spring", "autumn", "winter"]'::jsonb,
 '["Pottinger Peak", "Historic Sites"]'::jsonb,
 true),

-- 第 4 段：Pottinger Peak - Wan Chai Gap
('Pottinger Peak to Wan Chai Gap',
 'Steep descent with forest coverage, good trail conditions.',
 'Hong Kong Island', 3, 3.8, 75, 100, 420,
 ST_GeomFromText('POINT(114.2580 22.2120)', 4326),
 ST_GeomFromText('POINT(114.2620 22.1950)', 4326),
 '[[114.2580, 22.2120], [114.2600, 22.2050], [114.2610, 22.2000], [114.2620, 22.1950]]'::jsonb,
 '["forest", "steep", "shaded", "beginner_friendly"]'::jsonb,
 '["spring", "autumn"]'::jsonb,
 '["Forest Cathedral", "Wildlife Spots"]'::jsonb,
 true);

-- 如果需要更多 segments，继续添加...
-- 记得：每个 segment 的 end_point 应该接近下一个 segment 的 start_point
