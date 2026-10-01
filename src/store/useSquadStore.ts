import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SquadMember {
  id: string;
  name: string;
  avatar: string;
  role: 'host' | 'co-planner' | 'explorer';
  isVerified: boolean;
  trustScore: string;
  vibe: string;
  paidAmount: number;
}

export interface ActivityVote {
  activityId: string;
  upvotes: string[]; // member ids
  downvotes: string[]; // member ids
}

export interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // member id
  splitWith: string[]; // member ids
  category: 'flight' | 'stay' | 'food' | 'activity' | 'transit';
  date: string;
}

interface SquadState {
  squadName: string;
  squadCode: string;
  members: SquadMember[];
  votes: Record<string, ActivityVote>;
  expenses: ExpenseItem[];
  
  // Actions
  addMember: (member: SquadMember) => void;
  removeMember: (memberId: string) => void;
  voteActivity: (activityId: string, memberId: string, voteType: 'up' | 'down') => void;
  addExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  removeExpense: (expenseId: string) => void;
  resetSquad: () => void;
}

export const useSquadStore = create<SquadState>()(
  persist(
    (set, get) => ({
      squadName: 'Coastal & Heritage Squad',
      squadCode: 'SQUAD-GOA-2026',
      members: [
        {
          id: 'user_01',
          name: 'Kumkum Pandey',
          avatar: 'KP',
          role: 'host',
          isVerified: true,
          trustScore: '98% Verified Explorer',
          vibe: 'Tech Nomad',
          paidAmount: 8500,
        },
        {
          id: 'user_02',
          name: 'Aarav Sharma',
          avatar: 'AS',
          role: 'co-planner',
          isVerified: true,
          trustScore: '95% Verified Explorer',
          vibe: 'Roadtripper',
          paidAmount: 7200,
        },
        {
          id: 'user_03',
          name: 'Riya Patel',
          avatar: 'RP',
          role: 'explorer',
          isVerified: true,
          trustScore: '92% Verified Explorer',
          vibe: 'Beach Chiller',
          paidAmount: 3800,
        },
        {
          id: 'user_04',
          name: 'Vikram Sengupta',
          avatar: 'VS',
          role: 'explorer',
          isVerified: false,
          trustScore: 'New Explorer',
          vibe: 'Culture Seeker',
          paidAmount: 3900,
        },
      ],
      votes: {
        act_01: { activityId: 'act_01', upvotes: ['user_01', 'user_02', 'user_03'], downvotes: [] },
        act_02: { activityId: 'act_02', upvotes: ['user_01', 'user_03'], downvotes: ['user_04'] },
        act_03: { activityId: 'act_03', upvotes: ['user_01', 'user_02', 'user_03', 'user_04'], downvotes: [] },
      },
      expenses: [
        {
          id: 'exp_01',
          description: 'Flight Boarding Passes (IndiGo BLR → GOI)',
          amount: 8500,
          paidBy: 'user_01',
          splitWith: ['user_01', 'user_02', 'user_03', 'user_04'],
          category: 'flight',
          date: '10 Aug 2026',
        },
        {
          id: 'exp_02',
          description: 'Taj Exotica Beachfront Suite (4 Nights)',
          amount: 7200,
          paidBy: 'user_02',
          splitWith: ['user_01', 'user_02', 'user_03', 'user_04'],
          category: 'stay',
          date: '11 Aug 2026',
        },
        {
          id: 'exp_03',
          description: 'Private Sunset Catamaran & Scuba Diving',
          amount: 3900,
          paidBy: 'user_04',
          splitWith: ['user_01', 'user_02', 'user_03', 'user_04'],
          category: 'activity',
          date: '12 Aug 2026',
        },
        {
          id: 'exp_04',
          description: 'Thalassa Greek Culinary Dinner',
          amount: 3800,
          paidBy: 'user_03',
          splitWith: ['user_01', 'user_02', 'user_03', 'user_04'],
          category: 'food',
          date: '13 Aug 2026',
        },
      ],

      addMember: (member) =>
        set((state) => ({ members: [...state.members, member] })),

      removeMember: (memberId) =>
        set((state) => ({ members: state.members.filter((m) => m.id !== memberId) })),

      voteActivity: (activityId, memberId, voteType) =>
        set((state) => {
          const currentVote = state.votes[activityId] || {
            activityId,
            upvotes: [],
            downvotes: [],
          };

          const newUp = currentVote.upvotes.filter((id) => id !== memberId);
          const newDown = currentVote.downvotes.filter((id) => id !== memberId);

          if (voteType === 'up') {
            newUp.push(memberId);
          } else {
            newDown.push(memberId);
          }

          return {
            votes: {
              ...state.votes,
              [activityId]: {
                activityId,
                upvotes: newUp,
                downvotes: newDown,
              },
            },
          };
        }),

      addExpense: (expense) =>
        set((state) => ({
          expenses: [
            ...state.expenses,
            { ...expense, id: `exp_${Date.now()}` },
          ],
        })),

      removeExpense: (expenseId) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== expenseId),
        })),

      resetSquad: () =>
        set({
          squadName: 'Coastal & Heritage Squad',
          squadCode: 'SQUAD-GOA-2026',
          members: [],
          votes: {},
          expenses: [],
        }),
    }),
    {
      name: 'dashtiny-squad-storage',
    }
  )
);
