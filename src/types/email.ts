export interface EmailRecipient {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface EmailSendHistory {
  id: string;
  messageId?: string;
  messageIds?: string[];
  recipientEmail?: string;
  recipientEmails?: string[];
  batchId: string;
  articleCount: number;
  articleIds?: string[];
  sentAt: string;
  status?: "success" | "partial_success" | "failed";
}

export interface EmailSettings {
  recipients: EmailRecipient[];
  defaultRecipientId?: string;
  sendHistory: EmailSendHistory[];
}
