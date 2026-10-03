'use client';

import React, { useState, useEffect } from 'react';
import { History, RotateCcw, ShieldCheck, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiService } from '@/services/api';

interface RevisionSnapshot {
  id: string;
  version: number;
  parent_version?: number;
  restored_from_version?: number;
  action: string;
  action_type: string;
  summary: string;
  is_undo: boolean;
  created_at: string;
}

interface TripHistoryProps {
  tripId: string;
  onStateRestored: () => Promise<void>;
}

export const TripHistory: React.FC<TripHistoryProps> = ({
  tripId,
  onStateRestored,
}) => {
  const [revisions, setRevisions] = useState<RevisionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const fetchRevisions = async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTripRevisions(tripId);
      setRevisions(data || []);
    } catch (err: any) {
      console.error('Failed to load trip revisions:', err);
      setError('Unable to load trip revision history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevisions();
  }, [tripId]);

  const handleUndo = async () => {
    if (undoing || !tripId) return;
    setUndoing(true);
    try {
      await apiService.undoTripAction(tripId);
      await fetchRevisions();
      await onStateRestored();
    } catch (err: any) {
      console.error('Failed to undo trip revision:', err);
      setError('Failed to undo latest trip action.');
    } finally {
      setUndoing(false);
    }
  };

  const getActionBadge = (rev: RevisionSnapshot) => {
    if (rev.is_undo) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
          <RotateCcw className="w-3 h-3 text-indigo-600" />
          UNDO (Restores v{rev.restored_from_version})
        </span>
      );
    }
    if (rev.action_type === 'AI_MODIFY_ITINERARY') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
          <Sparkles className="w-3 h-3 text-purple-600" />
          AI Proposal
        </span>
      );
    }
    if (rev.action_type === 'INITIAL_CREATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Baseline v1
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
        <Clock className="w-3 h-3 text-slate-500" />
        {rev.action_type}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xl font-serif-editorial font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-orange-600" />
            Append-Only Trip Revisions
          </h3>
          <p className="text-xs text-slate-500">
            Every AI proposal acceptance and itinerary mutation produces an immutable revision snapshot.
          </p>
        </div>
        {revisions.length > 1 && (
          <Button
            size="sm"
            onClick={handleUndo}
            disabled={undoing}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 cursor-pointer shadow-sm self-start sm:self-auto"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${undoing ? 'animate-spin' : ''}`} />
            {undoing ? 'Undoing...' : 'Undo Latest Action'}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse py-4">
          <div className="h-16 bg-slate-200 rounded-2xl" />
          <div className="h-16 bg-slate-200 rounded-2xl" />
        </div>
      ) : revisions.length === 0 ? (
        <Card className="p-8 text-center space-y-3 rounded-3xl bg-white border border-slate-200">
          <History className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-base font-semibold text-slate-800">No Revisions Found</h4>
          <p className="text-xs text-slate-500">
            Trip state is version 1 baseline. Future changes will record new revisions here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {revisions.map((rev) => (
            <Card
              key={rev.id || rev.version}
              className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                    v{rev.version}
                  </span>
                  {getActionBadge(rev)}
                  {rev.parent_version !== undefined && rev.parent_version !== null && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      (from v{rev.parent_version})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {new Date(rev.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                {rev.summary || rev.action}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
