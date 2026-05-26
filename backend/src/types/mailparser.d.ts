/// <reference types="node" />

declare module "mailparser" {
  export interface ParsedMailAddress {
    name?: string;
    address?: string;
  }

  export interface ParsedMailAddressObject {
    value?: ParsedMailAddress[];
    text?: string;
    html?: string;
  }

  export interface ParsedMailAttachment {
    filename?: string;
    contentType?: string;
    content?: Buffer;
    size?: number;
    cid?: string;
  }

  export interface ParsedMail {
    subject?: string;
    messageId?: string;
    inReplyTo?: string;
    date?: Date;
    text?: string;
    html?: string | false;
    from?: ParsedMailAddressObject;
    to?: ParsedMailAddressObject | ParsedMailAddressObject[];
    cc?: ParsedMailAddressObject | ParsedMailAddressObject[];
    bcc?: ParsedMailAddressObject | ParsedMailAddressObject[];
    attachments?: ParsedMailAttachment[];
  }

  export function simpleParser(source: Buffer | string): Promise<ParsedMail>;
}
