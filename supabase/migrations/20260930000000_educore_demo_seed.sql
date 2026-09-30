-- ==============================================================================
-- EduCore Educational Management Platform — Demo Database Seed Migration
-- Dedicated to QALEB Platform Live Demo Showcase
-- Instructor: أ/ محمد إبراهيم - خبير الكيمياء للثانوية العامة
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Schema Tables Definition (Idempotent)
-- ------------------------------------------------------------------------------

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

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    notes TEXT,
    UNIQUE (student_id, exam_id)
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    month TEXT NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS public.card_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode_token TEXT UNIQUE NOT NULL,
    is_assigned BOOLEAN NOT NULL DEFAULT false,
    assigned_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_barcode_token ON public.students(barcode_token);
CREATE INDEX IF NOT EXISTS idx_students_legacy_id ON public.students(legacy_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_student_id ON public.student_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON public.fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_card_tokens_barcode ON public.card_tokens(barcode_token);

-- RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_tokens ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
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

DROP POLICY IF EXISTS "Public read card_tokens" ON public.card_tokens;
CREATE POLICY "Public read card_tokens" ON public.card_tokens FOR SELECT USING (true);

-- Service Role Write Policies
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

DROP POLICY IF EXISTS "Service role write card_tokens" ON public.card_tokens;
CREATE POLICY "Service role write card_tokens" ON public.card_tokens FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. Clean Seed Data for EduCore Live Demo
-- ------------------------------------------------------------------------------

-- Insert Demo Secondary Groups
INSERT INTO public.groups (id, name, grade, schedule, days_of_week, start_time, end_time)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111',
    'الصف الأول الثانوي - مجموعة السبت',
    'الصف الأول الثانوي',
    'السبت والثلاثاء (04:00 م - 06:00 م)',
    ARRAY['Saturday', 'Tuesday']::TEXT[],
    '16:00:00',
    '18:00:00'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'الصف الثاني الثانوي - مجموعة الأحد',
    'الصف الثاني الثانوي',
    'الأحد والأربعاء (06:00 م - 08:00 م)',
    ARRAY['Sunday', 'Wednesday']::TEXT[],
    '18:00:00',
    '20:00:00'
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'الصف الثالث الثانوي - مكثف',
    'الصف الثالث الثانوي',
    'الإثنين والخميس (07:00 م - 09:30 م)',
    ARRAY['Monday', 'Thursday']::TEXT[],
    '19:00:00',
    '21:30:00'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  grade = EXCLUDED.grade,
  schedule = EXCLUDED.schedule,
  days_of_week = EXCLUDED.days_of_week,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time;

-- Insert 18 Demo Students (6 per group)
INSERT INTO public.students (id, legacy_id, name, grade, group_id, student_phone, parent_phone, barcode_token, custom_tuition, notes)
VALUES
  -- Group 1: 1st Secondary
  ('b0000000-0000-0000-0000-000000000101', '101', 'أحمد محمود إبراهيم', 'الصف الأول الثانوي', 'a1111111-1111-1111-1111-111111111111', '01000000001', '01100000001', 'EDC10101', 500.00, 'طالب متفوق - ملتزم بالحضور'),
  ('b0000000-0000-0000-0000-000000000102', '102', 'سارة علي منصور', 'الصف الأول الثانوي', 'a1111111-1111-1111-1111-111111111111', '01000000002', '01100000002', 'EDC10102', 500.00, 'أداء متميز في الكيمياء العامة'),
  ('b0000000-0000-0000-0000-000000000103', '103', 'عمر خالد الشناوي', 'الصف الأول الثانوي', 'a1111111-1111-1111-1111-111111111111', '01000000003', '01100000003', 'EDC10103', 500.00, 'التزام تام بالواجبات الأسبوعية'),
  ('b0000000-0000-0000-0000-000000000104', '104', 'مريم حسام الدين', 'الصف الأول الثانوي', 'a1111111-1111-1111-1111-111111111111', '01000000004', '01100000004', 'EDC10104', 450.00, 'خصم تفوق أكاديمي'),
  ('b0000000-0000-0000-0000-000000000105', '105', 'يوسف كريم فتحي', 'الصف الأول الثانوي', 'a1111111-1111-1111-1111-111111111111', '01000000005', '01100000005', 'EDC10105', 500.00, 'حضور منتظم ومشاركة فعالة'),
  ('b0000000-0000-0000-0000-000000000106', '106', 'نوران إيهاب القاضي', 'الصف الأول الثانوي', 'a1111111-1111-1111-1111-111111111111', '01000000006', '01100000006', 'EDC10106', 500.00, 'التزام بالأنشطة والتجارب المعملية'),

  -- Group 2: 2nd Secondary
  ('b0000000-0000-0000-0000-000000000107', '107', 'زياد طارق النجار', 'الصف الثاني الثانوي', 'a2222222-2222-2222-2222-222222222222', '01000000007', '01100000007', 'EDC10107', 550.00, 'شعبة علمي علوم - متفوق'),
  ('b0000000-0000-0000-0000-000000000108', '108', 'هناء عصام عبد الله', 'الصف الثاني الثانوي', 'a2222222-2222-2222-2222-222222222222', '01000000008', '01100000008', 'EDC10108', 550.00, 'متابعة دورية مع ولي الأمر'),
  ('b0000000-0000-0000-0000-000000000109', '109', 'مصطفى رأفت هلال', 'الصف الثاني الثانوي', 'a2222222-2222-2222-2222-222222222222', '01000000009', '01100000009', 'EDC10109', 550.00, 'تحسن ملحوظ في درجات الكيمياء'),
  ('b0000000-0000-0000-0000-000000000110', '110', 'سلمى حازم بدوي', 'الصف الثاني الثانوي', 'a2222222-2222-2222-2222-222222222222', '01000000010', '01100000010', 'EDC10110', 500.00, 'خصم اشتراك إخوة'),
  ('b0000000-0000-0000-0000-000000000111', '111', 'كريم هاني زهران', 'الصف الثاني الثانوي', 'a2222222-2222-2222-2222-222222222222', '01000000011', '01100000011', 'EDC10111', 550.00, 'التزام بمواعيد الحصص'),
  ('b0000000-0000-0000-0000-000000000112', '112', 'ريم عادل يونس', 'الصف الثاني الثانوي', 'a2222222-2222-2222-2222-222222222222', '01000000012', '01100000012', 'EDC10112', 550.00, 'مستوى متميز في الاختبارات الدورية'),

  -- Group 3: 3rd Secondary (Thanaweya Amma Intensive)
  ('b0000000-0000-0000-0000-000000000113', '113', 'عبد الرحمن شريف فهمي', 'الصف الثالث الثانوي', 'a3333333-3333-3333-3333-333333333333', '01000000013', '01100000013', 'EDC10113', 600.00, 'المركز الأول في امتحان الكيمياء العضوية'),
  ('b0000000-0000-0000-0000-000000000114', '114', 'ندى أحمد زكي', 'الصف الثالث الثانوي', 'a3333333-3333-3333-3333-333333333333', '01000000014', '01100000014', 'EDC10114', 600.00, 'التزام تام بحضور ورش العمل التفاعلية'),
  ('b0000000-0000-0000-0000-000000000115', '115', 'محمد ياسر الدسوقي', 'الصف الثالث الثانوي', 'a3333333-3333-3333-3333-333333333333', '01000000015', '01100000015', 'EDC10115', 600.00, 'حل بنك أسئلة الوزارة بانتظام'),
  ('b0000000-0000-0000-0000-000000000116', '116', 'فريدة وليد الجوهري', 'الصف الثالث الثانوي', 'a3333333-3333-3333-3333-333333333333', '01000000016', '01100000016', 'EDC10116', 600.00, 'التزام ومثابرة عالية'),
  ('b0000000-0000-0000-0000-000000000117', '117', 'حمزة وائل الغمري', 'الصف الثالث الثانوي', 'a3333333-3333-3333-3333-333333333333', '01000000017', '01100000017', 'EDC10117', 600.00, 'أداء متقدم في المسائل التراكمية'),
  ('b0000000-0000-0000-0000-000000000118', '118', 'ملك عمرو رضوان', 'الصف الثالث الثانوي', 'a3333333-3333-3333-3333-333333333333', '01000000018', '01100000018', 'EDC10118', 600.00, 'مستوى دراسي واعد')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  grade = EXCLUDED.grade,
  group_id = EXCLUDED.group_id,
  student_phone = EXCLUDED.student_phone,
  parent_phone = EXCLUDED.parent_phone,
  barcode_token = EXCLUDED.barcode_token,
  custom_tuition = EXCLUDED.custom_tuition,
  notes = EXCLUDED.notes;

-- Insert Demo Sessions
INSERT INTO public.sessions (id, group_id, date, title, notes, is_closed)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'مراجعة الباب الأول: كيمياء العناصر والتركيب الإلكتروني', 'حصة تفاعلية مع حل تدريبات شاملة', false),
  ('c2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', CURRENT_DATE, 'الاتزان الكيميائي والعوامل المؤثرة على سرعة التفاعل', 'شرح تفصيلي مع مسائل لوشاتيليه', false),
  ('c3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', CURRENT_DATE, 'الكيمياء الكهربية وخلايا الجلفانية والإلكتروليتية (مكثف)', 'حل مسائل قوانين فاراداي وتطبيقاتها', false)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  notes = EXCLUDED.notes;

