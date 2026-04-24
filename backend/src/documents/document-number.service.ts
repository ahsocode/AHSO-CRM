import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DocumentType } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";

/**
 * Mapping from DocumentType → number prefix. Exported so templates/tests
 * can reuse the same source of truth.
 */
export const DOCUMENT_PREFIX: Record<DocumentType, string> = {
  QUOTATION: "BG",
  PROPOSAL: "DX",
  SURVEY_REPORT: "KS",
  CONTRACT: "HD",
  CONTRACT_ADDENDUM: "PL",
  NDA: "NDA",
  DELIVERY_NOTE: "GH",
  DOC_HANDOVER: "BGTL",
  INSTALLATION_REPORT: "LD",
  ACCEPTANCE_REPORT: "NT",
  PARTIAL_ACCEPTANCE: "NTTP",
  WARRANTY_CERT: "BH",
  MAINTENANCE_RECORD: "BT",
  PAYMENT_REQUEST: "TT",
  PAYMENT_RECEIPT: "PT",
  AR_RECONCILIATION: "DCN"
};

export const CUSTOMER_CODE_FALLBACK = "XXX";
export const MAX_COLLISION_RETRIES = 5;

@Injectable()
export class DocumentNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a document number WITHOUT persisting anything.
   *
   * Format: `{PREFIX}-{YYYY}-{CUSTOMER_CODE}-{SEQ}-v{VERSION}`
   *
   * The sequence is `(# of Documents of this type in the given year) + 1`,
   * zero-padded to 3 digits. Because we don't hold a lock, callers that need
   * a guaranteed-unique number should use `reserve(...)` with retry-on-unique
   * logic (see `reserveWithRetry`).
   */
  async generate(
    type: DocumentType,
    customerCode: string | null | undefined,
    version = 1,
    now: Date = new Date(),
    seqOverride?: number
  ): Promise<string> {
    const prefix = DOCUMENT_PREFIX[type];
    if (!prefix) {
      throw new InternalServerErrorException(`Không có prefix cho loại tài liệu ${type}`);
    }

    const year = now.getFullYear();
    const code = this.normalizeCustomerCode(customerCode);
    const seq = seqOverride ?? (await this.nextSequence(type, year));
    const seqPadded = String(seq).padStart(3, "0");
    return `${prefix}-${year}-${code}-${seqPadded}-v${version}`;
  }

  /**
   * Generate a number and retry up to MAX_COLLISION_RETRIES times if the
   * caller's subsequent insert would collide on the unique `number`.
   *
   * Returns a closure the caller invokes inside their transaction. If the
   * closure throws a unique-violation the caller should call this again.
   */
  async reserveWithRetry(
    type: DocumentType,
    customerCode: string | null | undefined,
    version: number,
    attempt: (number: string, seq: number) => Promise<void>,
    now: Date = new Date()
  ): Promise<string> {
    const year = now.getFullYear();
    const baseSeq = await this.nextSequence(type, year);

    for (let i = 0; i < MAX_COLLISION_RETRIES; i++) {
      const seq = baseSeq + i;
      const number = await this.generate(type, customerCode, version, now, seq);
      try {
        await attempt(number, seq);
        return number;
      } catch (error) {
        if (this.isUniqueConstraintViolation(error)) {
          // Another writer beat us to it — bump and try again.
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException(
      "Không thể tạo số tài liệu duy nhất sau nhiều lần thử. Vui lòng thử lại."
    );
  }

  /**
   * Count Documents of `type` created in `year` and return the next seq.
   */
  async nextSequence(type: DocumentType, year: number): Promise<number> {
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);

    const count = await this.prisma.document.count({
      where: {
        type,
        createdAt: {
          gte: start,
          lt: end
        }
      }
    });

    return count + 1;
  }

  normalizeCustomerCode(code: string | null | undefined): string {
    if (!code) return CUSTOMER_CODE_FALLBACK;
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return cleaned.length > 0 ? cleaned : CUSTOMER_CODE_FALLBACK;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const code = (error as { code?: string }).code;
    return code === "P2002";
  }
}
