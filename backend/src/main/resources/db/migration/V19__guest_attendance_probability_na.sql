-- Adds NA (not applicable -- e.g. a guest who was never expected to attend a poll, or the
-- probability question doesn't apply to them) as a valid attendance_probability value, alongside
-- the existing CERTAIN/VERY_LIKELY/LIKELY/MAYBE/UNLIKELY set from V6.
ALTER TABLE guest DROP CONSTRAINT guest_attendance_probability_check;
ALTER TABLE guest ADD CONSTRAINT guest_attendance_probability_check
  CHECK (attendance_probability IN ('CERTAIN','VERY_LIKELY','LIKELY','MAYBE','UNLIKELY','NA'));
