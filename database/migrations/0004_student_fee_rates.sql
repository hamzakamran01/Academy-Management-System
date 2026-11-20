-- Give existing students their own rate from their open or most recent enrollment.
-- Existing student rates and all billed amounts retain their original values.
WITH latest_enrollment AS (
  SELECT DISTINCT ON (student_id) student_id, class_id
  FROM enrollments
  ORDER BY student_id, (to_date IS NULL) DESC, from_date DESC, id
)
INSERT INTO student_fees (student_id, monthly_fee, set_by, set_at)
SELECT e.student_id, cf.monthly_fee, cf.set_by, cf.set_at
FROM latest_enrollment e
JOIN class_fees cf ON cf.class_id = e.class_id
ON CONFLICT (student_id) DO NOTHING;
