-- ============================================
-- GBHS Pilot Dadu — Demo Data Seed Script
-- Run this in Supabase SQL Editor to instantly
-- populate the portal with realistic sample data
-- for a presentation. Safe to run once.
-- ============================================

-- 1. Classes
insert into public.classes (grade, section) values
  ('6', 'A'),
  ('7', 'A'),
  ('8', 'A'),
  ('9', 'A'),
  ('10', 'A');

-- 2. Teachers (demo records, not linked to logins yet)
insert into public.teachers (full_name, subject) values
  ('Omar Sheikh', 'Mathematics'),
  ('Zainab Hussain', 'Science'),
  ('Mehreen Qureshi', 'English'),
  ('Hamza Tariq', 'Physical Education');

-- 3. Students — spread across the 5 classes
insert into public.students (full_name, roll_no, class_id)
select s.full_name, s.roll_no, c.id
from (values
  ('Ali Raza', '1', '6'), ('Bilal Shar', '2', '6'), ('Hassan Memon', '3', '6'),
  ('Kashif Solangi', '1', '7'), ('Nasir Chandio', '2', '7'), ('Waseem Bhatti', '3', '7'),
  ('Iqbal Rind', '1', '8'), ('Sajjad Lashari', '2', '8'), ('Fahad Khoso', '3', '8'),
  ('Ahmed Nawaz', '1', '9'), ('Imran Jokhio', '2', '9'), ('Zubair Panhwar', '3', '9'),
  ('Farooq Dahri', '1', '10'), ('Junaid Mahar', '2', '10'), ('Saqib Bhutto', '3', '10')
) as s(full_name, roll_no, grade)
join public.classes c on c.grade = s.grade and c.section = 'A';

-- 4. Attendance — last 5 school days for every student
insert into public.attendance (student_id, date, status)
select st.id, d.date, case when random() > 0.12 then 'present' else 'absent' end
from public.students st
cross join (
  select (current_date - i) as date
  from generate_series(1, 5) as i
  where extract(dow from (current_date - i)) not in (0, 6)  -- skip weekends
) d;

-- 5. Assignments — one per class
insert into public.assignments (class_id, subject, title, due_date)
select c.id, 'Mathematics', 'Chapter review exercise', current_date + 7
from public.classes c;

-- 6. Exam results — one term test per student
insert into public.exam_results (student_id, subject, exam_name, marks_obtained, total_marks, term)
select id, 'Mathematics', 'Term 1 Test', (40 + floor(random() * 55))::int, 100, 'Term 1'
from public.students;

-- 7. Fees — annual fund + admission form for every student, mostly paid
insert into public.fees (student_id, charge_name, amount, status)
select id, 'School Fund (Annual)', 200, case when random() > 0.2 then 'paid' else 'unpaid' end
from public.students;

insert into public.fees (student_id, charge_name, amount, status)
select id, 'Admission Form', 50, 'paid'
from public.students;

-- 8. Notices
insert into public.notices (title, body, audience) values
  ('Term 1 Parent-Teacher meeting on 10 October', 'All parents are requested to attend.', 'all'),
  ('Sports Day trials begin next week', 'Report to the PE teacher after class.', 'students'),
  ('Staff meeting Thursday 3 PM', 'Attendance mandatory for all teaching staff.', 'teachers');

-- Done. Refresh your Admin Dashboard to see real numbers everywhere.
