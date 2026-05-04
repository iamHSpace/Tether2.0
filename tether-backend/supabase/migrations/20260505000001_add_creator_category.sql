-- Add category to profiles for creator channel type
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
    'Gaming', 'Tech & Science', 'Education', 'Lifestyle', 'Vlog',
    'Beauty & Fashion', 'Food & Cooking', 'Travel', 'Fitness & Health',
    'Business & Finance', 'Comedy & Entertainment', 'Music',
    'Art & Design', 'Sports', 'Kids & Family', 'DIY & How-to',
    'News & Politics', 'Other'
  ));