-- Insert Attendance for Today's Sessions
INSERT INTO public.attendance (student_id, session_id, status, homework_status, scanned_at, notes)
VALUES
  -- Group 1 Session
  ('b0000000-0000-0000-0000-000000000101', 'c1111111-1111-1111-1111-111111111111', 'present', 'done', now() - INTERVAL '45 minutes', 'حضور مبكر وتسليم الواجب كاملاً'),
  ('b0000000-0000-0000-0000-000000000102', 'c1111111-1111-1111-1111-111111111111', 'present', 'done', now() - INTERVAL '40 minutes', 'أداء ممتاز'),
  ('b0000000-0000-0000-0000-000000000103', 'c1111111-1111-1111-1111-111111111111', 'present', 'done', now() - INTERVAL '35 minutes', 'تمت مراجعة التدريبات'),
  ('b0000000-0000-0000-0000-000000000104', 'c1111111-1111-1111-1111-111111111111', 'present', 'done', now() - INTERVAL '30 minutes', 'حاضرة'),
  ('b0000000-0000-0000-0000-000000000105', 'c1111111-1111-1111-1111-111111111111', 'present', 'incomplete', now() - INTERVAL '25 minutes', 'واجب غير مكتمل صفحة 14'),
  ('b0000000-0000-0000-0000-000000000106', 'c1111111-1111-1111-1111-111111111111', 'present', 'done', now() - INTERVAL '20 minutes', 'حاضرة وممتازة'),

  -- Group 2 Session
  ('b0000000-0000-0000-0000-000000000107', 'c2222222-2222-2222-2222-222222222222', 'present', 'done', now() - INTERVAL '50 minutes', 'حاضر'),
  ('b0000000-0000-0000-0000-000000000108', 'c2222222-2222-2222-2222-222222222222', 'present', 'done', now() - INTERVAL '48 minutes', 'حاضرة'),
  ('b0000000-0000-0000-0000-000000000109', 'c2222222-2222-2222-2222-222222222222', 'present', 'done', now() - INTERVAL '30 minutes', 'حاضر'),
  ('b0000000-0000-0000-0000-000000000110', 'c2222222-2222-2222-2222-222222222222', 'present', 'done', now() - INTERVAL '25 minutes', 'حاضرة'),
  ('b0000000-0000-0000-0000-000000000111', 'c2222222-2222-2222-2222-222222222222', 'late', 'done', now() - INTERVAL '10 minutes', 'حضور متأخر 10 دقائق بعذر'),
  ('b0000000-0000-0000-0000-000000000112', 'c2222222-2222-2222-2222-222222222222', 'present', 'done', now() - INTERVAL '15 minutes', 'حاضرة'),

  -- Group 3 Session
  ('b0000000-0000-0000-0000-000000000113', 'c3333333-3333-3333-3333-333333333333', 'present', 'done', now() - INTERVAL '35 minutes', 'حاضر'),
  ('b0000000-0000-0000-0000-000000000114', 'c3333333-3333-3333-3333-333333333333', 'present', 'done', now() - INTERVAL '30 minutes', 'حاضرة'),
  ('b0000000-0000-0000-0000-000000000115', 'c3333333-3333-3333-3333-333333333333', 'present', 'done', now() - INTERVAL '22 minutes', 'حاضر'),
  ('b0000000-0000-0000-0000-000000000116', 'c3333333-3333-3333-3333-333333333333', 'present', 'done', now() - INTERVAL '18 minutes', 'حاضرة'),
  ('b0000000-0000-0000-0000-000000000117', 'c3333333-3333-3333-3333-333333333333', 'present', 'done', now() - INTERVAL '12 minutes', 'حاضر'),
  ('b0000000-0000-0000-0000-000000000118', 'c3333333-3333-3333-3333-333333333333', 'absent', 'missing', now() - INTERVAL '5 minutes', 'متغيبة بعذر صحي')
