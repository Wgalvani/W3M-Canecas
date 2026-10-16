"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { btn } from "../ui";

const input =
  "h-12 w-full rounded-xl border border-line bg-card px-4 text-[15px] text-ink transition outline-none placeholder:text-muted/70 hover:border-ink-soft/40 focus:border-ink focus:ring-4 focus:ring-ink/8";

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      <input id={id} className={input} {...props} />
    </div>
  );
}

export function PasswordField({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} className={`${input} pr-20`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={id}
          aria-pressed={visible}
          className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-xs font-medium text-muted transition hover:bg-paper-deep hover:text-ink"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`h-12 w-full text-[15px] ${btn.primary}`}>
      {pending ? (
        <>
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-paper/30 border-t-signal" />
          {pendingLabel}
        </>
      ) : (
        <>
          {children} <span aria-hidden className="text-signal">→</span>
        </>
      )}
    </button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900">
        <span aria-hidden className="font-bold">✕</span>
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
        <span aria-hidden className="font-bold">✓</span>
        {message}
      </p>
    );
  }
  return null;
}
