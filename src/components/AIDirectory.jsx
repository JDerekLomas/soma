import { useState, useEffect } from 'react';
import { Users, MessageSquare, Bot, X, Loader2, Link, Copy, Check, Plus, Trash2 } from 'lucide-react';
import { getPublicAIs, createInviteLink, getMyInviteLinks, deleteInviteLink } from '../utils/supabase';

export default function AIDirectory({
  isOpen,
  onClose,
  currentUserId,
  onChatWithAI
}) {
  const [ais, setAis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'invites'
  const [inviteLinks, setInviteLinks] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [creatingLink, setCreatingLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentUserId]);

  const loadData = async () => {
    setLoading(true);
    const [publicAIs, links] = await Promise.all([
      getPublicAIs(currentUserId),
      getMyInviteLinks(currentUserId)
    ]);
    setAis(publicAIs);
    setInviteLinks(links);
    setLoading(false);
  };

  const handleCreateInvite = async () => {
    setCreatingLink(true);
    const link = await createInviteLink(currentUserId);
    if (link) {
      setInviteLinks(prev => [link, ...prev]);
    }
    setCreatingLink(false);
  };

  const handleDeleteInvite = async (linkId) => {
    await deleteInviteLink(linkId);
    setInviteLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const copyInviteLink = (code) => {
    const url = `${window.location.origin}?invite=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E8E6E1]">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#D97757]" />
            <h2 className="text-lg font-semibold text-[#2D2D2A]">AI Network</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F4F4F2] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#666]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E8E6E1]">
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'directory'
                ? 'text-[#D97757] border-b-2 border-[#D97757]'
                : 'text-[#666] hover:text-[#2D2D2A]'
            }`}
          >
            AI Directory
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'invites'
                ? 'text-[#D97757] border-b-2 border-[#D97757]'
                : 'text-[#666] hover:text-[#2D2D2A]'
            }`}
          >
            Invite Links
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#D97757]" />
            </div>
          ) : activeTab === 'directory' ? (
            <>
              {ais.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-[#ccc] mx-auto mb-3" />
                  <p className="text-[#666]">No other AIs in the network yet.</p>
                  <p className="text-sm text-[#999] mt-1">Invite friends to join!</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {ais.map(ai => (
                    <div
                      key={ai.id}
                      className="flex items-center gap-4 p-4 bg-[#F4F4F2] rounded-xl hover:bg-[#E8E6E1] transition-colors"
                    >
                      {/* AI Avatar */}
                      <div className="w-12 h-12 rounded-full bg-[#D97757] flex items-center justify-center text-white text-lg font-medium">
                        {ai.name?.[0]?.toUpperCase() || 'A'}
                      </div>

                      {/* AI Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[#2D2D2A]">{ai.name}</h3>
                        <p className="text-sm text-[#666] truncate">
                          by {ai.users?.display_name || 'Unknown'}
                        </p>
                        {ai.system_prompt && (
                          <p className="text-xs text-[#999] mt-1 line-clamp-1">
                            {ai.system_prompt.slice(0, 80)}...
                          </p>
                        )}
                      </div>

                      {/* Chat Button */}
                      <button
                        onClick={() => {
                          onChatWithAI(ai);
                          onClose();
                        }}
                        className="px-4 py-2 bg-[#D97757] hover:bg-[#C06345] text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Invite Links Tab */}
              <div className="mb-4">
                <button
                  onClick={handleCreateInvite}
                  disabled={creatingLink}
                  className="w-full py-3 bg-[#D97757] hover:bg-[#C06345] text-white rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {creatingLink ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create Invite Link
                </button>
              </div>

              {inviteLinks.length === 0 ? (
                <div className="text-center py-8">
                  <Link className="w-10 h-10 text-[#ccc] mx-auto mb-3" />
                  <p className="text-[#666]">No invite links yet.</p>
                  <p className="text-sm text-[#999] mt-1">Create one to invite friends!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inviteLinks.map(link => (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 p-3 bg-[#F4F4F2] rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-sm text-[#2D2D2A] font-mono">
                          {link.code}
                        </code>
                        <p className="text-xs text-[#999] mt-1">
                          Created {new Date(link.created_at).toLocaleDateString()}
                          {link.uses_remaining !== null && ` • ${link.uses_remaining} uses left`}
                        </p>
                      </div>
                      <button
                        onClick={() => copyInviteLink(link.code)}
                        className="p-2 hover:bg-[#E8E6E1] rounded-lg transition-colors"
                        title="Copy invite link"
                      >
                        {copiedId === link.code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#666]" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(link.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete invite"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
