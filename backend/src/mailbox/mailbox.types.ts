export interface MailboxAddress {
  name: string | null;
  email: string;
}

export interface FolderInfo {
  name: string;
  path: string;
  delimiter: string;
  specialUse?: string | null;
  total: number;
  unread: number;
}

export interface ParsedMailboxMessage {
  uid: number;
  folder: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  fromName?: string | null;
  fromEmail: string;
  toAddresses: MailboxAddress[];
  ccAddresses: MailboxAddress[];
  bccAddresses: MailboxAddress[];
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  snippet?: string | null;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  size: number;
  receivedAt: Date;
}
