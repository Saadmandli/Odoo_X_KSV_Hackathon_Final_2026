import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, Trash2 } from "lucide-react";
import { del, get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Banner, EmptyState, Spinner } from "../components/ui";

// Polled rather than socket-based, for the same reason live tracking is: no
// connection to drop, and it behaves identically on every host.
const POLL_MS = 5000;

const SUGGESTIONS = [
  "Anyone driving to GIFT City tomorrow morning?",
  "Two seats free on my 6pm run home.",
  "Is the SG Highway route busy today?",
];

export default function Chat() {
  const { user, org } = useAuth();
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const lastAt = useRef(null);

  const load = useCallback(async (incremental) => {
    try {
      const since = incremental ? lastAt.current : null;
      const { messages: batch } = await get(`/chat${since ? `?since=${encodeURIComponent(since)}` : ""}`);

      if (batch.length > 0) lastAt.current = batch[batch.length - 1].createdAt;

      setMessages((prev) => {
        if (!incremental || prev === null) return batch;
        if (batch.length === 0) return prev;
        // Guard against a message arriving twice if a poll overlaps a send.
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...batch.filter((m) => !seen.has(m.id))];
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const send = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setDraft("");
    setSending(true);
    setError("");
    try {
      const { message } = await post("/chat", { body });
      lastAt.current = message.createdAt;
      setMessages((prev) => [...(prev ?? []), message]);
    } catch (err) {
      setError(err.message);
      setDraft(body); // give them their text back rather than losing it
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await del(`/chat/${id}`);
    } catch (err) {
      setError(err.message);
      load(false);
    }
  };

  if (messages === null) return <Spinner label="Loading messages" />;

  return (
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-3xl flex-col">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {org?.name ?? "Organisation"} chat
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask for a lift, offer a spare seat, or share a route tip. Everyone in your organisation
          can see this.
        </p>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No messages yet"
              hint="Start the conversation — ask who else is heading your way."
            />
          ) : (
            messages.map((m, i) => {
              const mine = m.sender.id === user.id;
              // Only re-show the avatar when the speaker changes.
              const grouped = i > 0 && messages[i - 1].sender.id === m.sender.id;

              return (
                <div key={m.id} className={`group flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                  <span className={grouped ? "w-8 shrink-0" : "shrink-0"}>
                    {!grouped && <Avatar name={m.sender.name} color={m.sender.avatarColor} size={32} />}
                  </span>

                  <div className={`min-w-0 max-w-[75%] ${mine ? "items-end text-right" : ""}`}>
                    {!grouped && (
                      <div className="mb-0.5 text-xs font-medium text-slate-700">
                        {mine ? "You" : m.sender.name}
                      </div>
                    )}

                    <div
                      className={`inline-block rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                        mine
                          ? "rounded-br-md bg-brand-600 text-white"
                          : "rounded-bl-md bg-slate-100 text-slate-800"
                      }`}
                    >
                      {m.body}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                      {mine && (
                        <button
                          onClick={() => remove(m.id)}
                          aria-label="Delete message"
                          className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setDraft(s)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
          <input
            className="field"
            placeholder="Message your colleagues"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
          />
          <button className="btn-primary px-4" aria-label="Send" disabled={sending || !draft.trim()}>
            <Send size={17} />
          </button>
        </form>
      </div>

      <div className="mt-3">
        <Banner>{error}</Banner>
      </div>
    </div>
  );
}
