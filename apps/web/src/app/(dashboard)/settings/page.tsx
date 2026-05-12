"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Warehouse, Zap } from "lucide-react";
import { translations, defaultLocale, type Locale } from "@stockright/shared/i18n";
import {
  UI_LOCALE_STORAGE_KEY,
  detectDefaultUiLocaleFromTag,
  languagePickerOptions,
  parseUiLocale,
} from "@stockright/shared/utils";
import { logoutAction } from "@/app/actions/session";
import { useSessionUser } from "@/components/session/session-user-provider";
import { useIsOffline } from "@/hooks/useIsOffline";

const STROKE = 2;
const DEMO_QUEUE_COUNT = 3;

function fmtCount(template: string, count: number): string {
  return template.replace(/\{\{count\}\}/g, String(count));
}

export default function ProfileSettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const { context, canSwitchWarehouse } = useSessionUser();
  const offline = useIsOffline();

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(UI_LOCALE_STORAGE_KEY) : null;
    const next =
      parseUiLocale(stored) ??
      (typeof navigator !== "undefined"
        ? detectDefaultUiLocaleFromTag(navigator.language)
        : defaultLocale);
    setLocale(next);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "en" ? "en-IN" : locale === "te" ? "te-IN" : "hi-IN";
    }
  }, [locale]);

  const setUiLocale = useCallback((next: Locale) => {
    setLocale(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const p = translations[locale].preferences;
  const displayName = context?.fullName?.trim() || context?.phone || "Account";
  const profileSub =
    context?.warehouseName != null
      ? `${context.roleLabel} · ${context.warehouseName}`
      : `${context?.roleLabel ?? "—"}`;

  const currentLangLabel =
    languagePickerOptions.find((o) => o.code === locale)?.labelNative ?? languagePickerOptions[0]!.labelNative;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg-page)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-page)] px-0 py-3 sm:border-b-0 sm:py-4">
        <Link
          href="/"
          className="rounded-[var(--radius-md)] p-1 text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] sm:hidden"
          aria-label={p.back_home}
        >
          <ChevronLeft className="size-6" strokeWidth={STROKE} />
        </Link>
        <h1 className="flex-1 font-[family-name:var(--font-display)] text-[22px] font-semibold text-[var(--text-primary)] sm:flex-none">
          {p.title}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-0 pb-10 pt-2 sm:pt-4">
        <section className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--brand-subtle)] font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--brand-text)]">
            {context?.initials ?? "?"}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[var(--text-primary)]">
              {displayName}
            </p>
            <p className="text-[13px] text-[var(--text-secondary)]">{profileSub}</p>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {p.account}
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <SettingsValueRow label={p.organization} value={context?.tenantName ?? "—"} />
            <SettingsValueRow label={p.your_role} value={context?.roleLabel ?? "—"} />
            <SettingsValueRow label={p.warehouse} value={context?.warehouseName ?? "—"} />
            {canSwitchWarehouse ? (
              <Link
                href="/warehouse-select?switch=1"
                className="flex min-h-[var(--touch-target)] w-full cursor-pointer items-center justify-between border-b border-[var(--border-default)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
              >
                <span className="flex items-center gap-2 text-[15px] font-medium text-[var(--brand-text)]">
                  <Warehouse className="size-4 shrink-0" strokeWidth={STROKE} aria-hidden />
                  {p.switch_warehouse}
                </span>
                <ChevronRight className="size-4 shrink-0 text-[var(--text-tertiary)]" strokeWidth={STROKE} aria-hidden />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setLangSheetOpen(true)}
              className="flex w-full min-h-[var(--touch-target)] cursor-pointer items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
            >
              <span className="text-[15px] text-[var(--text-primary)]">{p.language}</span>
              <span className="flex max-w-[55%] items-center gap-1.5 text-right text-[13px] text-[var(--text-tertiary)]">
                <span className="truncate">{currentLangLabel}</span>
                <ChevronRight className="size-4 shrink-0" strokeWidth={STROKE} aria-hidden />
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {p.display}
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[15px] text-[var(--text-primary)]">{p.dark_mode}</span>
              <button
                type="button"
                role="switch"
                aria-checked={darkMode}
                onClick={() => setDarkMode((v) => !v)}
                className={
                  darkMode
                    ? "relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-[var(--brand-ui)] p-0.5 transition-colors"
                    : "relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-[var(--bg-inset)] p-0.5 transition-colors"
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

        <div className="flex flex-col gap-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{p.data}</h2>
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium text-[var(--text-primary)]">
                  {offline ? p.offline_queue : p.synced_title}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                  {offline ? fmtCount(p.offline_sub, DEMO_QUEUE_COUNT) : p.synced_sub}
                </p>
              </div>
              {offline ? (
                <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--pending)]">
                  <Zap className="size-3" fill="currentColor" aria-hidden />
                  {fmtCount(p.offline_badge, DEMO_QUEUE_COUNT)}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--inward-border)] bg-[var(--inward-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--inward)]">
                  {p.synced_badge}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{p.session}</h2>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex min-h-[var(--touch-target)] w-full cursor-pointer items-center gap-2 px-4 py-3.5 text-left text-[15px] font-medium text-[var(--outward)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
                aria-label={p.log_out}
              >
                <LogOut className="size-4 shrink-0" strokeWidth={STROKE} aria-hidden />
                {p.log_out}
              </button>
            </form>
          </div>
        </div>
      </div>

      {langSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay-scrim)] p-4 sm:items-center"
          role="presentation"
          onClick={() => setLangSheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-sheet-title"
            className="w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-default)] px-4 py-3">
              <h2 id="lang-sheet-title" className="font-[family-name:var(--font-display)] text-[17px] font-semibold text-[var(--text-primary)]">
                {p.choose_language}
              </h2>
            </div>
            <ul className="max-h-[min(70vh,360px)] overflow-y-auto py-1">
              {languagePickerOptions.map((opt) => {
                const selected = opt.code === locale;
                return (
                  <li key={opt.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setUiLocale(opt.code);
                        setLangSheetOpen(false);
                      }}
                      className="flex min-h-[var(--touch-target)] w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
                    >
                      <span>
                        <span className="block text-[15px] font-medium text-[var(--text-primary)]">{opt.labelNative}</span>
                        {opt.labelEn !== opt.labelNative ? (
                          <span className="mt-0.5 block text-[12px] text-[var(--text-tertiary)]">{opt.labelEn}</span>
                        ) : null}
                      </span>
                      {selected ? (
                        <span className="text-[13px] font-medium text-[var(--inward)]" aria-current="true">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[var(--touch-target)] w-full items-center justify-between border-b border-[var(--border-default)] px-4 py-3.5">
      <span className="text-[15px] text-[var(--text-primary)]">{label}</span>
      <span className="max-w-[55%] truncate text-right text-[13px] text-[var(--text-tertiary)]">{value}</span>
    </div>
  );
}