ON CONFLICT (student_id, session_id) DO UPDATE SET
  status = EXCLUDED.status,
  homework_status = EXCLUDED.homework_status,
  notes = EXCLUDED.notes;

-- Insert Demo Exams
INSERT INTO public.exams (id, group_id, title, max_score, date)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'اختبار شهر سبتمبر: الجدول الدوري والخواص الكيميائية', 20.00, CURRENT_DATE - INTERVAL '7 days'),
  ('d2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'اختبار نصف الترم: الروابط الجزيئية وقوى التجاذب', 30.00, CURRENT_DATE - INTERVAL '5 days'),
  ('d3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'الامتحان الشامل التجريبي: الكيمياء العضوية والكهربية', 50.00, CURRENT_DATE - INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  max_score = EXCLUDED.max_score;

-- Insert Demo Exam Scores
INSERT INTO public.student_scores (student_id, exam_id, score, notes)
VALUES
  -- Exam 1 (Max 20)
  ('b0000000-0000-0000-0000-000000000101', 'd1111111-1111-1111-1111-111111111111', 20.00, 'الدرجة النهائية - ممتاز 🌟'),
  ('b0000000-0000-0000-0000-000000000102', 'd1111111-1111-1111-1111-111111111111', 19.50, 'أداء رائع جداً'),
  ('b0000000-0000-0000-0000-000000000103', 'd1111111-1111-1111-1111-111111111111', 18.00, 'جيد جداً مرتفع'),
  ('b0000000-0000-0000-0000-000000000104', 'd1111111-1111-1111-1111-111111111111', 19.00, 'ممتاز'),
  ('b0000000-0000-0000-0000-000000000105', 'd1111111-1111-1111-1111-111111111111', 16.50, 'جيد - بحاجة لمراجعة التوزيع الإلكتروني'),
  ('b0000000-0000-0000-0000-000000000106', 'd1111111-1111-1111-1111-111111111111', 18.50, 'جيد جداً'),

  -- Exam 2 (Max 30)
  ('b0000000-0000-0000-0000-000000000107', 'd2222222-2222-2222-2222-222222222222', 29.00, 'ممتاز 🌟'),
  ('b0000000-0000-0000-0000-000000000108', 'd2222222-2222-2222-2222-222222222222', 28.00, 'ممتاز'),
  ('b0000000-0000-0000-0000-000000000109', 'd2222222-2222-2222-2222-222222222222', 25.50, 'جيد جداً'),
  ('b0000000-0000-0000-0000-000000000110', 'd2222222-2222-2222-2222-222222222222', 27.50, 'جيد جداً مرتفع'),
  ('b0000000-0000-0000-0000-000000000111', 'd2222222-2222-2222-2222-222222222222', 26.00, 'جيد جداً'),
  ('b0000000-0000-0000-0000-000000000112', 'd2222222-2222-2222-2222-222222222222', 28.50, 'ممتاز'),

  -- Exam 3 (Max 50)
  ('b0000000-0000-0000-0000-000000000113', 'd3333333-3333-3333-3333-333333333333', 49.50, 'الأول على الدفعة - عبقري 🌟'),
  ('b0000000-0000-0000-0000-000000000114', 'd3333333-3333-3333-3333-333333333333', 48.00, 'ممتازة وواعدة'),
  ('b0000000-0000-0000-0000-000000000115', 'd3333333-3333-3333-3333-333333333333', 46.50, 'جيد جداً مرتفع'),
  ('b0000000-0000-0000-0000-000000000116', 'd3333333-3333-3333-3333-333333333333', 47.00, 'ممتازة'),
  ('b0000000-0000-0000-0000-000000000117', 'd3333333-3333-3333-3333-333333333333', 45.00, 'جيد جداً'),
  ('b0000000-0000-0000-0000-000000000118', 'd3333333-3333-3333-3333-333333333333', 44.00, 'جيد جداً')
ON CONFLICT (student_id, exam_id) DO UPDATE SET
  score = EXCLUDED.score,
  notes = EXCLUDED.notes;

-- Insert Fee Payments for Current & Prior Months
INSERT INTO public.fee_payments (student_id, amount, month, paid_at, notes)
VALUES
  -- September 2026 Payments
  ('b0000000-0000-0000-0000-000000000101', 500.00, '2026-09', now() - INTERVAL '15 days', 'سداد اشتراك شهر سبتمبر - نقدي'),
  ('b0000000-0000-0000-0000-000000000102', 500.00, '2026-09', now() - INTERVAL '14 days', 'سداد اشتراك شهر سبتمبر - فودافون كاش'),
  ('b0000000-0000-0000-0000-000000000103', 500.00, '2026-09', now() - INTERVAL '14 days', 'سداد اشتراك شهر سبتمبر'),
  ('b0000000-0000-0000-0000-000000000104', 450.00, '2026-09', now() - INTERVAL '12 days', 'سداد اشتراك مخفض تفوق'),
  ('b0000000-0000-0000-0000-000000000107', 550.00, '2026-09', now() - INTERVAL '11 days', 'سداد اشتراك شهر سبتمبر'),
  ('b0000000-0000-0000-0000-000000000108', 550.00, '2026-09', now() - INTERVAL '10 days', 'سداد اشتراك شهر سبتمبر'),
  ('b0000000-0000-0000-0000-000000000110', 500.00, '2026-09', now() - INTERVAL '9 days', 'سداد اشتراك إخوة'),
  ('b0000000-0000-0000-0000-000000000113', 600.00, '2026-09', now() - INTERVAL '8 days', 'سداد اشتراك كورس مكثف'),
  ('b0000000-0000-0000-0000-000000000114', 600.00, '2026-09', now() - INTERVAL '7 days', 'سداد اشتراك كورس مكثف'),
  ('b0000000-0000-0000-0000-000000000115', 600.00, '2026-09', now() - INTERVAL '6 days', 'سداد اشتراك كورس مكثف'),
  ('b0000000-0000-0000-0000-000000000116', 600.00, '2026-09', now() - INTERVAL '5 days', 'سداد اشتراك كورس مكثف'),
  ('b0000000-0000-0000-0000-000000000117', 600.00, '2026-09', now() - INTERVAL '4 days', 'سداد اشتراك كورس مكثف'),

  -- October 2026 Payments
  ('b0000000-0000-0000-0000-000000000101', 500.00, '2026-10', now() - INTERVAL '1 day', 'سداد مبكر لشهر أكتوبر'),
  ('b0000000-0000-0000-0000-000000000102', 500.00, '2026-10', now() - INTERVAL '1 day', 'سداد مبكر لشهر أكتوبر'),
  ('b0000000-0000-0000-0000-000000000113', 600.00, '2026-10', now() - INTERVAL '2 hours', 'سداد مبكر لشهر أكتوبر');

-- Insert Sample Pre-printed Unassigned Card Tokens
INSERT INTO public.card_tokens (barcode_token, is_assigned)
VALUES
  ('CARD-DEMO-01', false),
  ('CARD-DEMO-02', false),
  ('CARD-DEMO-03', false),
  ('CARD-DEMO-04', false)
ON CONFLICT (barcode_token) DO NOTHING;
