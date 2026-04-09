-- Visit slots and bookings
CREATE TABLE IF NOT EXISTS visit_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id  UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  slot_date   DATE NOT NULL,
  slot_time   TIME NOT NULL,
  duration_min INTEGER DEFAULT 30,
  capacity    INTEGER DEFAULT 1,
  booked      INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_slots_nursery_date ON visit_slots(nursery_id, slot_date);

CREATE TABLE IF NOT EXISTS visit_bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     UUID REFERENCES visit_slots(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nursery_id  UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE visit_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own bookings" ON visit_bookings;
CREATE POLICY "Users see own bookings" ON visit_bookings
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create bookings" ON visit_bookings;
CREATE POLICY "Users create bookings" ON visit_bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_visit_bookings_user ON visit_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_nursery ON visit_bookings(nursery_id);

-- Post-visit micro-survey
CREATE TABLE IF NOT EXISTS visit_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID REFERENCES visit_bookings(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id),
  nursery_id  UUID REFERENCES nurseries(id),
  overall_impression INTEGER CHECK (overall_impression BETWEEN 1 AND 5),
  staff_friendliness INTEGER CHECK (staff_friendliness BETWEEN 1 AND 5),
  facilities_quality INTEGER CHECK (facilities_quality BETWEEN 1 AND 5),
  would_apply BOOLEAN,
  feedback    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics counters
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS compare_count INTEGER DEFAULT 0;
