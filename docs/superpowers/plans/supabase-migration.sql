-- policy_conditions 表：存储政策结构化条件
CREATE TABLE IF NOT EXISTS policy_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  conditions JSONB NOT NULL,
  raw_text TEXT,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'failed')),
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(policy_id)
);

CREATE INDEX IF NOT EXISTS idx_policy_conditions_policy_id ON policy_conditions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_conditions_status ON policy_conditions(extraction_status);

-- enterprise_cache 表：天眼查数据缓存
CREATE TABLE IF NOT EXISTS enterprise_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_name TEXT NOT NULL,
  credit_code TEXT,
  profile JSONB NOT NULL,
  source TEXT DEFAULT 'tianyancha',
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enterprise_name)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_cache_name ON enterprise_cache(enterprise_name);
CREATE INDEX IF NOT EXISTS idx_enterprise_cache_cached_at ON enterprise_cache(cached_at);