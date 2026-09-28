"use client";

import * as React from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  AlertCircle, ArrowUp, Bot, Check,
  Database, LoaderCircle, Menu,
  MessageSquarePlus, PanelRightClose, PanelRightOpen, Search,
  ShieldCheck, Sparkles,
} from "lucide-react";
import { Logo } from "@/components/site/logo";

type ClarificationAnswer = "A" | "B" | "both" | "neither";
type MemoryClarification = {
  id: string;
  question: string;
  options: Array<{ answer: ClarificationAnswer; label: string; memoryId: string | null }>;
  expiresAt: string | null;
};
type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  clarification?: MemoryClarification | null;
};
type EvidenceItem = {
  id: string;
  content: string;
  category: string;
  relevanceScore: number;
  sourceEventId: string | null;
  provenance: Record<string, unknown> | null;
};

type AssistantResponse = {
  answer?: string;
  error?: string;
  clarification?: MemoryClarification | null;
  clarificationResolution?: {
    resolved: boolean;
    clarificationId: string;
    resolution: ClarificationAnswer;
  };
  memory?: {
    quotaMode: string;
    circuitStatus: string;
    cached: boolean;
    items: EvidenceItem[];
  };
  write?: { jobId?: string | null; status: string; nothingToExtract: boolean };
};

function writeStatusLabel(write: AssistantResponse["write"]): string {
  if (!write) return "";
  if (write.nothingToExtract) return "No durable memory found";
  if (write.status === "queued") return "Queued for governance";
  if (write.status === "blocked") return "Not accepted";
  if (/^L[1-4]$/.test(write.status)) return `Not accepted (${write.status})`;
  return write.status;
}

