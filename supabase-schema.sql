-- Soma Multi-User AI Platform Database Schema
-- Run this in Supabase SQL Editor: https://gtgltxaixpnclilmkshj.supabase.co

-- ============================================
-- USERS & PERSONAL AI CONFIGURATION
-- ============================================

-- User profiles with personal AI settings
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal AI configuration for each user
CREATE TABLE IF NOT EXISTS personal_ais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My AI',
  avatar_url TEXT,
  system_prompt TEXT,
  personality_traits JSONB DEFAULT '[]',
  preferred_provider TEXT DEFAULT 'auto',
  model_preferences JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  is_discoverable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  conversation_type TEXT DEFAULT 'personal',
  participant_ids UUID[] DEFAULT '{}',
  ai_participant_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  token_usage JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI MEMORY & KNOWLEDGE BASE
-- ============================================

CREATE TABLE IF NOT EXISTS ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_ai_id UUID REFERENCES personal_ais(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_ai_id UUID REFERENCES personal_ais(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  doc_type TEXT DEFAULT 'text',
  source_url TEXT,
  chunks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AI-TO-AI COMMUNICATION
-- ============================================

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_ai_id UUID REFERENCES personal_ais(id) ON DELETE CASCADE,
  to_ai_id UUID REFERENCES personal_ais(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  response TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_ais ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Personal AI policies
CREATE POLICY "Users can manage own AI" ON personal_ais
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public AIs are viewable" ON personal_ais
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

-- Conversation policies
CREATE POLICY "Users can access own conversations" ON conversations
  FOR ALL USING (auth.uid() = owner_id OR auth.uid() = ANY(participant_ids));

-- Message policies
CREATE POLICY "Users can access messages in their conversations" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.owner_id = auth.uid() OR auth.uid() = ANY(conversations.participant_ids))
    )
  );

-- AI Memory policies
CREATE POLICY "Users can manage their AI memories" ON ai_memories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM personal_ais
      WHERE personal_ais.id = ai_memories.personal_ai_id
      AND personal_ais.user_id = auth.uid()
    )
  );

-- Knowledge document policies
CREATE POLICY "Users can manage their AI knowledge" ON knowledge_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM personal_ais
      WHERE personal_ais.id = knowledge_documents.personal_ai_id
      AND personal_ais.user_id = auth.uid()
    )
  );

-- AI-to-AI message policies
CREATE POLICY "AI owners can view AI messages" ON ai_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM personal_ais
      WHERE (personal_ais.id = ai_messages.from_ai_id OR personal_ais.id = ai_messages.to_ai_id)
      AND personal_ais.user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_personal_ais_user ON personal_ais(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_owner ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_ai ON ai_memories(personal_ai_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_ai ON knowledge_documents(personal_ai_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_from ON ai_messages(from_ai_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_to ON ai_messages(to_ai_id);

-- ============================================
-- AUTO-CREATE USER ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  INSERT INTO personal_ais (user_id, name)
  VALUES (NEW.id, 'My AI');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_personal_ais_timestamp BEFORE UPDATE ON personal_ais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_conversations_timestamp BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
