import { createServerSupabase, isSupabaseConfigured } from "./supabase";
import type { PasswordRecord } from "./auth-types";
import { GUEST_PASSWORD_TTL_DAYS } from "./auth-types";

const GUEST_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateGuestCodeSuffix(length = 6): string {
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += GUEST_CODE_CHARS[Math.floor(Math.random() * GUEST_CODE_CHARS.length)];
  }
  return suffix;
}

export function normalizeGuestCodeInput(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.startsWith("GUEST-")) return trimmed;
  return `GUEST-${trimmed}`;
}

export function generateGuestPasswordCode(): string {
  return `GUEST-${generateGuestCodeSuffix(6)}`;
}

export async function findValidGuestPassword(input: string): Promise<PasswordRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const code = normalizeGuestCodeInput(input);
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("passwords")
    .select("*")
    .eq("type", "guest")
    .eq("code", code)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) throw error;
  return (data as PasswordRecord | null) ?? null;
}

export async function findGuestPasswordById(id: string): Promise<PasswordRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("passwords")
    .select("*")
    .eq("id", id)
    .eq("type", "guest")
    .gt("expires_at", now)
    .maybeSingle();

  if (error) throw error;
  return (data as PasswordRecord | null) ?? null;
}

export async function createGuestPassword(): Promise<PasswordRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const supabase = createServerSupabase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + GUEST_PASSWORD_TTL_DAYS);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateGuestPasswordCode();
    const { data, error } = await supabase
      .from("passwords")
      .insert({
        code,
        type: "guest",
        expires_at: expiresAt.toISOString(),
      })
      .select("*")
      .single();

    if (!error && data) {
      return data as PasswordRecord;
    }
    if (error?.code !== "23505") {
      throw error ?? new Error("Failed to create guest password");
    }
  }

  throw new Error("Failed to generate a unique guest password");
}

export async function listActiveGuestPasswords(): Promise<PasswordRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("passwords")
    .select("*")
    .eq("type", "guest")
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PasswordRecord[];
}
