import { repairEmailText } from "./mojibake.util";

describe("mailbox mojibake repair", () => {
  it("repairs Vietnamese text decoded as Windows-1252/Latin-1", () => {
    expect(repairEmailText("Hi anh HÃ¹ng, kháº£o sÃ¡t vÃ  gá»­i mail")).toBe(
      "Hi anh Hùng, khảo sát và gửi mail"
    );
    expect(repairEmailText(Buffer.from("Số lượng trả về", "utf8").toString("latin1"))).toBe("Số lượng trả về");
    expect(repairEmailText("Ä‘Ã£ chuyá»ƒn sang tráº¡ng thÃ¡i")).toBe("đã chuyển sang trạng thái");
  });

  it("repairs recoverable chunks when the message already contains replacement characters", () => {
    expect(repairEmailText("Sá»‘ lÆ°á»£ng tráº£ vá»�")).toBe("Số lượng trả v��");
  });

  it("keeps already valid Vietnamese unchanged", () => {
    const valid = "Xin chào anh Hùng, báo giá đã chuyển sang trạng thái hiệu lực.";
    expect(repairEmailText(valid)).toBe(valid);
  });

  it("repairs mixed html without breaking tags", () => {
    expect(repairEmailText("<p>NhÃ  mÃ¡y Ä‘Ã£ xÃ¡c nháº­n</p>")).toBe(
      "<p>Nhà máy đã xác nhận</p>"
    );
  });
});
