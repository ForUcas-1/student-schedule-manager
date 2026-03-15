DROP TABLE IF EXISTS course_modifications CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS semester_settings CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;

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

CREATE TABLE todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    start_time VARCHAR(5),
    end_time VARCHAR(5),
    location VARCHAR(255),
    note TEXT,
    alarm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE semester_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    semester_start DATE NOT NULL,
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

CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_courses_day_time ON courses(day, time_start, time_end);
CREATE INDEX idx_modifications_user_id ON course_modifications(user_id);
CREATE INDEX idx_modifications_course_week ON course_modifications(course_id, week);
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_date ON todos(date);
CREATE INDEX idx_semester_user_id ON semester_settings(user_id);
CREATE INDEX idx_time_slots_user_id ON time_slots(user_id);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

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
