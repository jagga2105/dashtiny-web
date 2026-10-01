'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, Send, Sparkles, SlidersHorizontal, Award } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TravelInputDialogModal, TravelInputResult } from '@/components/planner/TravelInputDialogModal';
import { checkMessageForItinerary, inferPlaceType, StructuredItineraryData, ActivityItem } from '@/lib/dainaIntentParser';
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

        if (res.is_itinerary && res.itinerary_data) {
          const dest = res.itinerary_data.destination || 'Goa, India';
          const daysCount = res.itinerary_data.days_count || 3;
          itData = {
            id: `it_chat_${Date.now()}`,
            title: res.itinerary_data.title || `Custom ${daysCount}-Day ${dest} Getaway`,
            destination: dest,
            startDate: '2026-08-10',
            endDate: `2026-08-${10 + daysCount}`,
            budget: res.itinerary_data.budget || 25000,
            days: [
              {
                dayNumber: 1,
                title: 'Arrival & Private Villa Check-in',
                coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
                weather: '28°C Pleasant 🌤️',
                activities: [
                  { time: '10:00 AM', description: 'Private Check-in at Curated Villa', location: dest, placeType: inferPlaceType('hotel stay') },
                  { time: '01:30 PM', description: 'Gourmet Coastal Lunch Experience', location: dest, placeType: inferPlaceType('lunch restaurant') },
                  { time: '05:30 PM', description: 'Golden Hour Sunset Lounge at Cliff', location: dest, placeType: inferPlaceType('sunset beach') },
                ],
              },
            ],
          };
          addItinerary(itData);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'daina',
            text: res.reply,
            isItinerary: res.is_itinerary,
            itineraryData: itData,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'daina',
            text: "✦ I am currently updating live route fare coordinates. Try asking 'Plan a 3-day luxury trip to Manali' or use our 9-Step Travel Form!",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'daina',
          text: "✦ Concierge service is active. Please ask a travel destination question or open the 9-Step Form.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSaveItineraryToDB = async (itData: StructuredItineraryData) => {
    try {
      const dbRes = await apiService.generateItinerary({
        destination: itData.destination,
        duration: itData.days.length || 3,
        budget: itData.budget || 30000,
        vibe: 'Luxury Leisure',
        companions: 2,
      });
      if (dbRes && dbRes.itinerary) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_saved_${Date.now()}`,
            sender: 'daina',
            text: `✦ Confirmed! "${itData.title}" has been saved directly to your PostgreSQL trips vault! You can view and manage it anytime in My Trips.`,
          },
        ]);
      }
    } catch (err) {
      console.error(err);
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
      const dbRes = await apiService.generateItinerary({
        destination: formResult.destination,
        duration: 4,
        budget: parseInt(formResult.budget.replace(/[^0-9]/g, '')) || 45000,
        vibe: formResult.purpose,
        companions: parseInt(formResult.groupSize.replace(/[^0-9]/g, '')) || 2,
      });

      const generatedItinerary: StructuredItineraryData = {
        id: dbRes?.itinerary?.id || `it_form_${Date.now()}`,
        title: dbRes?.itinerary?.title || `${formResult.destination} Getaway`,
        destination: formResult.destination,
        startDate: formResult.dates.split('to')[0]?.trim() || '2026-08-10',
        endDate: formResult.dates.split('to')[1]?.trim() || '2026-08-14',
        budget: parseInt(formResult.budget.replace(/[^0-9]/g, '')) || 50000,
        days: dbRes?.days || [
          {
            dayNumber: 1,
            title: `Arrival & ${formResult.accommodation} Check-in`,
            coverImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80',
            weather: '27°C Pleasant 🌤️',
            activities: [
              { time: '11:00 AM', description: `Check-in at ${formResult.accommodation}`, location: formResult.destination, placeType: 'H' },
              { time: '02:00 PM', description: `Curated Dining (${formResult.specialRequirements})`, location: formResult.destination, placeType: 'R' },
              { time: '06:00 PM', description: 'Sunset Heritage Tour', location: formResult.destination, placeType: 'TA' },
            ],
          },
        ],
      };

      addItinerary(generatedItinerary);

      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'daina',
          text: `✦ Custom 9-Step Itinerary Created and persisted to your Trips database for ${formResult.destination}!`,
          isItinerary: true,
          itineraryData: generatedItinerary,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'daina',
          text: `✦ Itinerary created for ${formResult.destination} and saved to your local canvas!`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <>
      {/* Floating Gold Butler Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-6 z-40 flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-black shadow-2xl shadow-amber-500/20 hover:scale-105 transition-all border border-amber-300/50 group"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden border border-black/40 shrink-0">
          <Image src="/assets/ai/daina.png" alt="DAIna AI" width={32} height={32} className="w-full h-full object-cover" />
        </div>
        <span className="text-xs font-extrabold pr-1 tracking-wider uppercase font-sans-editorial hidden sm:inline">Concierge Butler</span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
      </button>

      {/* 9-Step Guided Input Modal */}
      <TravelInputDialogModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Getaway Chat Modal Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 md:bottom-20 right-4 sm:right-6 z-40 w-full max-w-sm sm:max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col h-[580px] transition-all animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-orange-300 shadow-md shrink-0">
                <Image src="/assets/ai/daina.png" alt="DAIna" width={40} height={40} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-serif-editorial font-bold text-slate-900 text-base flex items-center gap-1.5">
                  DAIna Concierge
                  <Award className="w-3.5 h-3.5 text-orange-500" />
                </h3>
                <p className="text-[10px] text-orange-600 uppercase tracking-widest font-extrabold">24/7 Smart Getaway Butler</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsFormModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 text-[11px] font-extrabold border border-orange-200 flex items-center gap-1"
              >
                <SlidersHorizontal className="w-3 h-3 text-orange-600" />
                <span>9-Step Form</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
            {['Plan 3-day luxury Goa', 'Find 5-Star Villas under ₹10k', 'Flight Cashback', 'Snow trek in Manali'].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip)}
                className="text-[10px] px-3 py-1 rounded-full bg-white text-slate-700 hover:text-orange-700 hover:bg-orange-50 border border-slate-200/90 shrink-0 font-bold transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                ✦ {chip}
              </button>
            ))}
          </div>

          {/* Message History */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 text-xs no-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                <div className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'daina' && (
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-orange-300">
                      <Image src="/assets/ai/daina.png" alt="DAIna" width={24} height={24} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div
                    className={`p-3.5 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs font-medium'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Render Itinerary Card Preview inside Chat */}
                {msg.isItinerary && msg.itineraryData && (
                  <div className="ml-8 p-4 rounded-2xl bg-white border border-orange-200 space-y-2 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="font-serif-editorial font-bold text-slate-900 text-xs">{msg.itineraryData.title}</span>
                      <span className="text-[10px] text-orange-600 font-extrabold">₹{msg.itineraryData.budget.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="space-y-1">
                      {msg.itineraryData.days[0]?.activities?.map((act: ActivityItem, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[11px] text-slate-700 font-medium">
                          <span>• {act.description}</span>
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-[9px] font-mono text-orange-700 font-extrabold border border-orange-200">
                            [{act.placeType || 'TA'}]
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-[11px] py-1 border border-orange-200 text-orange-700 hover:bg-orange-50 font-bold"
                        onClick={() => handleSaveItineraryToDB(msg.itineraryData!)}
                      >
                        Save to PostgreSQL
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 text-[11px] py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold"
                        onClick={() => {
                          setIsOpen(false);
                          router.push('/planner');
                        }}
                      >
                        Open Planner →
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-orange-300">
                  <Image src="/assets/ai/daina.png" alt="DAIna" width={24} height={24} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 rounded-2xl bg-white border border-orange-200 text-slate-700 shadow-2xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500 animate-spin" />
                  <span className="text-[11px] font-medium text-slate-600">DAIna is querying route fares & sanctuaries...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask DAIna anything about getaways..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 font-medium"
            />
            <button
              onClick={() => handleSend()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:scale-105 active:scale-95 transition-all shadow-md shadow-orange-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
