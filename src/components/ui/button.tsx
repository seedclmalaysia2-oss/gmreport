"use client";

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementType, ReactElement, Ref } from "react";

/**
 * Shared button primitive for the app's action vocabulary. Owns the class
 * recipes for the three roles the design system defines, plus one warn
 * variant reserved for state-carrying CTAs (e.g. "Re-upload to enable
 * preview" on legacy rows).
 *
 * Roles:
 *   primary          — bg-ink-800 white text; one per row
 *   secondary        — white surface + ice border; the neutral action shell
 *   destructive      — text-bad only; row-level "Remove" / "Delete forever"
 *   destructive-solid — bg-bad white text; toolbar / bulk destructive CTAs
 *   warn             — bg-warn-100 warn-800 text; legacy / needs-attention CTAs
 *
 * Sizes:
 *   sm  — 11px, py-1 px-2   — row action clusters
 *   md  — 12-13px, py-1.5 px-3 — toolbar + modal footer
 *   lg  — 14px, py-2 px-4   — the form's primary Import CTA
 *
 * Polymorphic via `as` — pass "a" to render an anchor with the same
 * vocabulary (View / Save links use anchor semantics but need the primary
 * or secondary shell).
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "destructive-solid"
  | "warn";

export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-ink-800)] text-white hover:bg-[var(--color-ink-700)] active:scale-95",
  secondary:
    "bg-white border border-[var(--color-ice-200)] text-[var(--color-ink-800)] hover:bg-[var(--color-ice-50)] active:scale-95",
  destructive:
    "text-[var(--color-bad)] hover:bg-[var(--color-bad-50)]",
  "destructive-solid":
    "bg-[var(--color-bad)] text-white hover:bg-[var(--color-bad-800)] active:scale-95",
  warn:
    "bg-[var(--color-warn-100)] text-[var(--color-warn-800)] hover:bg-[var(--color-warn-200)] active:scale-95",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-[11px] gap-1",
  md: "px-3 py-1.5 text-xs gap-1.5",
  lg: "px-4 py-2 text-sm gap-2",
};

const BASE = "inline-flex items-center justify-center rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

type ButtonOwnProps<T extends ElementType> = {
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export type ButtonProps<T extends ElementType = "button"> =
  ButtonOwnProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;

function ButtonImpl<T extends ElementType = "button">(
  { as, variant = "secondary", size = "sm", className, ...rest }: ButtonProps<T>,
  ref: Ref<Element>,
) {
  const Tag = (as ?? "button") as ElementType;
  const merged = [BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(" ");
  const buttonProps = Tag === "button" ? { type: "button" as const, ...(rest as object) } : rest;
  return <Tag ref={ref} className={merged} {...buttonProps} />;
}

export const Button = forwardRef(ButtonImpl) as <T extends ElementType = "button">(
  props: ButtonProps<T> & { ref?: Ref<Element> },
) => ReactElement;
