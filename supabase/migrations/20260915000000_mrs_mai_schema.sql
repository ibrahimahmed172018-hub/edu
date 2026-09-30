-- Mrs. Mai Educational Platform Schema Migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    schedule TEXT,
    days_of_week TEXT[] DEFAULT ARRAY[]::TEXT[],
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Students table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id TEXT UNIQUE,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    student_phone TEXT,
    parent_phone TEXT,
    barcode_token TEXT UNIQUE NOT NULL,
    custom_tuition NUMERIC(10,2) DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT,
    notes TEXT,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
    homework_status TEXT DEFAULT 'done' CHECK (homework_status IN ('done', 'incomplete', 'missing')),
    scanned_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    UNIQUE (student_id, session_id)
);

-- 5. Exams table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Student Scores table
CREATE TABLE IF NOT EXISTS public.student_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    notes TEXT,
    UNIQUE (student_id, exam_id)
);

-- 7. Fee Payments table
CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    month TEXT NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);

-- Indexes for optimal lookup
CREATE INDEX IF NOT EXISTS idx_students_barcode_token ON public.students(barcode_token);
CREATE INDEX IF NOT EXISTS idx_students_legacy_id ON public.students(legacy_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_student_id ON public.student_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.fee_payments(student_id);

-- Enable RLS on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Public read policies for parent portal view & scanning
DROP POLICY IF EXISTS "Public read students" ON public.students;
CREATE POLICY "Public read students" ON public.students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read groups" ON public.groups;
CREATE POLICY "Public read groups" ON public.groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read sessions" ON public.sessions;
CREATE POLICY "Public read sessions" ON public.sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read attendance" ON public.attendance;
CREATE POLICY "Public read attendance" ON public.attendance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read exams" ON public.exams;
CREATE POLICY "Public read exams" ON public.exams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read student_scores" ON public.student_scores;
CREATE POLICY "Public read student_scores" ON public.student_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read fee_payments" ON public.fee_payments;
CREATE POLICY "Public read fee_payments" ON public.fee_payments FOR SELECT USING (true);

-- Allow authenticated / service_role write access
DROP POLICY IF EXISTS "Service role write groups" ON public.groups;
CREATE POLICY "Service role write groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role write students" ON public.students;
CREATE POLICY "Service role write students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role write sessions" ON public.sessions;
CREATE POLICY "Service role write sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role write attendance" ON public.attendance;
CREATE POLICY "Service role write attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role write exams" ON public.exams;
CREATE POLICY "Service role write exams" ON public.exams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role write student_scores" ON public.student_scores;
CREATE POLICY "Service role write student_scores" ON public.student_scores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role write fee_payments" ON public.fee_payments;
CREATE POLICY "Service role write fee_payments" ON public.fee_payments FOR ALL USING (true) WITH CHECK (true);

-- 8. Pre-printed Unassigned Card Tokens
CREATE TABLE IF NOT EXISTS public.card_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode_token TEXT UNIQUE NOT NULL,
    is_assigned BOOLEAN NOT NULL DEFAULT false,
    assigned_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_tokens_barcode ON public.card_tokens(barcode_token);
CREATE INDEX IF NOT EXISTS idx_card_tokens_assigned ON public.card_tokens(is_assigned);

ALTER TABLE public.card_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read card_tokens" ON public.card_tokens;
CREATE POLICY "Public read card_tokens" ON public.card_tokens FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role write card_tokens" ON public.card_tokens;
CREATE POLICY "Service role write card_tokens" ON public.card_tokens FOR ALL USING (true) WITH CHECK (true);
