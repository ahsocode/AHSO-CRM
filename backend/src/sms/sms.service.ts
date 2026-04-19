import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client?: Twilio.Twilio;

  constructor(private readonly configService: ConfigService) {}

  async sendSms(to: string, message: string) {
    const formattedPhone = this.normalizeVietnamesePhone(to);
    const from = this.configService.get<string>("TWILIO_FROM");
    const sid = this.configService.get<string>("TWILIO_SID");
    const token = this.configService.get<string>("TWILIO_TOKEN");

    if (!formattedPhone) {
      return {
        success: false,
        skipped: true,
        reason: "Số điện thoại không hợp lệ"
      };
    }

    if (!sid || !token || !from) {
      this.logger.warn("Bỏ qua gửi SMS vì Twilio chưa được cấu hình đầy đủ.");
      return {
        success: false,
        skipped: true,
        reason: "Twilio chưa được cấu hình"
      };
    }

    const client = this.getClient(sid, token);
    const response = await client.messages.create({
      to: formattedPhone,
      from,
      body: message
    });

    return {
      success: true,
      sid: response.sid,
      to: formattedPhone
    };
  }

  normalizeVietnamesePhone(phone: string) {
    const digits = phone.replace(/[^\d+]/g, "");

    if (!digits) {
      return null;
    }

    if (digits.startsWith("+84")) {
      return digits;
    }

    if (digits.startsWith("84")) {
      return `+${digits}`;
    }

    if (digits.startsWith("0")) {
      return `+84${digits.slice(1)}`;
    }

    return null;
  }

  private getClient(sid: string, token: string) {
    if (!this.client) {
      this.client = Twilio(sid, token);
    }

    return this.client;
  }
}
