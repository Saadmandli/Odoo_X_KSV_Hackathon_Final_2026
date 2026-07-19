import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Search, Send, Trash2, UserPlus } from "lucide-react";
import { del, get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar, Banner, EmptyState, Spinner } from "../components/ui";

// Polled, like the rest of the app's live surfaces: nothing to reconnect and
// it behaves the same on every host.
const POLL_MS = 4000;

/** "14:32" for today, "Mon" this week, "12 Jul" beyond that. */
function stamp(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  const days = (now - d) / 86_400_000;
  if (days < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function DirectMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState(null);
  const [people, setPeople] = useState([]);
  const [active, setActive] = useState(null); // the colleague whose thread is open
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [finding, setFinding] = useState(false); // "new message" mode
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const loadInbox = useCallback(async () => {
    try {
      const { conversations } = await get("/messages");
      setConversations(conversations);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadThread = useCallback(async (personId) => {
    try {
      const { messages } = await get(`/messages/${personId}`);
      setMessages(messages);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // One timer drives both the inbox and whichever thread is open, so an unread
  // badge never disagrees with the conversation sitting next to it.
  useEffect(() => {
    const id = setInterval(() => {
      loadInbox();
      if (active) loadThread(active.id);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [active, loadInbox, loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // The directory is only fetched when someone actually goes looking, rather
  // than on every visit to the page.
  useEffect(() => {
    if (!finding) return;
    const timer = setTimeout(async () => {
      try {
        const { people } = await get(`/messages/people?q=${encodeURIComponent(query)}`);
        setPeople(people);
      } catch (err) {
        setError(err.message);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [finding, query]);

  const open = async (person) => {
    setActive(person);
    setMessages(null);
    setFinding(false);
    setQuery("");
    await loadThread(person.id);
    // Opening clears the unread count server-side, so refresh the badges too.
    loadInbox();
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !active) return;

    setDraft("");
    setSending(true);
    setError("");
    try {
      const { message } = await post(`/messages/${active.id}`, { body });
      setMessages((prev) => [...(prev ?? []), message]);
      loadInbox();
    } catch (err) {
      setError(err.message);
      setDraft(body); // hand their text back rather than losing it
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await del(`/messages/message/${id}`);
      loadInbox();
    } catch (err) {
      setError(err.message);
      if (active) loadThread(active.id);
    }
  };

  if (conversations === null) return <Spinner label="Loading messages" />;

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-sm">
      {/* ---------------------------------------------------------- sidebar */}
      {/* On a phone the list and the thread are the same column: the list is
          hidden once a conversation is open, so neither is squeezed. */}
      <aside
        className={`flex w-full min-w-0 flex-col border-r border-slate-200 sm:w-72 sm:shrink-0 ${
          active ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Messages
            {totalUnread > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {totalUnread}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => {
              setFinding((v) => !v);
              setQuery("");
            }}
            aria-label="New message"
            className={`ml-auto flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              finding
                ? "border-brand-300 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <UserPlus size={16} />
          </button>
        </div>

        {finding && (
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                className="field h-9 pl-9 text-sm"
                placeholder="Search colleagues"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {finding
            ? people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => open(p)}
                  className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <Avatar name={p.name} color={p.avatarColor} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium text-slate-800">
                      {p.name}
                    </span>
                    {p.department && (
                      <span className="block truncate text-xs text-slate-500">{p.department}</span>
                    )}
                  </span>
                </button>
              ))
            : conversations.map((c) => (
                <button
                  key={c.person.id}
                  onClick={() => open(c.person)}
                  className={`flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left transition ${
                    active?.id === c.person.id ? "bg-brand-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <Avatar name={c.person.name} color={c.person.avatarColor} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-slate-800">
                        {c.person.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {stamp(c.lastMessage.createdAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${
                          c.unread > 0 ? "font-semibold text-slate-700" : "text-slate-500"
                        }`}
                      >
                        {c.lastMessage.fromMe && "You: "}
                        {c.lastMessage.body}
                      </span>
                      {c.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))}

          {!finding && conversations.length === 0 && (
            <div className="p-5">
              <EmptyState
                icon={MessageCircle}
                title="No conversations yet"
                hint="Message a colleague directly to sort out a pickup."
              />
            </div>
          )}

          {finding && people.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {query ? `Nobody matching “${query}”.` : "Loading colleagues…"}
            </p>
          )}
        </div>
      </aside>

      {/* ----------------------------------------------------------- thread */}
      <section className={`min-w-0 flex-1 flex-col ${active ? "flex" : "hidden sm:flex"}`}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={MessageCircle}
              title="Select a conversation"
              hint="Or start a new one with the button above the list."
            />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 p-3">
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-label="Back to conversations"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 sm:hidden"
              >
                <ArrowLeft size={17} />
              </button>
              <Avatar name={active.name} color={active.avatarColor} size={36} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-slate-900">
                  {active.name}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {active.department || "Colleague"}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-4">
              {messages === null ? (
                <Spinner label="Loading conversation" />
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No messages yet — say hello to {active.name.split(" ")[0]}.
                </p>
              ) : (
                messages.map((m, i) => {
                  const mine = m.senderId === user.id;
                  const grouped = i > 0 && messages[i - 1].senderId === m.senderId;

                  return (
                    <div
                      key={m.id}
                      className={`group flex ${mine ? "justify-end" : "justify-start"} ${
                        grouped ? "mt-0.5" : "mt-3"
                      }`}
                    >
                      <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                        <div
                          className={`inline-block rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                            mine
                              ? "rounded-br-md bg-brand-600 text-white"
                              : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          {m.body}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                          {mine && (
                            <button
                              onClick={() => remove(m.id)}
                              aria-label="Delete message"
                              className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <span>{stamp(m.createdAt)}</span>
                          {mine && m.readAt && <span className="text-brand-500">Read</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
              <input
                className="field"
                placeholder={`Message ${active.name.split(" ")[0]}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
              />
              <button
                className="btn-primary px-4"
                aria-label="Send"
                disabled={sending || !draft.trim()}
              >
                <Send size={17} />
              </button>
            </form>
          </>
        )}
      </section>

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Banner>{error}</Banner>
        </div>
      )}
    </div>
  );
}
