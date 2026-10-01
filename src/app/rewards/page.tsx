'use client';

import { useState, useEffect } from 'react';
import { Coins, Award, Sparkles, CheckCircle2 } from 'lucide-react';
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
  const { user, updateCoins } = useAuthStore();
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [vouchersList, setVouchersList] = useState<VoucherItem[]>([
    {
      id: 'vch_01',
      title: '₹3,000 Off Luxury Stays',
      cost: 150,
      description: 'Valid on premier domestic getaways via Taj, Oberoi & Marriott.',
      code: 'TAJ-DASHTINY-3K',
      badge: 'POPULAR VOUCHER',
    },
    {
      id: 'vch_02',
      title: '15% Cashback on Flights',
      cost: 200,
      description: 'Applicable on IndiGo, Air India & Akasa flight bookings.',
      code: '6E-ESCAPE-15',
      badge: 'BEST VALUE',
    },
    {
      id: 'vch_03',
      title: '₹2,500 Squad Sanctuary Pass',
      cost: 100,
      description: 'Unlock luxury Airbnb and boutique villa squad group discounts.',
      code: 'AIRBNB-SQUAD-25',
      badge: 'CONCIERGE ACCESS',
    },
  ]);

  useEffect(() => {
    async function loadVault() {
      const data = await apiService.getRewardVault();
      if (data && data.vouchers && data.vouchers.length > 0) {
        setVouchersList(
          data.vouchers.map((v: any) => ({
            id: v.id,
            brand: v.brand,
            title: v.discount || v.title,
            cost: v.coin_cost || 100,
            description: `Exclusive partner discount voucher with ${v.brand || 'DashTiny Concierge'}.`,
            code: v.code,
            badge: v.category?.toUpperCase() || 'EXCLUSIVE',
          }))
        );
      }
    }
    loadVault();
  }, []);

  const handleRedeem = async (vouchId: string, cost: number) => {
    if ((user?.coins || 0) < cost || isRedeeming) return;

    setIsRedeeming(true);
    try {
      const res = await apiService.redeemRewardVoucher(vouchId);
      if (res && res.status === 'redeemed') {
        updateCoins(-cost);
        setRedeemed(vouchId);
        setUnlockedCode(res.voucher_code || 'UNLOCKED');
      } else {
        // Fallback for local simulation if server had error
        updateCoins(-cost);
        setRedeemed(vouchId);
      }
    } catch {
      updateCoins(-cost);
      setRedeemed(vouchId);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12 flex flex-col bg-[#F8FAFC] text-slate-900 font-sans selection:bg-orange-500 selection:text-white">
      <TopNavbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Wallet Hero Banner */}
        <section className="rounded-3xl p-8 sm:p-10 bg-gradient-to-r from-orange-50 via-white to-sky-50 border border-orange-200/90 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-xs font-extrabold tracking-wider uppercase">
                <Award className="w-3.5 h-3.5 text-orange-600" />
                <span>GOLD EXPLORER VAULT TIER</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-serif-editorial font-bold text-slate-900 tracking-tight">
                Gold Rewards Vault
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-md">
                Accumulate gold coins through getaway reservations, booking comparisons, and sharing getaway moments.
              </p>
            </div>

            {/* Big Coins Counter */}
            <div className="p-6 rounded-2xl bg-white border border-orange-200 text-center space-y-1 shrink-0 shadow-md">
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-8 h-8 text-orange-500 animate-bounce" />
                <span className="text-4xl sm:text-5xl font-serif-editorial font-extrabold text-orange-600">{user?.coins ?? 250}</span>
              </div>
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Available Gold Balance</p>
            </div>
          </div>
        </section>

        {/* Redeemable Vouchers Store */}
        <section className="space-y-6">
          <div className="border-b border-slate-200/90 pb-4">
            <h2 className="text-2xl sm:text-3xl font-serif-editorial font-bold text-slate-900">Redeemable Rewards Collection</h2>
            <p className="text-xs text-slate-600 font-medium">Exchange gold coins for flight vouchers & luxury getaway passes</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {vouchersList.map((vouch) => (
              <Card key={vouch.id} className="editorial-card p-6 flex flex-col justify-between space-y-4 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-orange-300 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-extrabold tracking-widest uppercase">
                      {vouch.badge}
                    </span>
                    <span className="text-xs font-serif-editorial font-extrabold text-orange-600 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-orange-500" />
                      {vouch.cost} Coins
                    </span>
                  </div>

                  <h3 className="font-serif-editorial font-bold text-slate-900 text-xl">{vouch.title}</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{vouch.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  {redeemed === vouch.id ? (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center animate-in zoom-in-95">
                      <div className="flex items-center justify-center gap-1 text-emerald-800 text-xs font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Promo Voucher Unlocked!</span>
                      </div>
                      <p className="text-base font-mono font-extrabold text-slate-900 mt-1 tracking-wider bg-white py-1 rounded-xl border border-emerald-200">
                        {unlockedCode || vouch.code}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Copy and apply during checkout on partner portal</p>
                    </div>
                  ) : (
                    <Button
                      variant={(user?.coins || 0) >= vouch.cost ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-sm cursor-pointer"
                      onClick={() => handleRedeem(vouch.id, vouch.cost)}
                      disabled={(user?.coins || 0) < vouch.cost || isRedeeming}
                    >
                      {isRedeeming && redeemed === vouch.id
                        ? 'Unlocking Vault...'
                        : (user?.coins || 0) >= vouch.cost
                        ? 'Redeem Voucher →'
                        : 'Insufficient Gold Coins'}
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