export function AssistantShell() {
  const { isLoaded, user } = useUser();
  const [evidenceOpen, setEvidenceOpen] = React.useState(true);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<ChatTurn[]>([]);
  const [evidence, setEvidence] = React.useState<EvidenceItem[]>([]);
  const [memoryState, setMemoryState] = React.useState({ quotaMode: "READY", circuitStatus: "HEALTHY", cached: false });
  const [writeStatus, setWriteStatus] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resolvingClarificationId, setResolvingClarificationId] = React.useState<string | null>(null);
  const [resolvedClarifications, setResolvedClarifications] = React.useState<Record<string, ClarificationAnswer>>({});
  const [error, setError] = React.useState("");
  const sendingRef = React.useRef(false);
  const resolvingRef = React.useRef(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error, resolvingClarificationId]);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || !user || loading || resolvingClarificationId || sendingRef.current) return;
    sendingRef.current = true;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: "user", content: message };
    setMessages((current) => [...current, userTurn]);
    setDraft("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const payload = (await response.json()) as AssistantResponse;
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? "The assistant could not answer.");
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.answer!,
        clarification: payload.clarification,
      }]);
      if (payload.memory) {
        setEvidence(payload.memory.items);
        setMemoryState({
          quotaMode: payload.memory.quotaMode,
          circuitStatus: payload.memory.circuitStatus,
          cached: payload.memory.cached,
        });
      }
      setWriteStatus(writeStatusLabel(payload.write));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant could not answer.");
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  }

  async function resolveClarification(clarification: MemoryClarification, answer: ClarificationAnswer, label: string) {
    if (!user || loading || resolvingRef.current || resolvedClarifications[clarification.id]) return;
    resolvingRef.current = true;
    setResolvingClarificationId(clarification.id);
    setError("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer_clarification",
          clarificationId: clarification.id,
          answer,
        }),
      });
      const payload = (await response.json()) as AssistantResponse;
      if (!response.ok || !payload.clarificationResolution?.resolved) {
        throw new Error(payload.error ?? "MemoryOS could not save that choice.");
      }
      setResolvedClarifications((current) => ({ ...current, [clarification.id]: answer }));
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", content: `Use: ${label}` },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer === "neither"
            ? "Understood. I won’t treat either option as current."
            : answer === "both"
              ? "Understood. I’ll treat both as valid context."
              : `Understood. I’ll use “${label}” as the current context.`,
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MemoryOS could not save that choice.");
    } finally {
      resolvingRef.current = false;
      setResolvingClarificationId(null);
    }
  }

  function newConversation() {
    setMessages([]);
    setEvidence([]);
    setWriteStatus("");
    setResolvingClarificationId(null);
    setResolvedClarifications({});
    setError("");
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#07090b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_0%,rgba(158,255,122,0.08),transparent_34%),radial-gradient(circle_at_18%_100%,rgba(123,227,255,0.05),transparent_30%)]" />
      <div className="relative grid h-dvh overflow-hidden lg:grid-cols-[270px_minmax(0,1fr)_360px]">
        <aside className={`${mobileNavOpen ? "flex" : "hidden"} fixed inset-0 z-40 flex-col border-r border-white/[0.08] bg-[#090c0e] p-4 lg:static lg:flex`}>
          <div className="flex h-12 items-center justify-between">
            <Logo className="text-white" />
            <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-white/50 hover:bg-white/5 lg:hidden" aria-label="Close menu">×</button>
          </div>
          <div className="mt-5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-sm text-white/50">Customer workspace</div>
          <button onClick={newConversation} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#9EFF7A] px-3 py-3 text-sm font-semibold text-[#071008]">
            <MessageSquarePlus className="size-4" /> New conversation
          </button>
          <div className="mt-6">
            <div className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Recent</div>
            <button className="mt-2 w-full rounded-xl border border-[#9EFF7A]/20 bg-[#9EFF7A]/[0.06] p-3 text-left">
              <div className="text-sm font-medium text-white/90">Launch priorities</div>
              <div className="mt-1 truncate text-xs text-white/40">Project, support and plan context</div>
            </button>
          </div>
          <div className="mt-auto rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5">
            <div className="flex items-center gap-2.5">
              <UserButton appearance={{ elements: { avatarBox: "size-9" } }} />
              <div className="min-w-0"><div className="truncate text-sm font-medium">{isLoaded ? user?.fullName || user?.firstName || "Signed-in user" : "Loading account…"}</div><div className="truncate text-xs text-white/35">{user?.primaryEmailAddress?.emailAddress || "Authenticated customer"}</div></div>
            </div>
          </div>
        </aside>

        <section className="flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="flex h-16 items-center border-b border-white/[0.08] px-4 sm:px-6">
            <button onClick={() => setMobileNavOpen(true)} className="mr-3 rounded-lg p-2 text-white/60 hover:bg-white/5 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="size-4 text-[#9EFF7A]" /> Northstar Assistant</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/35"><span className="size-1.5 rounded-full bg-[#9EFF7A]" /> Online · GPT-4.1 mini</div>
            </div>
            <button onClick={() => setEvidenceOpen((value) => !value)} className="ml-auto rounded-lg border border-white/[0.08] p-2 text-white/45 transition hover:bg-white/5 hover:text-white" aria-label="Toggle evidence panel">
              {evidenceOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </button>
          </header>

          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-5 sm:px-6">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-8 [scrollbar-gutter:stable] sm:py-12">
              {messages.length === 0 ? (
              <div className="flex gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#9EFF7A]/20 bg-[#9EFF7A]/10"><Sparkles className="size-4 text-[#9EFF7A]" /></div>
                <div className="max-w-2xl">
                  <div className="text-[13px] font-medium text-white/55">Northstar Assistant</div>
                  <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">One assistant. Context from every trusted service.</h1>
                  <p className="mt-3 max-w-xl text-[15px] leading-7 text-white/55">Ask about your work, previous support conversations or account. The assistant combines relevant context into one answer while MemoryOS keeps sources and authority visible.</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["What should I work on next?", "What plan am I using?", "Explain this in my preferred style"].map((prompt) => (
                      <button key={prompt} onClick={() => setDraft(prompt)} className="rounded-full border border-white/[0.1] bg-white/[0.025] px-3 py-2 text-xs text-white/55 transition hover:border-[#9EFF7A]/30 hover:text-white">{prompt}</button>
                    ))}
                  </div>
                </div>
              </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((turn) => (
                    <div key={turn.id} className={`flex gap-3 ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                      {turn.role === "assistant" && <div className="grid size-8 shrink-0 place-items-center rounded-xl border border-[#9EFF7A]/20 bg-[#9EFF7A]/10"><Sparkles className="size-3.5 text-[#9EFF7A]" /></div>}
                      <div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${turn.role === "user" ? "bg-white text-black" : "border border-white/[0.08] bg-white/[0.035] text-white/80"}`}>
                        {turn.content}
                        {turn.role === "assistant" && turn.clarification && (
                          <div className="mt-4 whitespace-normal rounded-xl border border-[#9EFF7A]/20 bg-[#9EFF7A]/[0.045] p-3.5">
                            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#9EFF7A]"><ShieldCheck className="size-3.5" /> Memory check</div>
                            <p className="mt-2 text-sm leading-6 text-white/85">{turn.clarification.question}</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {turn.clarification.options.map((option) => {
                                const selected = resolvedClarifications[turn.clarification!.id] === option.answer;
                                const disabled = Boolean(resolvedClarifications[turn.clarification!.id]) || resolvingClarificationId === turn.clarification!.id;
                                return (
                                  <button
                                    key={`${turn.clarification!.id}-${option.answer}`}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => void resolveClarification(turn.clarification!, option.answer, option.label)}
                                    className={`rounded-lg border px-3 py-2 text-left text-xs leading-5 transition ${selected ? "border-[#9EFF7A]/50 bg-[#9EFF7A]/15 text-white" : "border-white/[0.09] bg-black/20 text-white/65 hover:border-[#9EFF7A]/30 hover:text-white disabled:cursor-default disabled:opacity-50"}`}
                                  >
                                    <span className="flex items-center justify-between gap-2"><span>{option.label}</span>{selected && <Check className="size-3.5 shrink-0 text-[#9EFF7A]" />}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {resolvingClarificationId === turn.clarification.id && <div className="mt-2 flex items-center gap-2 text-[11px] text-white/40"><LoaderCircle className="size-3 animate-spin" /> Saving your choice securely…</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && <div className="flex items-center gap-3 text-sm text-white/35"><LoaderCircle className="size-4 animate-spin text-[#9EFF7A]" /> Retrieving context and forming the answer…</div>}
                  <div ref={bottomRef} aria-hidden="true" />
                </div>
              )}
              {error && <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200"><AlertCircle className="size-4" />{error}</div>}
            </div>

            <div className="shrink-0 pb-1 pt-4">
              <div className="rounded-2xl border border-white/[0.1] bg-[#0c0f12]/95 p-2 shadow-2xl shadow-black/30 focus-within:border-[#9EFF7A]/30">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={2} maxLength={2000} placeholder="Ask the assistant…" className="w-full resize-none bg-transparent px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/25" />
                <div className="flex items-center justify-between px-2 pb-1">
                  <span className="px-1 text-[10px] text-white/25">Signed in as {user?.firstName || "customer"}</span>
                  <button onClick={() => void sendMessage()} disabled={!draft.trim() || loading || Boolean(resolvingClarificationId) || !user} className="grid size-9 place-items-center rounded-xl bg-[#9EFF7A] text-[#071008] transition hover:bg-[#B5FF99] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/25" aria-label="Send message"><ArrowUp className="size-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-white/25">MemoryOS is additive: the assistant will continue safely when memory is empty or degraded.</p>
            </div>
          </div>
        </section>

        {evidenceOpen && (
          <aside className="fixed inset-y-0 right-0 z-30 hidden h-dvh w-[360px] overflow-y-auto border-l border-white/[0.08] bg-[#090c0e]/95 p-5 backdrop-blur-xl lg:block lg:static lg:w-auto">
            <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Answer evidence</div><div className="mt-1 text-xs text-white/35">Retrieved for the latest answer</div></div><ShieldCheck className="size-5 text-[#9EFF7A]" /></div>
            <div className="mt-6 rounded-2xl border border-[#9EFF7A]/20 bg-[#9EFF7A]/[0.045] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[#9EFF7A]"><ShieldCheck className="size-4" /> Context governance</div>
              <p className="mt-2 text-xs leading-5 text-white/45">{memoryState.quotaMode} retrieval · {memoryState.circuitStatus.toLowerCase()} circuit{memoryState.cached ? " · cached" : ""}</p>
              <p className="mt-2 text-[10px] text-white/25">Governed context provided by MemoryOS</p>
            </div>
            <SectionTitle>Relevant memory preview</SectionTitle>
            {evidence.length ? <div className="space-y-2">
              {evidence.map((memory) => (
                <div key={memory.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7BE3FF]">{memory.category}</span><Check className="size-3 text-[#9EFF7A]" /></div>
                  <p className="mt-2 text-xs leading-5 text-white/65">{memory.content}</p>
                  <p className="mt-2 truncate text-[10px] text-white/30">{memory.sourceEventId ? `Event · ${memory.sourceEventId}` : "Governed MemoryOS record"}</p>
                </div>
              ))}
            </div> : <div className="rounded-xl border border-dashed border-white/[0.08] p-4 text-xs leading-5 text-white/30">Ask a question to see the exact memories retrieved for its answer.</div>}
            {writeStatus && <div className="mt-4 flex items-center gap-2 text-[10px] text-white/35"><Database className="size-3.5" /> Latest turn: {writeStatus}</div>}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.06] px-3 py-2.5 text-xs text-white/35"><Search className="size-3.5" /> Provenance remains attached to retrieved records</div>
          </aside>
        )}
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">{children}</div>;
}
