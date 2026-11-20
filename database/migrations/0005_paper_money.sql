-- Paper money is an optional monthly charge with its own payment status.
ALTER TABLE student_fees
  ADD COLUMN IF NOT EXISTS paper_fee integer CHECK (paper_fee > 0);

ALTER TABLE fee_rows
  ADD COLUMN IF NOT EXISTS paper_amount integer CHECK (paper_amount > 0),
  ADD COLUMN IF NOT EXISTS paper_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paper_paid_by uuid REFERENCES users(id);
