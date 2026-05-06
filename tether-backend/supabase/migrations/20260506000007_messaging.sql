-- Messaging: conversations between creators and businesses

CREATE TABLE conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id, business_id)
);

CREATE INDEX conversations_creator_idx  ON conversations (creator_id);
CREATE INDEX conversations_business_idx ON conversations (business_id);
CREATE INDEX conversations_updated_idx  ON conversations (last_message_at DESC);

CREATE TABLE messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body            TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conv_time_idx ON messages (conversation_id, created_at);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (auth.uid() = creator_id OR auth.uid() = business_id);

CREATE POLICY "conversations_insert" ON conversations FOR INSERT
  WITH CHECK (auth.uid() = creator_id OR auth.uid() = business_id);

CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE creator_id = auth.uid() OR business_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM conversations
      WHERE creator_id = auth.uid() OR business_id = auth.uid()
    )
  );

CREATE POLICY "messages_update_read" ON messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE creator_id = auth.uid() OR business_id = auth.uid()
    )
  );
