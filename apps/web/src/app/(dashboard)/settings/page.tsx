"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Zap } from "lucide-react";
import { DEMO_PROFILE_USER } from "@stockright/shared/demo";

const STROKE = 2;

export default function ProfileSettingsPage() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg-page)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-page)] px-0 py-3 sm:border-b-0 sm:py-4">
        <Link
          href="/"
          className="rounded-[var(--radius-md)] p-1 text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] sm:hidden"
          aria-label="Back to Home"
        >
          <ChevronLeft className="size-6" strokeWidth={STROKE} />
        </Link>
        <h1 className="flex-1 font-[family-name:var(--font-display)] text-[22px] font-semibold text-[var(--text-primary)] sm:flex-none">
          Preferences
        </h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-0 pb-10 pt-2 sm:pt-4">
        <section className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--brand-subtle)] font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--brand-text)]">
            {DEMO_PROFILE_USER.initials}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[var(--text-primary)]">
              {DEMO_PROFILE_USER.name}
            </p>
            <p className="text-[13px] text-[var(--text-secondary)]">{DEMO_PROFILE_USER.subtitle}</p>
          </div>
        </section>

        <div>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Account
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <SettingsRow label="Language" value={DEMO_PROFILE_USER.languageDisplay} />
            <SettingsRow label="Godown" value={DEMO_PROFILE_USER.godownDisplay} />
            <SettingsRow label="Number format" value={DEMO_PROFILE_USER.numberFormatSample} last />
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Display
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[15px] text-[var(--text-primary)]">Dark mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                onClick={() => setDarkMode((v) => !v)}
                className={
                  darkMode
                    ? "relative h-6 w-11 shrink-0 rounded-full bg-[var(--brand-ui)] p-0.5 transition-colors"
                    : "relative h-6 w-11 shrink-0 rounded-full bg-[var(--bg-inset)] p-0.5 transition-colors"
                }
              >
                <span
                  className={
                    darkMode
                      ? "block size-5 translate-x-5 rounded-full bg-[var(--bg-surface)] shadow transition-transform"
                      : "block size-5 translate-x-0 rounded-full bg-[var(--bg-surface)] shadow transition-transform"
                  }
                />
              </button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Data</h2>
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-[var(--text-primary)]">Offline queue</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">3 entries waiting to upload</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--pending)]">
                <Zap className="size-3" fill="currentColor" aria-hidden />
                3 queued
              </span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Session</h2>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <button
              type="button"
              className="flex min-h-[var(--touch-target)] w-full items-center gap-2 px-4 py-3.5 text-left text-[15px] font-medium text-[var(--outward)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
              aria-label="Log out"
              onClick={() => {}}
            >
              <LogOut className="size-4 shrink-0" strokeWidth={STROKE} aria-hidden />
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <button
      type="button"
      className={
        last
          ? "flex w-full items-center justify-between px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
          : "flex w-full items-center justify-between border-b border-[var(--border-default)] px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
      }
    >
      <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
      <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)]">
        {value}
        <ChevronRight className="size-4 shrink-0" strokeWidth={STROKE} aria-hidden />
      </span>
    </button>
  );
}
