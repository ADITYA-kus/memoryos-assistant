"use client";

import type { MemorySourceReview } from "memoryo-sdk";
import { Check, LoaderCircle, ShieldCheck } from "lucide-react";

export type SourceReviewAction = MemorySourceReview["actions"][number];
export type SourceReviewState = Exclude<SourceReviewAction, "restate"> | "stale";

const labels: Record<SourceReviewAction, string> = {
  keep_current: "Keep stored memory",
  restate: "State it again",
  dismiss: "Dismiss review",
};

export function sourceReviewKey(review: Pick<MemorySourceReview, "id" | "version">) {
  return `${review.id}:${review.version}`;
}

export function SourceReviewCard({ review, state, busy, disabled, onAnswer }: {
  review: MemorySourceReview;
  state?: SourceReviewState;
  busy: boolean;
  disabled: boolean;
  onAnswer: (action: SourceReviewAction) => void;
}) {
  return (
    <div className="mt-4 whitespace-normal rounded-xl border border-[#9EFF7A]/20 bg-[#9EFF7A]/[0.045] p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#9EFF7A]"><ShieldCheck className="size-3.5" /> Memory review</div>
      <p className="mt-2 text-sm leading-6 text-white/85">{review.question}</p>
      {review.currentMemoryContent && <div className="mt-2 rounded-lg border border-white/[0.08] p-2 text-xs leading-5 text-white/60"><span className="block text-[10px] text-white/35">Stored memory</span>{review.currentMemoryContent}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {review.actions.map((action) => (
          <button key={action} type="button" disabled={disabled || busy || Boolean(state)} onClick={() => onAnswer(action)} className="flex items-center gap-2 rounded-lg border border-white/[0.09] bg-black/20 px-3 py-2 text-xs text-white/65 transition hover:border-[#9EFF7A]/30 hover:text-white disabled:cursor-default disabled:opacity-50">
            {labels[action]}{state === action && <Check className="size-3.5 text-[#9EFF7A]" />}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-white/40" role="status">
        {state === "stale" ? "This review is no longer available. Ask again to refresh."
          : state ? "Review closed. Stored memory and authority were not changed."
          : "This review is pending, not a stored new preference."}
      </p>
      {busy && <div className="mt-2 flex items-center gap-2 text-[11px] text-white/40"><LoaderCircle className="size-3 animate-spin" /> Checking your choice…</div>}
    </div>
  );
}
