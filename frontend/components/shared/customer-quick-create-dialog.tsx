"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useCreateCustomer } from "@/hooks/use-customers";
import { useToast } from "@/hooks/use-toast";

const quickCreateSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên khách hàng"),
  shortName: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .email("Email không hợp lệ")
    .optional()
    .or(z.literal("")),
});

type QuickCreateInput = z.infer<typeof quickCreateSchema>;

interface CustomerQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new customer id so the parent form can auto-select it. */
  onCreated: (customerId: string) => void;
}

/**
 * Tạo nhanh khách hàng ngay trong form Dự án / Báo giá / Khảo sát mà không
 * phải rời trang (giữ nguyên dữ liệu form cha đang nhập dở).
 * Người phụ trách mặc định là user hiện tại; các field còn lại bổ sung sau
 * ở trang chi tiết khách hàng.
 */
export function CustomerQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CustomerQuickCreateDialogProps) {
  const { user } = useAuth();
  const createCustomer = useCreateCustomer();
  const { success, error: showError } = useToast();

  const form = useForm<QuickCreateInput>({
    resolver: zodResolver(quickCreateSchema),
    defaultValues: { name: "", shortName: "", phone: "", email: "" },
  });

  const handleSubmit = form.handleSubmit((values) => {
    if (!user?.id) {
      showError("Không xác định được người phụ trách. Vui lòng đăng nhập lại.");
      return;
    }

    createCustomer.mutate(
      {
        name: values.name.trim(),
        shortName: values.shortName?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        status: "LEAD",
        isVip: false,
        assignedToId: user.id,
      },
      {
        onSuccess: (data) => {
          success(`Đã tạo khách hàng "${values.name.trim()}".`);
          form.reset();
          onOpenChange(false);
          onCreated(data.id);
        },
        onError: (err) => {
          showError(err instanceof Error ? err.message : "Không thể tạo khách hàng.");
        },
      }
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo nhanh khách hàng</DialogTitle>
          <DialogDescription>
            Chỉ cần thông tin cơ bản — bổ sung chi tiết sau ở trang khách hàng.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="quick-customer-name">Tên khách hàng *</Label>
            <Input
              id="quick-customer-name"
              placeholder="Công ty TNHH ABC"
              autoFocus
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="quick-customer-short">Tên viết tắt</Label>
              <Input id="quick-customer-short" placeholder="ABC" {...form.register("shortName")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-customer-phone">Số điện thoại</Label>
              <Input id="quick-customer-phone" placeholder="09xx xxx xxx" {...form.register("phone")} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-customer-email">Email</Label>
            <Input id="quick-customer-email" placeholder="lienhe@abc.vn" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" disabled={createCustomer.isPending} onClick={handleSubmit}>
            {createCustomer.isPending ? "Đang tạo..." : "Tạo khách hàng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
