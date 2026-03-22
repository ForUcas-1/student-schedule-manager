DROP TABLE IF EXISTS course_modifications CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS semester_settings CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;
DROP TABLE IF EXISTS ai_plans CASCADE;
DROP TABLE IF EXISTS plan_items CASCADE;
DROP TABLE IF EXISTS recurring_rules CASCADE;
DROP TABLE IF EXISTS long_term_milestones CASCADE;
DROP TABLE IF EXISTS todo_instances CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS ai_messages CASCADE;
DROP TABLE IF EXISTS ai_prompts CASCADE;
DROP TABLE IF EXISTS todo_suggestions CASCADE;
DROP TABLE IF EXISTS course_mod_suggestions CASCADE;
DROP TABLE IF EXISTS long_term_plans CASCADE;
DROP TABLE IF EXISTS plan_instances CASCADE;

CREATE TABLE courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    day INTEGER NOT NULL CHECK (day >= 1 AND day <= 7),
    time_start INTEGER NOT NULL CHECK (time_start >= 1),
    time_end INTEGER NOT NULL CHECK (time_end >= 1),
    location VARCHAR(255),
    weeks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE course_modifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    new_day INTEGER CHECK (new_day >= 1 AND new_day <= 7),
    new_time_start INTEGER CHECK (new_time_start >= 1),
    new_time_end INTEGER CHECK (new_time_end >= 1),
    new_location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(course_id, week)
);

CREATE TABLE semester_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    semester_start DATE NOT NULL,
    semester_end DATE,
    total_weeks INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE time_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_index INTEGER NOT NULL CHECK (slot_index >= 0 AND slot_index < 12),
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, slot_index)
);

CREATE TABLE ai_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'previewing', 'confirmed', 'applied', 'rejected')),
    plan_scope VARCHAR(20) CHECK (plan_scope IN ('week', 'month', 'semester')),
    start_date DATE,
    end_date DATE,
    ai_model VARCHAR(50),
    plan_summary TEXT,
    plan_reasoning JSONB,
    plan_data JSONB,
    effectiveness_score NUMERIC(3, 2),
    user_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    applied_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE plan_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES ai_plans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type VARCHAR(20) CHECK (item_type IN ('todo', 'study', 'break', 'course')),
    reference_id UUID,
    item_name VARCHAR(255) NOT NULL,
    day INTEGER,
    time_slot INTEGER,
    duration INTEGER,
    priority INTEGER CHECK (priority >= 1 AND priority <= 5),
    ai_confidence NUMERIC(3, 2),
    is_suggested BOOLEAN DEFAULT TRUE,
    is_confirmed BOOLEAN DEFAULT FALSE,
    user_modified BOOLEAN DEFAULT FALSE,
    original_data JSONB,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'single' CHECK (type IN ('single', 'recurring', 'long_term')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority INTEGER CHECK (priority >= 1 AND priority <= 5),
    category VARCHAR(50),
    importance INTEGER CHECK (importance >= 1 AND importance <= 5),
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
    estimated_duration INTEGER,
    actual_duration INTEGER,
    date DATE,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    deadline TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255),
    note TEXT,
    tags JSONB,
    alarm BOOLEAN DEFAULT FALSE,
    alarm_time VARCHAR(5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    plan_id UUID REFERENCES ai_plans(id) ON DELETE SET NULL,
    is_confirmed BOOLEAN DEFAULT FALSE
);

