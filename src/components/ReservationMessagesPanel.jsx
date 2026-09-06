import { useEffect, useRef, useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getReservationMessages,
  sendReservationMessage,
  subscribeToReservationMessages
} from '@/lib/reservationMessages';

/**
 * Modal chat thread attached to a single reservation (lab or equipment).
 * Shows the rejection reason (if any) as context at the top, then a
 * message thread anyone with access to the reservation can post into.
 *
 * @param {'lab'|'equipment'} reservationType
 * @param {number} reservationId
 * @param {string} label - e.g. "Reservation #00012"
 * @param {string} [rejectionReason]
 * @param {() => void} onClose
 */
const ReservationMessagesPanel = ({ reservationType, reservationId, label, rejectionReason, onClose }) => {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        const data = await getReservationMessages(reservationType, reservationId);
        setMessages(data);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
      setLoading(false);
    })();
    unsubscribe = subscribeToReservationMessages(reservationType, reservationId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return unsubscribe;
  }, [reservationType, reservationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendReservationMessage(reservationType, reservationId, user.id, role || 'user', draft);
      setDraft('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const roleLabel = (r) => (r === 'admin' ? 'Admin' : r === 'staff' ? 'Staff' : 'Researcher');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">Messages about this request</p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground p-1 rounded">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {rejectionReason && (
          <div className="mx-5 mt-4 flex gap-2 items-start bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-destructive">Rejection reason</p>
              <p className="text-xs text-foreground/80 mt-0.5">{rejectionReason}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[10rem]">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No messages yet. {rejectionReason ? 'Ask a question about the rejection below.' : 'Say something below.'}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    <p className={`font-semibold mb-0.5 ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {roleLabel(m.sender_role)}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-3 border-t border-border flex gap-2 flex-shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground focus:outline-none focus:border-primary resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="bg-primary text-primary-foreground px-3 rounded-lg border-none cursor-pointer hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationMessagesPanel;
