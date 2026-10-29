import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { getDocumentErrorMessage, getDocumentFieldErrors } from "./document-errors";

function serverError(data: unknown) {
  return new AxiosError("Request failed with status code 422", "ERR_BAD_REQUEST", undefined, undefined, {data, status:422, statusText:"Unprocessable Entity", headers:{}, config:{} as never});
}
describe("document server errors", () => {
  it("keeps the server's exact messages on their nested row and date fields", () => {
    expect(getDocumentFieldErrors(serverError({errors:[
      {field:"handedOverDocs.0.name", message:"Tên tài liệu còn thiếu."},
      {field:"handoverDate", message:"Ngày thực tế không hợp lệ"},
      {field:"handedOverDocs.0.name", message:"Cần nội dung thực tế."}
    ]}))).toEqual({"handedOverDocs.0.name":"Tên tài liệu còn thiếu.; Cần nội dung thực tế.", handoverDate:"Ngày thực tế không hợp lệ"});
  });
  it("shows field explanations instead of Axios's generic message", () => {
    expect(getDocumentErrorMessage(serverError({message:"Chưa đủ dữ liệu", errors:[{field:"payment.id", message:"Chưa có khoản thanh toán thực tế."}]}))).toBe("Chưa có khoản thanh toán thực tế.");
  });
  it("handles preview errors sent as text and traditional string errors", () => {
    expect(getDocumentErrorMessage(serverError(JSON.stringify({message:"Chưa đủ dữ liệu", errors:[{field:"technician", message:"Chưa có kỹ thuật viên."}]})))).toBe("Chưa có kỹ thuật viên.");
    expect(getDocumentErrorMessage(serverError({errors:["Không có quyền"]}))).toBe("Không có quyền");
  });
});
