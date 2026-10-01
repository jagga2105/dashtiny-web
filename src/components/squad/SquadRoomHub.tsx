'use client';

import { useState } from 'react';
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
  Plane,
  Building2,
  Ticket,
  ExternalLink,
  Share2,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSquadStore, SquadMember } from '@/store/useSquadStore';
import { useAuthStore } from '@/store/useAuthStore';

type SquadSubTab = 'voting' | 'expenses' | 'bookings' | 'vault';

interface SquadRoomHubProps {
  squadId?: string;
  onOpenInviteModal?: () => void;
}

export function SquadRoomHub({ squadId, onOpenInviteModal }: SquadRoomHubProps) {
  const [activeTab, setActiveTab] = useState<SquadSubTab>('voting');
  const { members, votes, expenses, voteActivity, addExpense, squadCode } = useSquadStore();
  const effectiveSquadCode = squadId || squadCode;
  const { user } = useAuthStore();

  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<'flight' | 'stay' | 'food' | 'activity' | 'transit'>('food');
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Mock activity list for voting
  const activitiesToVote = [
    {
      id: 'act_01',
      title: 'Scuba Diving & Coral Reef Expedition',
      time: '11 Aug • 09:30 AM',
      location: 'Grande Island Catamaran',
      cost: '₹3,900 / person',
      suggestedBy: 'Kumkum Pandey',
    },
    {
      id: 'act_02',
      title: 'Thalassa Cliffside Greek Dinner & Sunset DJ',
      time: '12 Aug • 07:30 PM',
      location: 'Vagator Beach Cliff',
      cost: '₹2,500 / person',
      suggestedBy: 'Aarav Sharma',
    },
    {
      id: 'act_03',
      title: 'Chapora Fort Heritage Walk & Photo Spot',
      time: '13 Aug • 05:00 PM',
      location: 'Chapora Fort',
      cost: 'Free Access',
      suggestedBy: 'Riya Patel',
    },
  ];

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
              Coastal & Heritage Squad Room
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              4 Verified Explorers co-planning in real time
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Squad Avatars */}
            <div className="flex -space-x-2.5 overflow-hidden">
              {members.map((m) => (
                <div
                  key={m.id}
                  title={`${m.name} (${m.vibe})`}
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-white bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-sm"
                >
                  {m.avatar}
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {[
            { id: 'voting' as SquadSubTab, label: 'Squad Voting & Polls', icon: Vote },
            { id: 'expenses' as SquadSubTab, label: 'Expense & Split Ledger', icon: Receipt },
            { id: 'bookings' as SquadSubTab, label: 'Aggregated Checkout', icon: Building2 },
            { id: 'vault' as SquadSubTab, label: 'Squad QR Vault', icon: QrCode },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
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

      {/* Tab 1: Squad Voting & Polls */}
      {activeTab === 'voting' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif-editorial font-bold text-slate-900">Live Activity Voting Board</h3>
            <span className="text-xs text-slate-500 font-medium">Majority vote locks activity into timeline</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activitiesToVote.map((act) => {
              const voteState = votes[act.id] || { upvotes: [], downvotes: [] };
              const userVotedUp = voteState.upvotes.includes(user?.id || 'user_01');
              const userVotedDown = voteState.downvotes.includes(user?.id || 'user_01');

              return (
                <Card
                  key={act.id}
                  className="p-5 bg-white border border-slate-200/90 rounded-3xl space-y-4 shadow-sm hover:border-orange-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                        {act.cost}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">{act.time}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-base">{act.title}</h4>
                    <p className="text-xs text-slate-600 font-medium">📍 {act.location}</p>
                    <p className="text-[11px] text-slate-400">Suggested by {act.suggestedBy}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    {/* Votes counter */}
                    <div className="flex items-center gap-3 text-xs font-extrabold text-slate-700">
                      <span className="text-emerald-600 flex items-center gap-1">
                        👍 {voteState.upvotes.length}
                      </span>
                      <span className="text-rose-500 flex items-center gap-1">
                        👎 {voteState.downvotes.length}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => voteActivity(act.id, user?.id || 'user_01', 'up')}
                        className={`p-2 rounded-xl border transition-all ${
                          userVotedUp
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => voteActivity(act.id, user?.id || 'user_01', 'down')}
                        className={`p-2 rounded-xl border transition-all ${
                          userVotedDown
                            ? 'bg-rose-500 text-white border-rose-500'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
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
    </div>
  );
}
