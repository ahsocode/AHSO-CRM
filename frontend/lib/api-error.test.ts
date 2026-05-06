import axios from "axios";
import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "./api-client";

describe("getApiErrorMessage", () => {
  it("prefers validation error arrays from API envelopes", () => {
    const error = new axios.AxiosError("Bad Request");
    error.response = {
      data: {
        message: "Dữ liệu không hợp lệ",
        errors: ["Email không hợp lệ", "Mật khẩu quá ngắn"]
      },
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {} as never
    };

    expect(getApiErrorMessage(error)).toBe("Email không hợp lệ; Mật khẩu quá ngắn");
  });

  it("falls back to API message, native error message, then fallback text", () => {
    const apiError = new axios.AxiosError("Forbidden");
    apiError.response = {
      data: {
        message: "Bạn không có quyền thực hiện thao tác này"
      },
      status: 403,
      statusText: "Forbidden",
      headers: {},
      config: {} as never
    };

    expect(getApiErrorMessage(apiError)).toBe("Bạn không có quyền thực hiện thao tác này");
    expect(getApiErrorMessage(new Error("Network failed"))).toBe("Network failed");
    expect(getApiErrorMessage("unknown", "Lỗi dự phòng")).toBe("Lỗi dự phòng");
  });

  it("surfaces a clearer diagnostic when the API is unreachable", () => {
    const networkError = new axios.AxiosError("Network Error");

    expect(getApiErrorMessage(networkError)).toContain("Không kết nối được API");
  });
});
