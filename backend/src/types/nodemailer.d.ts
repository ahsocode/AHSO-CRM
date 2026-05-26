declare module "nodemailer" {
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    streamTransport?: boolean;
    buffer?: boolean;
    newline?: "windows" | "unix";
  }

  export interface Attachment {
    filename: string;
    content: Buffer;
    contentType?: string;
  }

  export interface SendMailOptions {
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    messageId?: string;
    inReplyTo?: string;
    references?: string | string[];
    html: string;
    text?: string;
    attachments?: Attachment[];
  }

  export interface SentMessageInfo {
    messageId?: string | false;
    message?: Buffer | string;
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
  }

  export function createTransport(options: TransportOptions): Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
  };

  export default nodemailer;
}