CREATE TABLE recurring_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rule_type VARCHAR(20) CHECK (rule_type IN ('daily', 'weekly', 'monthly', 'custom')),
    frequency INTEGER,
    start_date DATE,
    end_date DATE,
    end_condition VARCHAR(20) CHECK (end_condition IN ('never', 'after_count', 'specific_date')),
    end_count INTEGER,
    skip_weekends BOOLEAN DEFAULT FALSE,
    skip_holidays BOOLEAN DEFAULT FALSE,
    custom_pattern JSONB,
    next_occurrence TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE long_term_milestones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    milestone_name VARCHAR(255) NOT NULL,
    milestone_order INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    progress INTEGER CHECK (progress >= 0 AND progress <= 100),
    estimated_hours INTEGER,
    actual_hours INTEGER,
    dependencies JSONB,
    deliverables JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE todo_instances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_date DATE NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'skipped', 'cancelled')),
    completion_notes TEXT,
    actual_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    category VARCHAR(50),
    is_ai_generated BOOLEAN DEFAULT FALSE,
    effectiveness_score NUMERIC(3, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_courses_day_time ON courses(day, time_start, time_end);
CREATE INDEX idx_modifications_user_id ON course_modifications(user_id);
CREATE INDEX idx_modifications_course_week ON course_modifications(course_id, week);
CREATE INDEX idx_todos_user_type_status ON todos(user_id, type, status);
CREATE INDEX idx_todos_user_deadline ON todos(user_id, deadline);
CREATE INDEX idx_todos_user_priority ON todos(user_id, priority);
CREATE INDEX idx_todos_user_category ON todos(user_id, category);
CREATE INDEX idx_semester_user_id ON semester_settings(user_id);
CREATE INDEX idx_time_slots_user_id ON time_slots(user_id);
CREATE INDEX idx_recurring_todo_active ON recurring_rules(todo_id, is_active);
CREATE INDEX idx_recurring_user_next ON recurring_rules(user_id, next_occurrence);
CREATE INDEX idx_milestones_todo_order ON long_term_milestones(todo_id, milestone_order);
CREATE INDEX idx_milestones_user_status ON long_term_milestones(user_id, status);
CREATE INDEX idx_instances_todo_date ON todo_instances(todo_id, instance_date);
CREATE INDEX idx_instances_user_date ON todo_instances(user_id, instance_date);
CREATE INDEX idx_ai_plans_user_status ON ai_plans(user_id, status, created_at);
CREATE INDEX idx_ai_plans_user_scope ON ai_plans(user_id, plan_scope);
CREATE INDEX idx_plan_items_plan_time ON plan_items(plan_id, day, time_slot);
CREATE INDEX idx_plan_items_user_priority ON plan_items(user_id, priority);
CREATE INDEX idx_user_preferences_user_key ON user_preferences(user_id, preference_key);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own courses" ON courses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own courses" ON courses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses" ON courses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses" ON courses
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own modifications" ON course_modifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own modifications" ON course_modifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own modifications" ON course_modifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own modifications" ON course_modifications
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own todos" ON todos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todos" ON todos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos" ON todos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos" ON todos
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own semester settings" ON semester_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own semester settings" ON semester_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own semester settings" ON semester_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own time slots" ON time_slots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time slots" ON time_slots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time slots" ON time_slots
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time slots" ON time_slots
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own recurring rules" ON recurring_rules
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring rules" ON recurring_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring rules" ON recurring_rules
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring rules" ON recurring_rules
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own milestones" ON long_term_milestones
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own milestones" ON long_term_milestones
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own milestones" ON long_term_milestones
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own milestones" ON long_term_milestones
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own todo instances" ON todo_instances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todo instances" ON todo_instances
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todo instances" ON todo_instances
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todo instances" ON todo_instances
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai plans" ON ai_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai plans" ON ai_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai plans" ON ai_plans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai plans" ON ai_plans
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own plan items" ON plan_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plan items" ON plan_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan items" ON plan_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plan items" ON plan_items
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;
CREATE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_plans_updated_at ON ai_plans;
CREATE TRIGGER update_ai_plans_updated_at
    BEFORE UPDATE ON ai_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- AI对话相关表
CREATE TABLE ai_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_type TEXT NOT NULL, -- single_todo, course_modification, long_term_plan
    status TEXT DEFAULT 'active', -- active, completed, cancelled
    current_step TEXT, -- 对话当前步骤
    context JSONB, -- 对话上下文
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE ai_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    message_type TEXT, -- text, todo_suggestion, course_mod_suggestion, long_term_plan
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE ai_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_type TEXT NOT NULL, -- todo, course, long_term
    content TEXT NOT NULL,
    variables JSONB, -- 模板变量
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE todo_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TEXT, -- HH:MM
    end_time TEXT, -- HH:MM
    location TEXT,
    note TEXT,
    conflict BOOLEAN DEFAULT false,
    conflict_details JSONB,
    status TEXT DEFAULT 'pending', -- pending, confirmed, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE course_mod_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    course_name TEXT NOT NULL,
    old_day INTEGER,
    old_time_start INTEGER,
    old_time_end INTEGER,
    new_day INTEGER,
    new_time_start INTEGER,
    new_time_end INTEGER,
    new_location TEXT,
    conflict BOOLEAN DEFAULT false,
    conflict_details JSONB,
    status TEXT DEFAULT 'pending', -- pending, confirmed, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE long_term_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    frequency TEXT NOT NULL, -- 例如: "weekly", "daily", "custom"
    preferred_time TEXT, -- 例如: "morning", "afternoon", "evening"
    preferred_days INTEGER[], -- 例如: [1, 3, 5] 表示周一、周三、周五
    status TEXT DEFAULT 'active', -- active, completed, paused
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE plan_instances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES long_term_plans(id) ON DELETE CASCADE,
    todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
    instance_date DATE NOT NULL,
    status TEXT DEFAULT 'scheduled', -- scheduled, completed, missed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 索引
CREATE INDEX idx_ai_conversations_user_type ON ai_conversations(user_id, conversation_type, status);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
CREATE INDEX idx_todo_suggestions_user_date ON todo_suggestions(user_id, date, status);
CREATE INDEX idx_course_mod_suggestions_user ON course_mod_suggestions(user_id, status);
CREATE INDEX idx_long_term_plans_user_status ON long_term_plans(user_id, status);
CREATE INDEX idx_plan_instances_user_date ON plan_instances(user_id, instance_date, status);

-- 启用RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_mod_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_instances ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "Users can view their own ai conversations" ON ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai conversations" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai conversations" ON ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai conversations" ON ai_conversations
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai messages" ON ai_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai messages" ON ai_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own todo suggestions" ON todo_suggestions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todo suggestions" ON todo_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todo suggestions" ON todo_suggestions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own course mod suggestions" ON course_mod_suggestions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own course mod suggestions" ON course_mod_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own course mod suggestions" ON course_mod_suggestions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own long term plans" ON long_term_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own long term plans" ON long_term_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own long term plans" ON long_term_plans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own long term plans" ON long_term_plans
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own plan instances" ON plan_instances
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plan instances" ON plan_instances
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan instances" ON plan_instances
    FOR UPDATE USING (auth.uid() = user_id);

-- 触发器
DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_long_term_plans_updated_at ON long_term_plans;
CREATE TRIGGER update_long_term_plans_updated_at
    BEFORE UPDATE ON long_term_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
