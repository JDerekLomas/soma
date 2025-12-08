import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Settings,
  LogOut,
  User,
  Bot,
  Loader2,
  Menu,
  X,
  Trash2,
  Users,
  Sparkles
} from 'lucide-react';
import Auth from './components/Auth';
import AIDirectory from './components/AIDirectory';
import MarkdownRenderer from './components/MarkdownRenderer';
import {
  onAuthStateChange,
  signOut,
  getCurrentUser,
  getUserProfile,
  getPersonalAI,
  getAIById,
  updatePersonalAI,
  getConversations,
  createConversation,
  deleteConversation,
  getMessages,
  addMessage,
  updateConversation,
  useInviteLink
} from './utils/supabase';

// --- Design System ---
const COLORS = {
  bg: '#F4F4F2',
  text: '#2D2D2A',
  accent: '#D97757',
  accentHover: '#C06345',
  secondary: '#E8E6E1',
  surface: '#FFFFFF',
  sidebar: '#F2F0EB'
};

// --- AI Provider Options ---
const AI_PROVIDERS = [
  { id: 'auto', name: 'Auto (Best Match)', icon: Sparkles },
  { id: 'claude', name: 'Claude', color: '#D97757' },
  { id: 'openai', name: 'ChatGPT', color: '#10A37F' },
  { id: 'gemini', name: 'Gemini', color: '#4285F4' },
  { id: 'grok', name: 'Grok', color: '#1DA1F2' }
];

