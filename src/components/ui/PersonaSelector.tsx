'use client';

import { User, Users, Baby, Compass } from 'lucide-react';

export type PersonaType = 'solo' | 'family' | 'group' | 'daytripper';

interface PersonaSelectorProps {
  activePersona: PersonaType;
  onSelectPersona: (persona: PersonaType) => void;
}

export function PersonaSelector({ activePersona, onSelectPersona }: PersonaSelectorProps) {
  const personas = [
    {
      id: 'solo',
      label: 'Solo Adventurer',
      icon: User,
      desc: 'Hostels, local tours & budget deals',
      color: 'from-orange-500 to-amber-500',
    },
    {
      id: 'family',
      label: 'Family Planner',
      icon: Baby,
      desc: 'Kitchen suites, safety & kid activities',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      id: 'group',
      label: 'Group Getaway',
      icon: Users,
      desc: 'Nightlife, split costs & voting',
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'daytripper',
      label: 'Day Tripper',
      icon: Compass,
      desc: 'Weekend hikes & transit maps',
      color: 'from-emerald-500 to-teal-500',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-extrabold text-orange-600 tracking-wider">
          Explorer Persona Presets
        </span>
        <span className="text-[11px] text-slate-500 font-medium">Tailors AI recommendations</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {personas.map((p) => {
          const isActive = activePersona === p.id;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPersona(p.id as PersonaType)}
              className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                isActive
                  ? `bg-gradient-to-br ${p.color} text-white shadow-md border-transparent scale-105`
                  : 'bg-white text-slate-800 border-slate-200/90 shadow-2xs hover:border-orange-300 hover:bg-orange-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-orange-500'}`} />
                <span className="font-extrabold text-xs sm:text-sm">{p.label}</span>
              </div>
              <div className={`text-[10px] mt-1 font-medium ${isActive ? 'text-white/90' : 'text-slate-500'}`}>
                {p.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
