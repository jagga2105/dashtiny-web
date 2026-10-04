'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Vote,
  Receipt,
  QrCode,
  ThumbsUp,
  ThumbsDown,
  Plus,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Plane,
  Building2,
  Ticket,
  ExternalLink,
  Share2,
  Sparkles,
  ArrowRightLeft,
  UserCheck,
  UserX,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSquadStore, SquadMember } from '@/store/useSquadStore';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

type SquadSubTab = 'voting' | 'expenses' | 'bookings' | 'vault' | 'requests';

interface SquadRoomHubProps {
  squadId?: string;
  tripId?: string;
  onOpenInviteModal?: () => void;
}

export function SquadRoomHub({ squadId, tripId, onOpenInviteModal }: SquadRoomHubProps) {
  const [activeTab, setActiveTab] = useState<SquadSubTab>('voting');
  const { members, votes, expenses, voteActivity, addExpense, squadCode } = useSquadStore();
  const effectiveSquadCode = squadId || squadCode;
  const { user } = useAuthStore();

  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [responseNotice, setResponseNotice] = useState<string | null>(null);

  // Phase 5: Squad Profile & Governance State
  const [squadProfile, setSquadProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [governanceNotice, setGovernanceNotice] = useState<string | null>(null);
  const [governanceError, setGovernanceError] = useState<string | null>(null);

  const loadSquadProfile = async () => {
    if (!tripId && !squadId) return;
    setLoadingProfile(true);
    try {
      let data: any = null;
      if (tripId) {
        data = await apiService.getSquadByTrip(tripId);
      } else if (squadId) {
        data = await apiService.getSquadProfile(squadId);
      }
      if (data && data.squad_id) {
        setSquadProfile(data);
      }
    } catch {
      // offline or not created yet
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: 'co_planner' | 'member') => {
    if (!squadProfile?.squad_id) return;
    setGovernanceError(null);
    setGovernanceNotice(null);
    try {
      await apiService.updateSquadMemberRole(squadProfile.squad_id, targetUserId, newRole);
      setSquadProfile((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m: any) =>
            m.user_id === targetUserId ? { ...m, role: newRole } : m
          ),
        };
      });
      setGovernanceNotice(`Member role updated to ${newRole === 'co_planner' ? 'Co-Planner' : 'Member'}.`);
    } catch (err: any) {
      console.error('Failed to update member role:', err);
      setGovernanceError(err?.detail || err?.message || 'Failed to update member role.');
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!squadProfile?.squad_id) return;
    setGovernanceError(null);
    setGovernanceNotice(null);
    try {
      await apiService.removeSquadMember(squadProfile.squad_id, targetUserId);
      setSquadProfile((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          member_count: Math.max(1, prev.member_count - 1),
          members: prev.members.filter((m: any) => m.user_id !== targetUserId),
        };
      });
      setGovernanceNotice('Member removed from squad.');
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      setGovernanceError(err?.detail || err?.message || 'Failed to remove member.');
    }
  };

  const loadRequests = async () => {
    if (!tripId) return;
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const data = await apiService.getTripInterests(tripId);
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err: any) {
      if (err?.status !== 403 && err?.statusCode !== 403) {
        console.error('Failed to load trip interest requests:', err);
      }
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (tripId) {
      loadRequests();
    }
    loadSquadProfile();
  }, [tripId, squadId]);

  useEffect(() => {
    if (squadProfile?.squad_id || squadId) {
      loadSquadSuggestions();
    }
  }, [squadProfile?.squad_id, squadId, activeTab]);

  const handleRespondRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!tripId) return;
    setProcessingRequestId(requestId);
    setResponseNotice(null);
    setRequestsError(null);
    try {
      await apiService.respondTripInterest(tripId, requestId, action);
      setRequests((prev) =>
        prev.map((r) =>
          r.request_id === requestId || r.id === requestId
            ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' }
            : r
        )
      );
      setResponseNotice(
        action === 'approve'
          ? 'Traveler approved into Squad! They have been added as a member.'
          : 'Interest request declined.'
      );
      if (action === 'approve') {
        await loadSquadProfile();
      }
    } catch (err: any) {
      console.error('Failed to respond to request:', err);
      setRequestsError(err?.detail || err?.message || 'Failed to update request status.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const isOwner = Boolean(
    squadProfile?.members?.some(
      (m: any) => (m.user_id === user?.id || m.user_id === 'user_01') && m.role === 'owner'
    )
  );

  const isCoPlanner = Boolean(
    squadProfile?.members?.some(
      (m: any) => (m.user_id === user?.id || m.user_id === 'user_01') && m.role === 'co_planner'
    )
  );

  const canAcceptSuggestion = isOwner || isCoPlanner;

  // Phase 6: Collaborative DAIna Suggestions & Voting State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionInstruction, setSuggestionInstruction] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const loadSquadSuggestions = async () => {
    const activeSquadId = squadProfile?.squad_id || squadId;
    if (!activeSquadId) return;
    setLoadingSuggestions(true);
    try {
      const data = await apiService.getSquadSuggestions(activeSquadId);
      if (Array.isArray(data)) {
        setSuggestions(data);
      }
    } catch (err: any) {
      console.error('Failed to load squad suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleCreateSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeSquadId = squadProfile?.squad_id || squadId;
    if (!activeSquadId || !suggestionInstruction.trim()) return;

    setSubmittingSuggestion(true);
    setSuggestionNotice(null);
    setSuggestionError(null);
    try {
      const res = await apiService.createSquadSuggestion(activeSquadId, suggestionInstruction.trim());
      if (res?.suggestion) {
        setSuggestions((prev) => [res.suggestion, ...prev]);
        setSuggestionNotice('DAIna generated an itinerary proposal! Your squad can now vote.');
        setSuggestionInstruction('');
      }
    } catch (err: any) {
      console.error('Failed to submit squad suggestion:', err);
      setSuggestionError(err?.detail || err?.message || 'Failed to submit proposal to DAIna.');
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  const handleVoteSuggestion = async (suggestionId: string, vote: 'up' | 'down') => {
    const activeSquadId = squadProfile?.squad_id || squadId;
    if (!activeSquadId) return;
    setActionInProgress(suggestionId);
    try {
      const res = await apiService.voteSquadSuggestion(activeSquadId, suggestionId, vote);
      if (res?.status === 'success') {
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId
              ? {
                  ...s,
                  upvotes: res.upvotes,
                  downvotes: res.downvotes,
                  user_vote: res.user_vote,
                }
              : s
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to vote on suggestion:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    const activeSquadId = squadProfile?.squad_id || squadId;
    if (!activeSquadId) return;
    setActionInProgress(suggestionId);
    setSuggestionNotice(null);
    setSuggestionError(null);
    try {
      const res = await apiService.acceptSquadSuggestion(activeSquadId, suggestionId);
      if (res?.status === 'success') {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestionId ? { ...s, status: 'accepted' } : s))
        );
        setSuggestionNotice('Proposal accepted into itinerary! Canonical revision v(N+1) locked.');
      }
    } catch (err: any) {
      console.error('Failed to accept suggestion:', err);
      setSuggestionError(err?.detail || err?.message || 'Failed to accept suggestion into itinerary.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    const activeSquadId = squadProfile?.squad_id || squadId;
    if (!activeSquadId) return;
    setActionInProgress(suggestionId);
    try {
      const res = await apiService.rejectSquadSuggestion(activeSquadId, suggestionId);
      if (res?.status === 'success') {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestionId ? { ...s, status: 'rejected' } : s))
        );
        setSuggestionNotice('Suggestion marked as rejected.');
      }
    } catch (err: any) {
      console.error('Failed to reject suggestion:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<'flight' | 'stay' | 'food' | 'activity' | 'transit'>('food');
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Calculate expense split metrics
  const totalSquadSpend = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const perPersonShare = members.length > 0 ? Math.round(totalSquadSpend / members.length) : 0;

  // Calculate net balances per member
  const memberBalances = members.map((m) => {
    const paid = expenses
      .filter((e) => e.paidBy === m.id)
      .reduce((acc, curr) => acc + curr.amount, 0);
    const balance = paid - perPersonShare;
    return { ...m, paid, balance };
  });

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseDesc || !newExpenseAmount) return;

    addExpense({
      description: newExpenseDesc,
      amount: Number(newExpenseAmount),
      paidBy: user?.id || 'user_01',
      splitWith: members.map((m) => m.id),
      category: newExpenseCategory,
      date: 'Today',
    });

    setNewExpenseDesc('');
    setNewExpenseAmount('');
    setShowAddExpense(false);
  };

  return (
    <div className="space-y-6">
      {/* Squad Bar Header */}
      <Card className="p-6 bg-gradient-to-r from-orange-50 via-white to-sky-50 border border-orange-200/90 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-extrabold tracking-wider uppercase">
              <Users className="w-3.5 h-3.5 text-orange-600" />
              <span>LIVE SQUAD GETAWAY STUDIO</span>
              <span className="font-mono text-orange-700 bg-orange-200/60 px-1.5 py-0.5 rounded text-[11px]">#{effectiveSquadCode}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900">
              {squadProfile?.destination ? `${squadProfile.destination} Squad Room` : 'Coastal & Heritage Squad Room'}
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              {squadProfile ? `${squadProfile.member_count} Explorers co-planning with consensus` : '4 Verified Explorers co-planning in real time'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Squad Avatars */}
            <div className="flex -space-x-2.5 overflow-hidden">
              {(squadProfile?.members || members).map((m: any) => (
                <div
                  key={m.id || m.user_id || m.member_id}
                  title={`${m.name} (${m.role || m.vibe || 'Member'})`}
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-white bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-sm"
                >
                  {typeof m.avatar === 'string' && m.avatar.length === 1 ? m.avatar : (m.name ? m.name[0].toUpperCase() : 'E')}
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={onOpenInviteModal}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-md shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 mr-1 text-white" />
              <span>Invite Squad</span>
            </Button>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          {[
            { id: 'voting' as SquadSubTab, label: 'Suggestions & Polls', icon: Vote },
            { id: 'expenses' as SquadSubTab, label: 'Expense & Split Ledger', icon: Receipt },
            { id: 'bookings' as SquadSubTab, label: 'Aggregated Checkout', icon: Building2 },
            { id: 'vault' as SquadSubTab, label: 'Squad QR Vault', icon: QrCode },
            {
              id: 'requests' as SquadSubTab,
              label: pendingCount > 0 ? `Join Requests (${pendingCount})` : 'Join Requests',
              icon: Users,
            },
          ].map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isLastOdd = idx === 4;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
                  isLastOdd ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Group Travel Profile & Consensus Radar (Phase 5) */}
      {squadProfile && (
        <Card className="p-6 bg-white border border-slate-200/90 rounded-3xl shadow-sm space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-orange-100 text-orange-700">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                </span>
                <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
                  Squad Consensus Profile & Radar
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {squadProfile.narrative}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200">
                {squadProfile.member_count} {squadProfile.member_count === 1 ? 'Explorer' : 'Explorers'}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200 uppercase tracking-wider">
                {squadProfile.harmonized_pace} Pace
              </span>
            </div>
          </div>

          {/* Governance Notice Alert */}
          {governanceNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between">
              <span>✓ {governanceNotice}</span>
              <button
                type="button"
                onClick={() => setGovernanceNotice(null)}
                className="text-emerald-700 font-bold hover:text-emerald-950 px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {governanceError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center justify-between">
              <span>⚠️ {governanceError}</span>
              <button
                type="button"
                onClick={() => setGovernanceError(null)}
                className="text-rose-700 font-bold hover:text-rose-950 px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* 3 Pillars Grid: Harmonized Pace, Shared Passions, Universal Exclusions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: Harmonized Pace */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500">
                  Harmonized Pacing
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                  {squadProfile.harmonized_pace}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {squadProfile.pace_explanation}
              </p>
              {squadProfile.dominant_style && (
                <p className="text-[11px] text-slate-500 pt-1">
                  Dominant Vibe: <strong className="text-slate-800 capitalize">{squadProfile.dominant_style}</strong>
                </p>
              )}
            </div>

            {/* Pillar 2: Shared Passions */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-500 block">
                Shared Passions & Interests
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(squadProfile.shared_passions && squadProfile.shared_passions.length > 0
                  ? squadProfile.shared_passions
                  : squadProfile.ranked_interests?.slice(0, 4).map((i: any) => i.name) || []
                ).map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-orange-50 text-orange-800 border border-orange-200 text-xs font-semibold shadow-2xs"
                  >
                    ★ {tag}
                  </span>
                ))}
              </div>
              {squadProfile.combined_dietary && squadProfile.combined_dietary.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Dietary Needs: </span>
                  {squadProfile.combined_dietary.join(', ')}
                </div>
              )}
            </div>

            {/* Pillar 3: Universal Exclusions */}
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-rose-800 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Universal Exclusions
                </span>
                <span className="text-[10px] text-rose-700 font-bold">
                  {squadProfile.universal_exclusions?.length || 0} Strict
                </span>
              </div>
              {squadProfile.universal_exclusions && squadProfile.universal_exclusions.length > 0 ? (
                <div className="space-y-1.5 pt-0.5">
                  {squadProfile.universal_exclusions.map((ex: any, idx: number) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-white border border-rose-200 text-xs text-rose-900 font-semibold flex items-center justify-between"
                    >
                      <span className="capitalize">🚫 {ex.dislike}</span>
                      <span className="text-[10px] text-rose-600 font-normal">
                        by {ex.flagged_by.join(', ')}
                      </span>
                    </div>
                  ))}
                  <p className="text-[10px] text-rose-700/90 leading-tight pt-1">
                    DAIna automatically filters out these categories from suggestions.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-emerald-800 font-medium pt-1">
                  ✓ No strict exclusions flagged by members. Open to all activity types!
                </p>
              )}
            </div>
          </div>

          {/* Member Roster & Role Governance Bar */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-700">
              Squad Member Governance & Roles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(squadProfile.members || []).map((m: any) => {
                const isCurrent = (m.user_id === user?.id || m.user_id === 'user_01');
                const isMemOwner = m.role === 'owner';
                const isMemCoPlanner = m.role === 'co_planner';

                return (
                  <div
                    key={m.member_id || m.user_id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                          {m.name ? m.name.charAt(0).toUpperCase() : 'E'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs flex items-center gap-1">
                            {m.name}
                            {isCurrent && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 capitalize">
                            {m.pace} pace • {m.travel_style || 'Traveler'}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          isMemOwner
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : isMemCoPlanner
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {isMemOwner ? 'Owner' : isMemCoPlanner ? 'Co-Planner' : 'Member'}
                      </span>
                    </div>

                    {/* Owner controls */}
                    {isOwner && !isMemOwner && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1 text-[11px]">
                        {isMemCoPlanner ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateRole(m.user_id, 'member')}
                            className="text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                          >
                            Set as Member
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateRole(m.user_id, 'co_planner')}
                            className="text-purple-700 hover:text-purple-900 font-bold cursor-pointer"
                          >
                            + Promote to Co-Planner
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Tab 1: Collaborative Itinerary Suggestions & DAIna Proposals */}
      {activeTab === 'voting' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-serif-editorial font-bold text-slate-900 flex items-center gap-2">
                <span>Collaborative Suggestions & DAIna Proposals</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-800 border border-orange-200">
                  {suggestions.length} {suggestions.length === 1 ? 'Proposal' : 'Proposals'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Any squad member can ask DAIna to modify the itinerary. The squad votes, and Co-Planners or the Trip Owner commit revisions into v(N+1).
              </p>
            </div>
            <button
              onClick={loadSquadSuggestions}
              disabled={loadingSuggestions}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Feedback Notices */}
          {suggestionNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{suggestionNotice}</span>
            </div>
          )}
          {suggestionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-rose-800 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{suggestionError}</span>
            </div>
          )}

          {/* Suggestion Prompt Submission Banner */}
          <Card className="p-5 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/80 border border-orange-200 rounded-3xl shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">Ask DAIna to Propose an Itinerary Revision</h4>
            </div>
            <p className="text-xs text-slate-600">
              Submit your idea (e.g. &ldquo;Make Day 1 less tiring with relaxed pacing&rdquo; or &ldquo;Move beach visit to sunset with dinner&rdquo;). DAIna will generate a structured diff for the squad to review and vote on.
            </p>
            <form onSubmit={handleCreateSuggestion} className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <input
                type="text"
                value={suggestionInstruction}
                onChange={(e) => setSuggestionInstruction(e.target.value)}
                placeholder="What changes would you like DAIna to propose for the squad?"
                disabled={submittingSuggestion}
                className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submittingSuggestion || !suggestionInstruction.trim()}
                className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shrink-0"
              >
                {submittingSuggestion ? (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>DAIna Thinking...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Propose to Squad</span>
                  </span>
                )}
              </Button>
            </form>
          </Card>

          {/* Proposals Feed */}
          {loadingSuggestions ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-2">
              <Clock className="w-5 h-5 mx-auto animate-spin text-orange-500" />
              <p>Loading squad proposals & voting ledger...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <Card className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                <Vote className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">No Active Proposals Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Any member of your squad can propose modifications above. DAIna will run verified routing, slot the changes, and let everyone vote before locking it into the itinerary!
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {suggestions.map((sug) => {
                const isAccepted = sug.status === 'accepted';
                const isRejected = sug.status === 'rejected';
                const changes = Array.isArray(sug.changes_diff) ? sug.changes_diff : [];
                const isAuthor = sug.user_id === user?.id;

                return (
                  <Card
                    key={sug.id}
                    className={`p-5 bg-white border rounded-3xl space-y-4 shadow-sm transition-all ${
                      isAccepted
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : isRejected
                        ? 'border-slate-200 opacity-70'
                        : 'border-slate-200 hover:border-orange-300'
                    }`}
                  >
                    {/* Header: Author & Status Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                          {sug.author_name ? sug.author_name[0].toUpperCase() : 'E'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{sug.author_name}</span>
                            {isAuthor && (
                              <span className="text-[10px] text-orange-600 font-semibold">(You)</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Proposed {sug.created_at ? new Date(sug.created_at).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Accepted into Itinerary</span>
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Voting Open</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member's Prompt / Request */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        Member Suggestion
                      </span>
                      <p className="text-xs text-slate-800 font-serif-editorial italic font-medium">
                        &ldquo;{sug.instruction}&rdquo;
                      </p>
                    </div>

                    {/* DAIna Structured Proposal Diff */}
                    {sug.proposal_summary && (
                      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                          <span>DAIna Generated Proposal</span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {sug.proposal_summary}
                        </p>

                        {changes.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                            <span className="text-[10px] uppercase font-extrabold text-slate-400">
                              Changes Preview:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {changes.map((ch: any, idx: number) => {
                                const action = ch.action || 'change';
                                const item = ch.item || ch.description || ch.title || JSON.stringify(ch);
                                const isAdded = action === 'added';
                                const isReplaced = action === 'replaced';

                                return (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${
                                      isAdded
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : isReplaced
                                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <span className="font-extrabold uppercase text-[9px] tracking-wide opacity-80">
                                      {action}:
                                    </span>
                                    <span>{item}</span>
                                    {ch.replacement && (
                                      <span className="text-slate-500">→ {ch.replacement}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Voting and Governance Control Bar */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                      {/* Voting Tally & Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isAccepted || isRejected || actionInProgress === sug.id}
                          onClick={() => handleVoteSuggestion(sug.id, 'up')}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer min-h-[40px] sm:min-h-[44px] min-w-[52px] ${
                            sug.user_vote === 'up'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                          } ${isAccepted || isRejected ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{sug.upvotes || 0}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isAccepted || isRejected || actionInProgress === sug.id}
                          onClick={() => handleVoteSuggestion(sug.id, 'down')}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer min-h-[40px] sm:min-h-[44px] min-w-[52px] ${
                            sug.user_vote === 'down'
                              ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                          } ${isAccepted || isRejected ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>{sug.downvotes || 0}</span>
                        </button>
                      </div>

                      {/* Governance Decisions */}
                      <div className="flex items-center gap-2">
                        {!isAccepted && !isRejected && (canAcceptSuggestion || isAuthor) && (
                          <button
                            type="button"
                            disabled={actionInProgress === sug.id}
                            onClick={() => handleRejectSuggestion(sug.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        )}

                        {!isAccepted && !isRejected && canAcceptSuggestion && (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={actionInProgress === sug.id}
                            onClick={() => handleAcceptSuggestion(sug.id)}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-xs shadow-xs"
                          >
                            {actionInProgress === sug.id ? (
                              <Clock className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            <span>Accept into Itinerary (vN+1)</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Expense & Split Ledger */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Squad Expense & Split Ledger</h3>
              <p className="text-xs text-slate-500 font-medium">Automatic calculation of who paid what and net balances</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddExpense(!showAddExpense)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1 text-white" />
              <span>Add Squad Expense</span>
            </Button>
          </div>

          {/* Add Expense Form Drawer */}
          {showAddExpense && (
            <Card className="p-5 bg-orange-50/70 border border-orange-200 rounded-3xl space-y-3 animate-in fade-in slide-in-from-top-3">
              <h4 className="font-extrabold text-slate-900 text-sm">Log New Squad Expense</h4>
              <form onSubmit={handleAddExpenseSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Expense description (e.g. Dinner, Taxi)"
                  value={newExpenseDesc}
                  onChange={(e) => setNewExpenseDesc(e.target.value)}
                  className="sm:col-span-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-orange-500"
                />
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-orange-500"
                />
                <Button type="submit" variant="primary" size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold">
                  Save & Split
                </Button>
              </form>
            </Card>
          )}

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 bg-white border border-slate-200/90 rounded-3xl space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Total Squad Spend</span>
              <p className="text-2xl font-serif-editorial font-bold text-slate-900">₹{totalSquadSpend.toLocaleString('en-IN')}</p>
            </Card>
            <Card className="p-5 bg-white border border-slate-200/90 rounded-3xl space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Fair Per-Person Share</span>
              <p className="text-2xl font-serif-editorial font-bold text-slate-900">₹{perPersonShare.toLocaleString('en-IN')}</p>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-3xl space-y-1 shadow-md">
              <span className="text-[10px] uppercase font-extrabold text-white/80 tracking-wider">Your Balance</span>
              <p className="text-2xl font-serif-editorial font-bold text-white">+₹2,650 (You get back)</p>
            </Card>
          </div>

          {/* Member Balance Ledger */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Member Net Settlement Status</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {memberBalances.map((mb) => (
                <Card key={mb.id} className="p-4 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-800 font-extrabold text-xs flex items-center justify-center border border-orange-200">
                      {mb.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {mb.name}
                        {mb.isVerified && (
                          <span title="Verified Explorer">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">Paid ₹{mb.paid.toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    {mb.balance >= 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold border border-emerald-200">
                        Gets back ₹{mb.balance.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-extrabold border border-rose-200">
                        Owes ₹{Math.abs(mb.balance).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Aggregated Squad Checkout */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Aggregated Squad Bookings</h3>
            <span className="text-xs text-slate-500 font-medium">Synced across Skyscanner, Booking.com & Taj Hotels</span>
          </div>

          <div className="space-y-3">
            {[
              {
                title: 'IndiGo Premier Flight Passes (4 Tickets)',
                provider: 'Skyscanner Aggregator',
                total: '₹34,000',
                perPerson: '₹8,500 / person',
                payer: 'Kumkum Pandey (Paid)',
                status: 'Confirmed & Vaulted',
                icon: Plane,
              },
              {
                title: 'Taj Exotica Beachfront Suite (4 Nights)',
                provider: 'Booking.com',
                total: '₹28,800',
                perPerson: '₹7,200 / person',
                payer: 'Aarav Sharma (Paid)',
                status: 'Confirmed & Vaulted',
                icon: Building2,
              },
              {
                title: 'Private Catamaran Cruise & Scuba Pass',
                provider: 'GetYourGuide',
                total: '₹15,600',
                perPerson: '₹3,900 / person',
                payer: 'Vikram Sengupta (Paid)',
                status: 'Confirmed',
                icon: Ticket,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card key={idx} className="p-5 bg-white border border-slate-200/90 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-orange-700">{item.provider}</span>
                      <h4 className="font-bold text-slate-900 text-base">{item.title}</h4>
                      <p className="text-xs text-slate-600 font-medium">Payer: <strong className="text-slate-900">{item.payer}</strong> • {item.perPerson}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-serif-editorial font-bold text-slate-900">{item.total}</p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {item.status}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 hover:text-slate-900 font-extrabold">
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Squad Ticket Vault */}
      {activeTab === 'vault' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Squad Boarding Pass & QR Vault</h3>
            <span className="text-xs text-slate-500 font-medium">Offline accessible boarding passes for all members</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {members.map((m) => (
              <Card key={m.id} className="p-5 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center">
                      {m.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{m.name}</p>
                      <span className="text-[10px] text-orange-600 font-extrabold uppercase tracking-wider">{m.vibe}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200">
                    Checked In
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500">Boarding Pass</p>
                    <p className="text-xs font-mono font-bold text-slate-900">PNR: DASH9841A</p>
                    <p className="text-[11px] text-slate-600 font-medium">Seat 12A • IndiGo BLR→GOI</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                    <QrCode className="w-9 h-9 text-slate-900" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Squad Companion Applications */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-serif-editorial font-bold text-slate-900">
                Squad Companion Applications
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Review travelers who requested to join your trip based on their compatibility score and travel style.
              </p>
            </div>
            {tripId && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadRequests}
                disabled={loadingRequests}
                className="text-xs font-semibold self-start sm:self-auto cursor-pointer"
              >
                {loadingRequests ? 'Refreshing...' : '↻ Refresh Requests'}
              </Button>
            )}
          </div>

          {responseNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {responseNotice}
              </span>
              <button
                type="button"
                onClick={() => setResponseNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {requestsError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center justify-between animate-in fade-in">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                {requestsError}
              </span>
              <button
                type="button"
                onClick={() => setRequestsError(null)}
                className="text-rose-700 hover:text-rose-950 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {loadingRequests && requests.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-medium space-y-2">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading prospective companion requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <Card className="p-8 text-center space-y-3 bg-white border border-slate-200 rounded-3xl">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-serif-editorial font-bold text-slate-900 text-base">
                  No Join Requests Yet
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  When travelers discover your itinerary in the Community feed and express interest in traveling together, their applications and AI compatibility scores will appear here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const reqId = req.request_id || req.id;
                const isPending = req.status === 'pending';
                const isApproved = req.status === 'approved';
                const isRejected = req.status === 'rejected';
                const applicant = req.applicant || {};

                return (
                  <Card
                    key={reqId}
                    className={`p-5 sm:p-6 bg-white border rounded-3xl space-y-4 transition-all ${
                      isPending
                        ? 'border-orange-200/90 shadow-sm hover:border-orange-300'
                        : 'border-slate-200/80 opacity-90'
                    }`}
                  >
                    {/* Header: Applicant info + Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                          {applicant.full_name ? applicant.full_name.charAt(0).toUpperCase() : 'T'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {applicant.full_name || 'Traveler'}
                            </h4>
                            {applicant.is_verified && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Trust Score: <strong className="text-slate-700">{applicant.trust_score || 95}%</strong>
                            {req.created_at && (
                              <span className="text-slate-400"> • Applied {req.created_at.slice(0, 10)}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div className="shrink-0">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved into Squad
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Compatibility & Style Breakdown */}
                    <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {req.has_dealbreaker ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                              <ShieldAlert className="w-3 h-3 text-rose-500" />
                              {req.compatibility_score || 25}% • Dealbreaker Conflict
                            </span>
                          ) : req.compatibility_score !== undefined && req.compatibility_score !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                req.compatibility_score >= 80
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {req.compatibility_score}% Match • {req.compatibility_level || 'Compatible'}
                            </span>
                          ) : null}

                          <span className="text-[11px] text-slate-600 font-medium">
                            Pace: <strong className="text-slate-800 capitalize">{applicant.pace || 'Balanced'}</strong>
                          </span>
                          {applicant.travel_style && (
                            <span className="text-[11px] text-slate-600 font-medium">
                              • Style: <strong className="text-slate-800 capitalize">{applicant.travel_style}</strong>
                            </span>
                          )}
                        </div>

                        {req.dealbreakers && req.dealbreakers.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-rose-700 font-medium">
                            <span>Conflict: {req.dealbreakers.join(', ')}</span>
                          </div>
                        )}
                      </div>

                      {req.explanation && (
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {req.explanation}
                        </p>
                      )}

                      {((req.shared_interests && req.shared_interests.length > 0) ||
                        (applicant.interests && applicant.interests.length > 0)) && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-slate-500 font-medium">Shared Passions:</span>
                          {(req.shared_interests && req.shared_interests.length > 0
                            ? req.shared_interests
                            : applicant.interests || []
                          ).map((item: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 rounded bg-white border border-slate-200/80 text-[10px] text-slate-700 font-medium"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Applicant's personal message */}
                    {req.message && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          Traveler Note
                        </span>
                        <p className="text-xs text-slate-700 italic bg-slate-50/60 p-3 rounded-xl border border-slate-200/60 leading-relaxed">
                          &ldquo;{req.message}&rdquo;
                        </p>
                      </div>
                    )}

                    {/* Action buttons if pending */}
                    {isPending && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingRequestId === reqId}
                          onClick={() => handleRespondRequest(reqId, 'reject')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 border-slate-200 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={processingRequestId === reqId}
                          onClick={() => handleRespondRequest(reqId, 'approve')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                          {processingRequestId === reqId ? 'Approving...' : 'Approve into Squad'}
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