export default function SomaApp() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // User data
  const [profile, setProfile] = useState(null);
  const [personalAI, setPersonalAI] = useState(null);

  // Chat state
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // AI settings
  const [selectedProvider, setSelectedProvider] = useState('auto');

  // External AI chat state
  const [targetAI, setTargetAI] = useState(null); // The external AI being chatted with

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await loadUserData(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setPersonalAI(null);
        setConversations([]);
        setMessages([]);
      }
      setAuthLoading(false);
    });

    // Check current session
    getCurrentUser().then(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await loadUserData(currentUser.id);
      }
      setAuthLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Load user data
  const loadUserData = async (userId) => {
    const [userProfile, userAI, userConversations] = await Promise.all([
      getUserProfile(userId),
      getPersonalAI(userId),
      getConversations(userId)
    ]);

    setProfile(userProfile);
    setPersonalAI(userAI);
    setConversations(userConversations || []);

    // Load most recent conversation or create new one
    if (userConversations?.length > 0) {
      setActiveConversationId(userConversations[0].id);
      const msgs = await getMessages(userConversations[0].id);
      setMessages(msgs || []);
    }
  };

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      // Find the conversation to check if it has a target_ai_id
      const convo = conversations.find(c => c.id === activeConversationId);
      if (convo?.target_ai_id) {
        // Load the target AI for external conversations
        getAIById(convo.target_ai_id).then(ai => setTargetAI(ai));
      } else {
        setTargetAI(null);
      }

      getMessages(activeConversationId).then(msgs => {
        setMessages(msgs || []);
      });
    }
  }, [activeConversationId, conversations]);

  // Check for invite code in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('invite');
    if (inviteCode) {
      // Store for use after signup
      sessionStorage.setItem('pendingInvite', inviteCode);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle new chat (with own AI)
  const handleNewChat = async () => {
    if (!user) return;

    const newConvo = await createConversation(user.id, 'New Chat', 'personal');
    if (newConvo) {
      setConversations(prev => [newConvo, ...prev]);
      setActiveConversationId(newConvo.id);
      setMessages([]);
      setTargetAI(null);
      inputRef.current?.focus();
    }
  };

  // Handle chat with external AI (from directory)
  const handleChatWithAI = async (ai) => {
    if (!user) return;

    // Check if we already have a conversation with this AI
    const existingConvo = conversations.find(c => c.target_ai_id === ai.id);
    if (existingConvo) {
      setActiveConversationId(existingConvo.id);
      setTargetAI(ai);
      return;
    }

    // Create new conversation with external AI
    const newConvo = await createConversation(
      user.id,
      `Chat with ${ai.name}`,
      'external_ai',
      ai.id
    );
    if (newConvo) {
      setConversations(prev => [newConvo, ...prev]);
      setActiveConversationId(newConvo.id);
      setMessages([]);
      setTargetAI(ai);
      inputRef.current?.focus();
    }
  };

  // Handle delete chat
  const handleDeleteChat = async (convoId, e) => {
    e.stopPropagation();
    await deleteConversation(convoId);
    setConversations(prev => prev.filter(c => c.id !== convoId));

    if (activeConversationId === convoId) {
      const remaining = conversations.filter(c => c.id !== convoId);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!input.trim() || !user || !personalAI || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Ensure we have a conversation
    let convoId = activeConversationId;
    if (!convoId) {
      const newConvo = await createConversation(user.id, userMessage.slice(0, 50));
      if (!newConvo) {
        setIsLoading(false);
        return;
      }
      convoId = newConvo.id;
      setConversations(prev => [newConvo, ...prev]);
      setActiveConversationId(convoId);
    }

    // Add user message to DB and state
    const userMsg = await addMessage(convoId, 'user', user.id, userMessage);
    if (userMsg) {
      setMessages(prev => [...prev, userMsg]);
    }

    // Update conversation title if first message
    if (messages.length === 0) {
      await updateConversation(convoId, { title: userMessage.slice(0, 50) });
      setConversations(prev =>
        prev.map(c =>
          c.id === convoId ? { ...c, title: userMessage.slice(0, 50) } : c
        )
      );
    }

    try {
      // Determine which AI to use (own AI or target external AI)
      const activeAI = targetAI || personalAI;
      const systemPrompt = activeAI.system_prompt || `You are ${activeAI.name}, a helpful personal AI assistant.`;

      // Call AI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }].map(m => ({
            role: m.sender_type === 'user' ? 'user' : 'assistant',
            content: m.content
          })),
          system: systemPrompt,
          provider: activeAI.preferred_provider || selectedProvider,
          model: null // Let the API choose
        })
      });

      if (!response.ok) throw new Error('API request failed');

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';
      let aiMsgId = null;

      // Add placeholder AI message
      const tempAiMsg = {
        id: 'temp-' + Date.now(),
        conversation_id: convoId,
        sender_type: 'ai',
        sender_id: activeAI.id,
        content: '',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempAiMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                aiContent += data.content;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === tempAiMsg.id ? { ...m, content: aiContent } : m
                  )
                );
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Save final AI message to DB
      if (aiContent) {
        const savedAiMsg = await addMessage(convoId, 'ai', activeAI.id, aiContent, {
          provider: activeAI.preferred_provider || selectedProvider
        });
        if (savedAiMsg) {
          setMessages(prev =>
            prev.map(m =>
              m.id === tempAiMsg.id ? savedAiMsg : m
            )
          );
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev =>
        prev.map(m =>
          m.id?.startsWith('temp-')
            ? { ...m, content: 'Sorry, there was an error processing your request.' }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    setUser(null);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F2]">
        <Loader2 className="w-8 h-8 animate-spin text-[#D97757]" />
      </div>
    );
  }

  // Auth screen
  if (!user) {
    return <Auth onAuthSuccess={setUser} />;
  }

  return (
    <div className="h-screen flex bg-[#F4F4F2]">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 bg-[#F2F0EB] border-r border-[#E8E6E1] flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#E8E6E1]">
          <button
            onClick={handleNewChat}
            className="w-full py-2 px-4 bg-[#D97757] hover:bg-[#C06345] text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map(convo => (
            <div
              key={convo.id}
              onClick={() => setActiveConversationId(convo.id)}
              className={`p-3 rounded-lg cursor-pointer mb-1 group flex items-center justify-between ${
                activeConversationId === convo.id
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-white/50'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare className="w-4 h-4 text-[#999] flex-shrink-0" />
                <span className="text-sm text-[#2D2D2A] truncate">
                  {convo.title || 'New Chat'}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteChat(convo.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar Footer - User */}
        <div className="p-4 border-t border-[#E8E6E1]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D97757] flex items-center justify-center text-white text-sm">
              {profile?.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-[#2D2D2A] truncate">
                {profile?.display_name || user.email}
              </p>
              <p className="text-xs text-[#999] truncate">
                {personalAI?.name || 'My AI'}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-[#E8E6E1] rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-[#999]" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-[#E8E6E1] bg-white flex items-center px-4 gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-[#F4F4F2] rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-[#2D2D2A]" />
          </button>

          <div className="flex-1">
            <h1 className="text-lg font-semibold text-[#2D2D2A]">
              {targetAI ? `Chatting with ${targetAI.name}` : 'Soma'}
            </h1>
            {targetAI && (
              <p className="text-xs text-[#666]">by {targetAI.users?.display_name}</p>
            )}
          </div>

          {/* AI Directory Button */}
          <button
            onClick={() => setDirectoryOpen(true)}
            className="p-2 hover:bg-[#F4F4F2] rounded-lg transition-colors"
            title="AI Network"
          >
            <Users className="w-5 h-5 text-[#2D2D2A]" />
          </button>

          {/* Provider Selector */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-3 py-1.5 bg-[#F4F4F2] border border-[#E8E6E1] rounded-lg text-sm text-[#2D2D2A] focus:outline-none focus:ring-1 focus:ring-[#D97757]"
          >
            {AI_PROVIDERS.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 hover:bg-[#F4F4F2] rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-[#2D2D2A]" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Bot className="w-16 h-16 text-[#D97757] mb-4" />
              <h2 className="text-xl font-semibold text-[#2D2D2A] mb-2">
                {personalAI?.name || 'Your Personal AI'}
              </h2>
              <p className="text-[#666] max-w-md">
                Start a conversation with your AI. It learns from your interactions
                and can be customized to your preferences.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex gap-3 ${
                    msg.sender_type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender_type !== 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#D97757] flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      msg.sender_type === 'user'
                        ? 'bg-[#D97757] text-white'
                        : 'bg-white shadow-sm'
                    }`}
                  >
                    {msg.sender_type === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                  </div>
                  {msg.sender_type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-[#2D2D2A] flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#E8E6E1] bg-white">
          <div className="max-w-3xl mx-auto flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Message your AI..."
              rows={1}
              className="flex-1 p-3 bg-[#F4F4F2] border border-[#E8E6E1] rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-[#D97757] focus:border-[#D97757]"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-[#D97757] hover:bg-[#C06345] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[#2D2D2A]">AI Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-2 hover:bg-[#F4F4F2] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2D2A] mb-2">
                  AI Name
                </label>
                <input
                  type="text"
                  value={personalAI?.name || ''}
                  onChange={async (e) => {
                    const updated = await updatePersonalAI(personalAI.id, { name: e.target.value });
                    if (updated) setPersonalAI(updated);
                  }}
                  className="w-full p-3 bg-[#F4F4F2] border border-[#E8E6E1] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D97757]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2D2A] mb-2">
                  System Prompt
                </label>
                <textarea
                  value={personalAI?.system_prompt || ''}
                  onChange={async (e) => {
                    const updated = await updatePersonalAI(personalAI.id, { system_prompt: e.target.value });
                    if (updated) setPersonalAI(updated);
                  }}
                  rows={5}
                  placeholder="Define your AI's personality and instructions..."
                  className="w-full p-3 bg-[#F4F4F2] border border-[#E8E6E1] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D97757] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#2D2D2A] mb-2">
                  Default AI Provider
                </label>
                <select
                  value={personalAI?.preferred_provider || 'auto'}
                  onChange={async (e) => {
                    const updated = await updatePersonalAI(personalAI.id, { preferred_provider: e.target.value });
                    if (updated) setPersonalAI(updated);
                  }}
                  className="w-full p-3 bg-[#F4F4F2] border border-[#E8E6E1] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D97757]"
                >
                  {AI_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="public"
                  checked={personalAI?.is_public || false}
                  onChange={async (e) => {
                    const updated = await updatePersonalAI(personalAI.id, { is_public: e.target.checked });
                    if (updated) setPersonalAI(updated);
                  }}
                  className="w-4 h-4 text-[#D97757] rounded"
                />
                <label htmlFor="public" className="text-sm text-[#2D2D2A]">
                  Make AI public (allow other AIs to communicate with yours)
                </label>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E8E6E1]">
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full py-3 bg-[#D97757] hover:bg-[#C06345] text-white rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Directory Modal */}
      <AIDirectory
        isOpen={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        currentUserId={user?.id}
        onChatWithAI={handleChatWithAI}
      />
    </div>
  );
}
