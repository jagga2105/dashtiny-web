'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { X, Send, Sparkles, SlidersHorizontal, Award } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TravelInputDialogModal, TravelInputResult } from '@/components/planner/TravelInputDialogModal';
import { parseTravelPrompt, inferPlaceType, StructuredItineraryData, ActivityItem } from '@/lib/dainaIntentParser';
import { usePlannerStore } from '@/store/usePlannerStore';
import { apiService } from '@/services/api';

interface ChatMessageItem {
  id: string;
  sender: 'daina' | 'user';
  text: string;
  isItinerary?: boolean;
  itineraryData?: StructuredItineraryData;
}

export function DAInaChatWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const { addItinerary } = usePlannerStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [inputMsg, setInputMsg] = useState('');
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'msg_0',
      sender: 'daina',
      text: "✦ Welcome to your Private Concierge. I am DAIna, your 24/7 AI Travel Butler. How may I assist your itinerary today? Ask me about destinations, packing, price trends, or custom getaway itineraries.",
    },
  ]);

  // On Trip Workspace (/trips), the Trip Copilot is already the embedded, dedicated DAIna experience.
  // Hiding the global floating button prevents duplicate AI surfaces.
  if (pathname?.startsWith('/trips')) {
    return null;
  }

  const launcherLabel = pathname?.startsWith('/planner')
    ? '✨ Plan with DAIna'
    : pathname?.startsWith('/bookings')
    ? '✨ Compare with DAIna'
    : '✨ Ask DAIna';

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMsg).trim();
    if (!textToSend || isThinking) return;

    const userMsg: ChatMessageItem = { id: `usr_${Date.now()}`, sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInputMsg('');
    setIsThinking(true);

    try {
      const res = await apiService.sendChatMessage(textToSend);
      if (res && res.reply) {
        let itData: StructuredItineraryData | undefined = undefined;

        // If DAIna detects an itinerary intent, use the ONE canonical Planner service
        if (res.is_itinerary && res.itinerary_data) {
          const parsed = parseTravelPrompt(textToSend);
          const dest = res.itinerary_data.destination || parsed.destination;
          const daysCount = res.itinerary_data.days_count || parsed.days_count || 4;
          const budget = res.itinerary_data.budget || parsed.budget || 45000;

          if (dest) {
            try {
              const planRes = await apiService.generateItinerary({
                destination: dest,
                origin: parsed.origin,
                start_date: parsed.start_date,
                end_date: parsed.end_date,
                days_count: daysCount,
                travellers: parsed.travellers || 2,
                budget,
                currency: parsed.currency || 'INR',
                persona: parsed.persona || 'solo',
                vibe: parsed.vibe,
                interests: parsed.interests,
                raw_prompt: textToSend,
                prompt: textToSend,
              });

              if (planRes && planRes.id) {
                const formatted: StructuredItineraryData = {
                  id: planRes.id,
                  title: planRes.title || `Custom ${daysCount}-Day ${dest} Getaway`,
                  destination: planRes.destination || dest,
                  startDate: planRes.startDate || new Date().toISOString().split('T')[0],
                  endDate: planRes.endDate || new Date(Date.now() + daysCount * 86400000).toISOString().split('T')[0],
                  budget: planRes.budget || budget,
                  days: planRes.days || [],
                };
                addItinerary(formatted);
                itData = formatted;
              }
            } catch (err) {
              console.warn('Planner service fallback in chat:', err);
            }
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'daina',
            text: itData
              ? `${res.reply}\n\n✦ I have crafted and saved your itinerary directly into your Trip Workspace!`
              : res.reply,
            isItinerary: Boolean(itData),
            itineraryData: itData,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'daina',
            text: "✦ DAIna is temporarily unavailable. Try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'daina',
          text: "✦ DAIna is temporarily unavailable. Try again.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleFormSubmit = async (formResult: TravelInputResult) => {
    const promptSummary = `Trip to ${formResult.destination} from ${formResult.departure} (${formResult.dates}) for ${formResult.groupSize}. Budget: ${formResult.budget}. Style: ${formResult.purpose}.`;

    const userMsgItem: ChatMessageItem = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: promptSummary,
    };

    setMessages((prev) => [...prev, userMsgItem]);
    setIsThinking(true);

    try {
      const budgetNum = parseInt(formResult.budget.replace(/[^0-9]/g, ''), 10) || 45000;
      const travellersNum = parseInt(formResult.groupSize.replace(/[^0-9]/g, ''), 10) || 2;
      const personaVal = formResult.groupSize.toLowerCase().includes('solo')
        ? 'solo'
        : formResult.groupSize.toLowerCase().includes('family')
        ? 'family'
        : formResult.groupSize.toLowerCase().includes('friends') || formResult.groupSize.toLowerCase().includes('squad')
        ? 'squad'
        : 'couple';

      const planRes = await apiService.generateItinerary({
        destination: formResult.destination,
        origin: formResult.departure || undefined,
        days_count: 4,
        travellers: travellersNum,
        budget: budgetNum,
        currency: 'INR',
        persona: personaVal,
        vibe: formResult.purpose,
        raw_prompt: promptSummary,
        prompt: promptSummary,
      });

      if (planRes && planRes.id) {
        const generatedItinerary: StructuredItineraryData = {
          id: planRes.id,
          title: planRes.title || `${formResult.destination} Getaway`,
          destination: planRes.destination || formResult.destination,
          startDate: planRes.startDate || formResult.dates.split('to')[0]?.trim() || new Date().toISOString().split('T')[0],
          endDate: planRes.endDate || formResult.dates.split('to')[1]?.trim() || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
          budget: planRes.budget || budgetNum,
          days: planRes.days || [],
        };

        addItinerary(generatedItinerary);

        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'daina',
            text: `✦ Confirmed! "${generatedItinerary.title}" was generated by the DAIna Planner and saved directly to your Trip Workspace!`,
            isItinerary: true,
            itineraryData: generatedItinerary,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'daina',
          text: `✦ DAIna is temporarily unavailable. Could not generate itinerary for ${formResult.destination}. Try again.`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {/* Floating Action Button — Calm, clear, mobile-safe */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-5 sm:right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-colors border border-slate-700/60 cursor-pointer"
        aria-label="Ask DAIna travel assistant"
      >
        <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-600">
          <Image src="/assets/ai/daina.png" alt="DAIna" width={24} height={24} className="w-full h-full object-cover" />
        </div>
        <span className="text-xs font-semibold tracking-wide">{launcherLabel}</span>
      </button>

      {/* Guided Input Modal */}
      <TravelInputDialogModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Travel Chat Modal Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 md:bottom-20 right-3 sm:right-6 z-50 w-full max-w-[calc(100vw-24px)] sm:max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[520px] transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="p-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                <Image src="/assets/ai/daina.png" alt="DAIna" width={32} height={32} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  DAIna
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Intelligent Travel Companion</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFormModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[11px] font-medium border border-slate-200 transition-colors"
              >
                Refine
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close DAIna chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { label: 'Plan a trip', prompt: 'Plan a 4-day trip to Goa under ₹25k' },
              { label: 'Improve my itinerary', prompt: 'How can I make my trip slower and more relaxed?' },
              { label: 'Find a hotel', prompt: 'Find boutique stays with good views' },
              { label: 'Compare flights', prompt: 'Compare direct flights for my upcoming dates' },
              { label: 'Ask about a destination', prompt: 'What is the best season and local food in Kyoto?' },
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.prompt)}
                className="text-[11px] px-3 py-1 rounded-full bg-white text-slate-700 hover:text-orange-600 hover:bg-orange-50/50 border border-slate-200 shrink-0 font-medium transition-colors shadow-2xs cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Message History */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40 text-xs no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'daina' && (
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-200">
                      <Image src="/assets/ai/daina.png" alt="DAIna" width={24} height={24} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-orange-500 text-white font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Render Itinerary Card Preview inside Chat */}
                {msg.isItinerary && msg.itineraryData && (
                  <div className="ml-8 p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">{msg.itineraryData.title}</span>
                      <span className="text-[11px] text-orange-600 font-bold">₹{msg.itineraryData.budget.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="space-y-1">
                      {msg.itineraryData.days[0]?.activities?.map((act: ActivityItem, i: number) => {
                        const label = act.placeType === 'H' ? 'Hotel' : act.placeType === 'R' ? 'Dining' : 'Activity';
                        return (
                          <div key={i} className="flex items-center justify-between text-[11px] text-slate-700">
                            <span className="truncate pr-2">• {act.description}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-medium border border-slate-200 shrink-0">
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-[11px] py-1 border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                        onClick={() => {
                          setIsOpen(false);
                          router.push(msg.itineraryData?.id ? `/trips?tripId=${msg.itineraryData.id}` : '/trips');
                        }}
                      >
                        Trip Workspace →
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 text-[11px] py-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold cursor-pointer"
                        onClick={() => {
                          setIsOpen(false);
                          router.push(msg.itineraryData?.destination ? `/planner?destination=${encodeURIComponent(msg.itineraryData.destination)}` : '/planner');
                        }}
                      >
                        Refine in Planner →
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-200">
                  <Image src="/assets/ai/daina.png" alt="DAIna" width={24} height={24} className="w-full h-full object-cover" />
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-2xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                  <span className="text-[11px] font-medium">DAIna is researching places...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask DAIna anything about your trip..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
            />
            <button
              onClick={() => handleSend()}
              className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
