'use client';

import { useState, useEffect } from 'react';
import { Award, Sparkles, CheckCircle2, Ticket, Share2, Compass, ArrowRight } from 'lucide-react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { DAInaChatWidget } from '@/components/layout/DAInaChatWidget';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { apiService } from '@/services/api';

interface VoucherItem {
  id: string;
  brand?: string;
  title: string;
  cost: number;
  description: string;
  code: string;
  badge: string;
}

export default function RewardsPage() {
  const { user, updateCoins, setCoins } = useAuthStore();
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vouchersList, setVouchersList] = useState<VoucherItem[]>([
    {
      id: 'vch_01',
      title: '₹3,000 Off Luxury Stays',
      cost: 150,
      description: 'Valid on premier domestic getaways via Taj, Oberoi & Marriott.',
      code: 'TAJ-DASHTINY-3K',
      badge: 'POPULAR PERK',
    },
    {
      id: 'vch_02',
      title: '15% Off Flights',
      cost: 200,
      description: 'Applicable on IndiGo, Air India & Akasa verified bookings.',
      code: '6E-ESCAPE-15',
      badge: 'TOP VALUE',
    },
    {
      id: 'vch_03',
      title: '₹2,500 Squad Stay Discount',
      cost: 100,
      description: 'Unlock boutique villa and homestay squad group discounts.',
      code: 'AIRBNB-SQUAD-25',
      badge: 'EXPERIENCE PASS',
    },
  ]);

  useEffect(() => {
    async function loadVault() {
      try {
        const data = await apiService.getRewardVault();
        if (data && typeof data.gold_coins === 'number') {
          setCoins(data.gold_coins);
        }
        if (data && data.vouchers && data.vouchers.length > 0) {
          setVouchersList(
            data.vouchers.map((v: any) => ({
              id: v.id,
              brand: v.brand,
              title: v.discount || v.title,
              cost: v.coin_cost || 100,
              description: `Exclusive partner perk with ${v.brand || 'DashTiny'}.`,
              code: v.code,
              badge: v.category?.toUpperCase() || 'PERK',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load rewards vault:', err);
      }
    }
    loadVault();
  }, [setCoins]);

  const handleRedeem = async (vouchId: string, cost: number) => {
    setErrorMsg(null);
    if ((user?.coins || 0) < cost) {
      setErrorMsg(`You have ${user?.coins || 0} Travel Credits, but need ${cost} credits for this perk.`);
      return;
    }
    if (isRedeeming) return;

    setIsRedeeming(true);
    try {
      const res = await apiService.redeemRewardVoucher(vouchId);
      if (res && res.status === 'redeemed') {
        // Server-authoritative balance update
        if (typeof res.remaining_credits === 'number') {
          setCoins(res.remaining_credits);
        } else if (typeof res.remaining_coins === 'number') {
          setCoins(res.remaining_coins);
        } else {
          updateCoins(-cost);
        }
        setRedeemed(vouchId);
        setUnlockedCode(res.voucher_code || 'UNLOCKED');
      } else {
        setErrorMsg("Unable to connect to DashTiny services. Failed to redeem perk. Try again.");
      }
    } catch (err: any) {
      console.error('Redemption error:', err);
      const detail = err?.data?.detail || "Unable to connect to DashTiny services. Failed to redeem perk. Try again.";
      setErrorMsg(detail);
    } finally {
      setIsRedeeming(false);
    }
  };

  const numericCoins = user?.coins ?? 0;
  const travelCredits = user ? (user.coins ?? 0) : 'Loading...';

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#FAFAF9] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Travel Credits Banner */}
        <section className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span>TRAVEL CREDITS & PERKS</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif-editorial font-bold text-slate-900 tracking-tight">
                Your Travel Credits
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md">
                Earn credits as you plan, compare, save bookings, and share itineraries with the community.
              </p>
            </div>

            {/* Travel Credits Counter */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1 shrink-0 min-w-[200px]">
              <span className="text-3xl sm:text-4xl font-serif-editorial font-bold text-orange-600">
                {travelCredits}
              </span>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                Available Credits
              </p>
            </div>
          </div>

          {/* How Credits Are Earned on DashTiny */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px]">
                +50
              </span>
              <span className="font-medium">Save a booking reference to a trip</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold font-mono text-[11px]">
                +20
              </span>
              <span className="font-medium">Share an itinerary with travelers</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold font-mono text-[11px]">
                +10
              </span>
              <span className="font-medium">Help another explorer in Community</span>
            </div>
          </div>
        </section>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between animate-in fade-in">
            <span className="text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {errorMsg}
            </span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-amber-700 hover:text-amber-950 font-semibold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Redeemable Perks Collection */}
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-xl font-serif-editorial font-bold text-slate-900">
                Redeem Credits for Travel Perks
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Apply unlocked perks toward verified stays, airline bookings, and squad experiences.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {vouchersList.map((vouch) => (
              <Card
                key={vouch.id}
                className="p-5 flex flex-col justify-between space-y-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold tracking-wider uppercase">
                      {vouch.badge}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 font-mono">
                      {vouch.cost} Credits
                    </span>
                  </div>

                  <h3 className="font-serif-editorial font-bold text-slate-900 text-lg">{vouch.title}</h3>
                  <p className="text-xs text-slate-600 font-normal leading-relaxed">{vouch.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {redeemed === vouch.id ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center animate-in zoom-in-95">
                      <div className="flex items-center justify-center gap-1 text-emerald-800 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Perk Unlocked!</span>
                      </div>
                      <p className="text-sm font-mono font-bold text-slate-900 mt-1 tracking-wider bg-white py-1 rounded-lg border border-emerald-200">
                        {unlockedCode || vouch.code}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Apply during booking on partner portal or attach to your Trip Workspace
                      </p>
                    </div>
                  ) : (
                    <Button
                      variant={numericCoins >= vouch.cost ? 'primary' : 'outline'}
                      size="sm"
                      className="w-full text-xs font-semibold cursor-pointer"
                      onClick={() => handleRedeem(vouch.id, vouch.cost)}
                      disabled={numericCoins < vouch.cost || isRedeeming}
                    >
                      {isRedeeming && redeemed === vouch.id
                        ? 'Unlocking Perk...'
                        : numericCoins >= vouch.cost
                        ? `Redeem Perk (${vouch.cost} Credits) →`
                        : `Need ${vouch.cost - numericCoins} More Credits`}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <DAInaChatWidget />
      <BottomNav />
    </div>
  );
}
