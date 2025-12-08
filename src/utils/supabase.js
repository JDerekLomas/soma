import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================
// AUTHENTICATION
// ============================================

export const signUp = async (email, password, displayName) => {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: displayName }
    }
  });

  return { data, error };
};

export const signIn = async (email, password) => {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return { data, error };
};

export const signOut = async () => {
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const onAuthStateChange = (callback) => {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };

  return supabase.auth.onAuthStateChange(callback);
};

// ============================================
// USER PROFILE
// ============================================

export const getUserProfile = async (userId) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) console.warn('Failed to get user profile:', error);
  return data;
};

export const updateUserProfile = async (userId, updates) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) console.warn('Failed to update user profile:', error);
  return data;
};

// ============================================
// PERSONAL AI
// ============================================

export const getPersonalAI = async (userId) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('personal_ais')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Failed to get personal AI:', error);
  }
  return data;
};

export const updatePersonalAI = async (aiId, updates) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('personal_ais')
    .update(updates)
    .eq('id', aiId)
    .select()
    .single();

  if (error) console.warn('Failed to update personal AI:', error);
  return data;
};

export const getPublicAIs = async (excludeUserId = null) => {
  if (!supabase) return [];

  let query = supabase
    .from('personal_ais')
    .select(`
      *,
      users(id, display_name, avatar_url)
    `)
    .eq('is_discoverable', true);

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data, error } = await query;

  if (error) console.warn('Failed to get public AIs:', error);
  return data || [];
};

export const getAIById = async (aiId) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('personal_ais')
    .select(`
      *,
      users(id, display_name, avatar_url)
    `)
    .eq('id', aiId)
    .single();

  if (error) console.warn('Failed to get AI:', error);
  return data;
};

// ============================================
// CONVERSATIONS
// ============================================

export const getConversations = async (userId) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`owner_id.eq.${userId},participant_ids.cs.{${userId}}`)
    .order('updated_at', { ascending: false });

  if (error) console.warn('Failed to get conversations:', error);
  return data || [];
};

export const createConversation = async (ownerId, title = 'New Chat', type = 'personal', targetAiId = null) => {
  if (!supabase) return null;

  const insertData = {
    owner_id: ownerId,
    title,
    conversation_type: type
  };

  if (targetAiId) {
    insertData.target_ai_id = targetAiId;
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert(insertData)
    .select()
    .single();

  if (error) console.warn('Failed to create conversation:', error);
  return data;
};

export const updateConversation = async (conversationId, updates) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)
    .select()
    .single();

  if (error) console.warn('Failed to update conversation:', error);
  return data;
};

export const deleteConversation = async (conversationId) => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) console.warn('Failed to delete conversation:', error);
  return !error;
};

// ============================================
// MESSAGES
// ============================================

export const getMessages = async (conversationId) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) console.warn('Failed to get messages:', error);
  return data || [];
};

export const addMessage = async (conversationId, senderType, senderId, content, metadata = {}) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      sender_id: senderId,
      content,
      ...metadata
    })
    .select()
    .single();

  if (error) console.warn('Failed to add message:', error);
  return data;
};

export const updateMessage = async (messageId, updates) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId)
    .select()
    .single();

  if (error) console.warn('Failed to update message:', error);
  return data;
};

// ============================================
// AI MEMORY
// ============================================

export const getAIMemories = async (personalAiId, limit = 50) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('ai_memories')
    .select('*')
    .eq('personal_ai_id', personalAiId)
    .order('importance', { ascending: false })
    .limit(limit);

  if (error) console.warn('Failed to get AI memories:', error);
  return data || [];
};

export const addAIMemory = async (personalAiId, memoryType, content, importance = 0.5) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('ai_memories')
    .insert({
      personal_ai_id: personalAiId,
      memory_type: memoryType,
      content,
      importance
    })
    .select()
    .single();

  if (error) console.warn('Failed to add AI memory:', error);
  return data;
};

// ============================================
// KNOWLEDGE DOCUMENTS
// ============================================

export const getKnowledgeDocs = async (personalAiId) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('personal_ai_id', personalAiId)
    .order('created_at', { ascending: false });

  if (error) console.warn('Failed to get knowledge docs:', error);
  return data || [];
};

export const addKnowledgeDoc = async (personalAiId, title, content, docType = 'text') => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('knowledge_documents')
    .insert({
      personal_ai_id: personalAiId,
      title,
      content,
      doc_type: docType
    })
    .select()
    .single();

  if (error) console.warn('Failed to add knowledge doc:', error);
  return data;
};

// ============================================
// AI-TO-AI MESSAGING
// ============================================

export const sendAIMessage = async (fromAiId, toAiId, content) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('ai_messages')
    .insert({
      from_ai_id: fromAiId,
      to_ai_id: toAiId,
      content,
      status: 'pending'
    })
    .select()
    .single();

  if (error) console.warn('Failed to send AI message:', error);
  return data;
};

export const getAIMessages = async (aiId) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('ai_messages')
    .select(`
      *,
      from_ai:from_ai_id(name, user_id),
      to_ai:to_ai_id(name, user_id)
    `)
    .or(`from_ai_id.eq.${aiId},to_ai_id.eq.${aiId}`)
    .order('created_at', { ascending: false });

  if (error) console.warn('Failed to get AI messages:', error);
  return data || [];
};

export const respondToAIMessage = async (messageId, response) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('ai_messages')
    .update({
      response,
      status: 'completed',
      responded_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) console.warn('Failed to respond to AI message:', error);
  return data;
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export const subscribeToMessages = (conversationId, callback) => {
  if (!supabase) return { unsubscribe: () => {} };

  const subscription = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      callback
    )
    .subscribe();

  return subscription;
};

export const subscribeToAIMessages = (aiId, callback) => {
  if (!supabase) return { unsubscribe: () => {} };

  const subscription = supabase
    .channel(`ai_messages:${aiId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ai_messages',
        filter: `to_ai_id=eq.${aiId}`
      },
      callback
    )
    .subscribe();

  return subscription;
};

// ============================================
// INVITE LINKS
// ============================================

export const createInviteLink = async (userId, expiresInDays = null, maxUses = null) => {
  if (!supabase) return null;

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const insertData = {
    code,
    created_by: userId
  };

  if (expiresInDays) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    insertData.expires_at = expiresAt.toISOString();
  }

  if (maxUses) {
    insertData.uses_remaining = maxUses;
  }

  const { data, error } = await supabase
    .from('invite_links')
    .insert(insertData)
    .select()
    .single();

  if (error) console.warn('Failed to create invite link:', error);
  return data;
};

export const getInviteLink = async (code) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('invite_links')
    .select('*')
    .eq('code', code)
    .single();

  if (error) return null;

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Check if uses exhausted
  if (data.uses_remaining !== null && data.uses_remaining <= 0) {
    return null;
  }

  return data;
};

export const useInviteLink = async (code) => {
  if (!supabase) return false;

  const link = await getInviteLink(code);
  if (!link) return false;

  // Decrement uses if limited
  if (link.uses_remaining !== null) {
    const { error } = await supabase
      .from('invite_links')
      .update({ uses_remaining: link.uses_remaining - 1 })
      .eq('id', link.id);

    if (error) return false;
  }

  return true;
};

export const getMyInviteLinks = async (userId) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('invite_links')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });

  if (error) console.warn('Failed to get invite links:', error);
  return data || [];
};

export const deleteInviteLink = async (linkId) => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('invite_links')
    .delete()
    .eq('id', linkId);

  return !error;
};
