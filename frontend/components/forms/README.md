# Form primitives (`components/forms`)

Bộ thành phần chuẩn cho form theo `docs/FORM_STANDARD_AUDIT.md` (bước 1). Chưa form nào dùng; migrate từng form một ở các bước sau.

Import: `import { FormField, MoneyInput, ... } from "@/components/forms";`

| Thành phần | Vai trò |
|---|---|
| `FormField` | Nhãn + control + gợi ý + lỗi; tự gắn `id`, `aria-describedby`, `aria-invalid`, `aria-required`; dấu `*` (ẩn với screen reader, đọc "bắt buộc") |
| `FormSection` | Tiêu đề h2 + mô tả + lưới 1/2 cột |
| `FormActions` | Hủy (trái, outline) / Lưu (phải); "Đang lưu…" + spinner + disabled; `sticky` |
| `FormError` | Lỗi cấp form, `role="alert"` |
| `MoneyInput` | Tiền VND số nguyên, hiển thị `1.234.567`, giá trị `number \| undefined` |
| `NumberInput` | Số thập phân (`maxFractionDigits`), cùng quy ước rỗng = `undefined` |
| `DateInput` | `type=date`, giá trị ISO `yyyy-mm-dd`, `min`/`max` |
| `SelectField` | Bọc Radix select: placeholder, `loading`, trạng thái lỗi |
| `FormDialog` | Dialog + form + FormActions, hỏi xác nhận khi đóng lúc có thay đổi chưa lưu |

Liên quan: `lib/form-messages.ts`, `hooks/use-unsaved-changes-guard.ts`, `hooks/use-form-toast.ts`.

## Ví dụ đầy đủ (React Hook Form + Zod)

```tsx
"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  DateInput, FormActions, FormError, FormField, FormSection, MoneyInput, NumberInput, SelectField,
} from "@/components/forms";
import { formMessages, zodErrorMap } from "@/lib/form-messages";
import { useFormToast } from "@/hooks/use-form-toast";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const schema = z.object({
  name: z.string().trim().min(1, formMessages.required("Tên")).max(200, formMessages.maxLength(200, "Tên")),
  amount: z.number({ required_error: formMessages.required("Số tiền") }).min(0, formMessages.mustBePositive("Số tiền")).optional(),
  vat: z.number().min(0).max(100).optional(),
  dueDate: z.string().optional(),
  status: z.string().min(1, "Vui lòng chọn trạng thái"),
});
type Values = z.infer<typeof schema>;

export function ExampleForm() {
  const router = useRouter();
  const toast = useFormToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema, { errorMap: zodErrorMap }), // errorMap: tùy chọn, thông điệp mặc định tiếng Việt
    defaultValues: { name: "", amount: undefined, vat: 8, dueDate: undefined, status: "" },
  });
  const { control, register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = form;
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);
  const [formError, setFormError] = React.useState<string | null>(null);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save(values);
      toast.success();                 // "Đã lưu"
      allowNextNavigation();           // isDirty vẫn true sau submit: tắt guard trước khi chuyển trang
      router.push("/list");
    } catch (err) {
      toast.error(err);                // "Không lưu được: {lý do từ API}"
      setFormError("Không lưu được. Kiểm tra lại thông tin rồi thử lại.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FormSection title="Thông tin chung" description="Các trường có dấu * là bắt buộc.">
        {/* Input thường: dùng register */}
        <FormField label="Tên" required error={errors.name?.message} className="md:col-span-2">
          <Input {...register("name")} />
        </FormField>

        {/* MoneyInput / NumberInput / DateInput / SelectField: dùng Controller */}
        <FormField label="Số tiền" error={errors.amount?.message} hint="Đơn vị VND">
          <Controller control={control} name="amount"
            render={({ field }) => <MoneyInput {...field} />} />
        </FormField>
        <FormField label="VAT (%)" error={errors.vat?.message}>
          <Controller control={control} name="vat"
            render={({ field }) => <NumberInput {...field} maxFractionDigits={2} suffix="%" />} />
        </FormField>
        <FormField label="Hạn thanh toán" error={errors.dueDate?.message}>
          <Controller control={control} name="dueDate"
            render={({ field }) => <DateInput {...field} min="2026-01-01" />} />
        </FormField>
        <FormField label="Trạng thái" required error={errors.status?.message}>
          <Controller control={control} name="status"
            render={({ field }) => (
              <SelectField
                ref={field.ref} name={field.name} value={field.value} onBlur={field.onBlur}
                onValueChange={field.onChange}
                placeholder="Chọn trạng thái"
                options={[{ value: "DRAFT", label: "Nháp" }, { value: "SENT", label: "Đã gửi" }]}
              />
            )} />
        </FormField>
      </FormSection>

      <FormError message={formError} />
      <FormActions cancelHref="/list" submitLabel="Lưu thay đổi" isSubmitting={isSubmitting} sticky />
    </form>
  );
}
```

