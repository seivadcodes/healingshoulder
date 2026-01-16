// src/components/modals/ReportModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

type ReportTargetType = 'call' | 'comment' | 'post' | 'user' | 'community';

type ParticipantOption = {
  id: string;
  name: string;
};

interface ReportContext {
  timestamp: string;
  call_type?: 'group' | 'one-on-one';
  call_duration?: number | null; // 👈 allow null to match DB
  reported_user_id?: string;
}

export default function ReportModal({
  
  isOpen,
  onClose,
  targetId,
  targetType,
  currentUserId,
  callDuration,
  participants = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  targetId: string; // now safe as text
  targetType: ReportTargetType;
  currentUserId: string | null;
  callDuration?: number | null; // 👈 explicitly allow null
  participants?: ParticipantOption[];
}) {
  const [reportReason, setReportReason] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  const handleSubmit = async () => {
    if (!currentUserId || !reportReason.trim() || !isOpen) return;

    setIsSubmitting(true);
    try {
      const context: ReportContext = {
        timestamp: new Date().toISOString(),
      };

      if (targetType === 'call') {
        context.call_type = participants.length > 1 ? 'group' : 'one-on-one';
        context.call_duration = callDuration ?? null; // safe assignment
        if (selectedParticipantId) {
          context.reported_user_id = selectedParticipantId;
        }
      }

      const { error } = await supabase.from('reports').insert({
        target_type: targetType,
        target_id: targetId, // ✅ now text — works with "call_123", etc.
        reporter_id: currentUserId, // ✅ must be valid UUID
        reason: reportReason.trim(),
        created_at: new Date().toISOString(), // ✅ required
        status: 'pending', // ✅ required
        context: Object.keys(context).length > 0 ? context : null, // ✅ safe for jsonb
      });

      if (error) throw error;

      toast.success('Report submitted. Our safety team will review this.');
      onClose();
    } catch (err) {
      console.error('Failed to submit report:', err);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setReportReason('');
      setSelectedParticipantId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: '#0f172a',
          borderRadius: '0.75rem',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'white' }}>
            Report {targetType === 'call' ? 'Call' : targetType.charAt(0).toUpperCase() + targetType.slice(1)}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ color: '#cbd5e1' }}>
            Help us keep the community safe. Please describe why you’re reporting this.
          </p>

          {/* Optional participant selector (for calls) */}
          {participants.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>
                Report specific participant (optional):
              </label>
              <select
                value={selectedParticipantId || ''}
                onChange={(e) => setSelectedParticipantId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">Select participant (optional)</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe the issue..."
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              minHeight: '100px',
              fontSize: '0.875rem',
              backgroundColor: '#1e293b',
              color: 'white',
            }}
            maxLength={500}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid #334155',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #4b5563',
                borderRadius: '0.375rem',
                background: 'transparent',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reportReason.trim() || isSubmitting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                opacity: !reportReason.trim() || isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}