'use client';

import { useState } from 'react';
import { Users, ThumbsUp, Copy, Check, DollarSign, QrCode, Share2, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useSquadStore } from '@/store/useSquadStore';

interface GroupCollaborationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  roomCode?: string;
}

export function GroupCollaborationModal({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  roomCode,
}: GroupCollaborationModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { members, squadCode } = useSquadStore();

  const isModalOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const handleClose = externalOnClose || (() => setInternalIsOpen(false));

  const effectiveCode = roomCode || squadCode;
  const inviteUrl = `https://dashtiny.com/trips/join?code=${effectiveCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Join our squad getaway on Dashtiny! Live co-planning & itinerary voting: ${inviteUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <>
      {externalIsOpen === undefined && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInternalIsOpen(true)}
          className="bg-white border-slate-200 text-slate-900 hover:bg-slate-50 font-extrabold shadow-2xs"
        >
          <Users className="w-4 h-4 mr-1.5 text-orange-600" />
          <span>Squad Vote & Invite</span>
        </Button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
          <Card className="w-full max-w-xl bg-white border border-slate-200/90 shadow-2xl p-6 space-y-6 relative max-h-[90vh] overflow-y-auto rounded-3xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center border border-orange-200 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Squad Co-Planning Studio</h3>
                  <p className="text-xs text-slate-500 font-medium">Invite friends to co-plan, vote on activities & split costs</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-900 text-lg font-extrabold p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Shareable Squad Link & WhatsApp */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" /> Instant Squad Invite Link
              </label>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="truncate text-xs text-slate-800 font-mono font-bold w-full">
                  {inviteUrl}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Button size="sm" variant="primary" onClick={handleCopyLink} className="flex-1 sm:flex-initial bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-sm">
                    {copiedLink ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1 text-white" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                  </Button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-extrabold text-xs flex items-center gap-1 shadow-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* QR Code & Join Code */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 via-white to-sky-50 border border-orange-200/90 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-orange-700">Squad Access Code</span>
                <p className="text-xl font-mono font-extrabold text-slate-900 tracking-wider">{squadCode}</p>
                <p className="text-[11px] text-slate-600 font-medium">Scan QR to join instantly on phone</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                <QrCode className="w-12 h-12 text-slate-900" />
              </div>
            </div>

            {/* Active Squad Members List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Squad Members ({members.length} Joined)</span>
                <span className="text-[11px] text-orange-600 font-extrabold">All 4 Verified</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center">
                        {m.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{m.role.toUpperCase()} • {m.vibe}</p>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

