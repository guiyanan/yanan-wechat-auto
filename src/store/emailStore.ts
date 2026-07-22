"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { EmailRecipient, EmailSendHistory } from "@/types";

interface EmailStoreState {
  recipients: EmailRecipient[];
  defaultRecipientId?: string;
  sendHistory: EmailSendHistory[];
  addRecipient: (input: { name: string; email: string }) => void;
  removeRecipient: (id: string) => void;
  setDefaultRecipientId: (id: string) => void;
  addSendHistory: (history: EmailSendHistory) => void;
}

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useEmailStore = create<EmailStoreState>()(
  persist(
    (set) => ({
      recipients: [],
      defaultRecipientId: undefined,
      sendHistory: [],
      addRecipient: (input) =>
        set((state) => {
          const recipient: EmailRecipient = {
            id: genId("mail"),
            name: input.name.trim() || input.email.trim(),
            email: input.email.trim(),
            createdAt: nowIso(),
          };
          return {
            recipients: [recipient, ...state.recipients],
            defaultRecipientId: state.defaultRecipientId ?? recipient.id,
          };
        }),
      removeRecipient: (id) =>
        set((state) => {
          const recipients = state.recipients.filter((r) => r.id !== id);
          const defaultRecipientId =
            state.defaultRecipientId === id
              ? recipients[0]?.id
              : state.defaultRecipientId;
          return { recipients, defaultRecipientId };
        }),
      setDefaultRecipientId: (id) => set({ defaultRecipientId: id }),
      addSendHistory: (history) =>
        set((state) => ({
          sendHistory: [history, ...state.sendHistory].slice(0, 30),
        })),
    }),
    {
      name: "joto-email-settings-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage)
      ),
    }
  )
);