### FormDialog

```tsx
<FormDialog open={open} onOpenChange={setOpen} title="Thêm chi phí" onSubmit={onSubmit}
  isSubmitting={isSubmitting} isDirty={isDirty} error={formError}>
  <FormField label="Số tiền" required error={errors.amount?.message}>
    <Controller control={control} name="amount" render={({ field }) => <MoneyInput {...field} />} />
  </FormField>
</FormDialog>
```
Nhớ `reset()` khi đóng/mở lại để `isDirty` đúng.

## Quy ước quan trọng

- **Rỗng = `undefined`**, không bao giờ 0 trừ khi người dùng gõ 0. Nếu API cần `null`, đổi ở lớp payload (`amount ?? null`), đừng đổi trong input.
- `MoneyInput`: số nguyên VND, từ chối âm (trừ `allowNegative`), từ chối > `Number.MAX_SAFE_INTEGER` (phím gõ bị bỏ qua). Dán `1.234.567`, `1,234,567`, `1 234 567 ₫` đều ra `1234567`; khi dán, phần lẻ cuối `,dd`/`.dd` bị bỏ. Không dùng phép tính số thực.
- `NumberInput`: chấp nhận `2,5` hoặc `2.5` (một dấu thập phân duy nhất); vượt `maxFractionDigits` thì bỏ phím. Khoảng min/max do Zod kiểm tra (không tự kẹp giá trị).
- `value` truyền `null` được (coi như rỗng).
- `SelectField`: giá trị option không được là chuỗi rỗng (giới hạn của Radix).
- `useUnsavedChangesGuard`: App Router không có sự kiện đổi route. Hook chặn `beforeunload` và click liên kết nội bộ (confirm); `router.push/back` bằng code KHÔNG bị chặn, hãy gọi `confirmLeave()`; chặn nút Back của trình duyệt chỉ là best-effort (`interceptHistory: true`, mặc định tắt). Không dirty thì không gắn listener nào.
- `useFormToast`: dùng sonner (không dùng `use-toast` cũ).
- `zodErrorMap` không áp toàn cục; truyền qua `zodResolver(schema, { errorMap })` hoặc `schema.parse(data, { errorMap })`. Thông điệp ghi tường minh trong schema luôn được ưu tiên.

## Checklist migrate một form cũ

1. Đọc form + schema + payload gửi API; ghi lại payload hiện tại với cùng đầu vào (rỗng, 0, số lớn) để so sánh sau.
2. Thay `Label/ErrorText/Field` cục bộ bằng `FormField` (truyền `required` nếu schema bắt buộc; `error={errors.x?.message}`).
3. Gom trường vào `FormSection`; trường dài `className="md:col-span-2"`.
4. Ô tiền `type=number` -> `MoneyInput` qua `Controller`. Với form tiền (nhóm 7 trong audit): chỉ đổi khi có test "cùng chuỗi nhập -> cùng số gửi API"; không đụng logic tổng/VAT/công nợ.
5. Số thường -> `NumberInput`; `type=date` -> `DateInput`; select thô -> `SelectField` (thay `<option>Đang tải...` bằng `loading`).
6. Nút cuối form -> `FormActions` (nhãn "Hủy" / "Lưu" hoặc "Lưu thay đổi"); submit bằng `<form onSubmit>`, không `type=button + onClick`.
7. Lỗi cấp form -> `FormError`; toast -> `useFormToast` (bỏ `use-toast` trong form này).
8. Thêm `useUnsavedChangesGuard(isDirty)`; gọi `allowNextNavigation()` trước khi chuyển trang sau lưu thành công. Dialog -> `FormDialog`.
9. Thông điệp validate -> `formMessages` / `zodErrorMap`, giữ nguyên quy tắc validate.
10. Chạy `npm run typecheck && npm run lint && npm run test:unit` (+ E2E nếu đụng luồng); kiểm tra bàn phím (Tab, Enter submit), màn hình đọc nhãn/lỗi, nút >= 44px, sáng/tối.
