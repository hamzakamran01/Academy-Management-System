-- A student rate of NULL inherits the class default; zero exempts the student.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS paper_fee integer CHECK (paper_fee > 0);

ALTER TABLE student_fees
  DROP CONSTRAINT IF EXISTS student_fees_paper_fee_check,
  ADD CONSTRAINT student_fees_paper_fee_check CHECK (paper_fee >= 0);
