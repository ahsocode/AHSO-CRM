import { numberToVietnameseWords } from "./number-to-words";

describe("numberToVietnameseWords", () => {
  it.each([
    [0, "không"],
    [15, "mười lăm"],
    [21, "hai mươi mốt"],
    [24, "hai mươi tư"],
    [101, "một trăm linh một"],
    [1005, "một nghìn không trăm linh năm"],
    [1_050_000, "một triệu không trăm năm mươi nghìn"],
    [1_000_000_005, "một tỷ không trăm linh năm"],
    [88_410_000, "tám mươi tám triệu bốn trăm mười nghìn"],
    [999_999_999_999, "chín trăm chín mươi chín tỷ chín trăm chín mươi chín triệu chín trăm chín mươi chín nghìn chín trăm chín mươi chín"],
    [1_000_000_000_000, "một nghìn tỷ"],
    [1_234_000_000_005, "một nghìn hai trăm ba mươi tư tỷ không trăm linh năm"],
    [2_000_005_000_000, "hai nghìn tỷ không trăm linh năm triệu"]
  ])("%d -> %s", (value, words) => {
    expect(numberToVietnameseWords(value)).toBe(words);
  });

  it("throws only beyond exact integer precision", () => {
    expect(() => numberToVietnameseWords(Number.MAX_SAFE_INTEGER)).not.toThrow();
    expect(() => numberToVietnameseWords(Number.MAX_SAFE_INTEGER * 4)).toThrow(RangeError);
  });
});
