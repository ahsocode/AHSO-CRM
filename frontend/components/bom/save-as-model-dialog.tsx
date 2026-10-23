"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSaveBomAsModel } from "@/hooks/use-boms";
import { useMaterialsSelect } from "@/hooks/use-materials";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { BomSaveAsModelInput } from "@/types/bom";

const newProductSchema = z.object({
  code: z.string().trim().min(1, "Mã thành phẩm là bắt buộc").max(40),
  name: z.string().trim().min(2, "Tên thành phẩm phải có ít nhất 2 ký tự").max(200),
  unit: z.string().trim().min(1, "Đơn vị tính là bắt buộc").max(40)
});

type ProductMode = "existing" | "new";

export function SaveAsModelDialog({
  open,
  onOpenChange,
  bomId,
  defaultName
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bomId: string;
  defaultName: string;
}) {
  const router = useRouter();
  const saveMutation = useSaveBomAsModel(bomId);
  const [productMode, setProductMode] = useState<ProductMode>("existing");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [productId, setProductId] = useState("");
  const [newProduct, setNewProduct] = useState({ code: "", name: defaultName, unit: "Bộ" });
  const [source, setSource] = useState<"ESTIMATE" | "ACTUAL">("ESTIMATE");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (open) {
      setProductMode("existing");
      setSearch("");
      setProductId("");
      setNewProduct({ code: "", name: defaultName, unit: "Bộ" });
      setSource("ESTIMATE");
      setError(null);
    }
  }, [open, defaultName]);

  const productsQuery = useMaterialsSelect(debounced || undefined, "PRODUCT");

  function handleSubmit() {
    setError(null);
    let payload: BomSaveAsModelInput;
    if (productMode === "existing") {
      if (!productId) {
        setError("Hãy chọn một thành phẩm.");
        return;
      }
      payload = { productId, source };
    } else {
      const parsed = newProductSchema.safeParse(newProduct);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Thông tin thành phẩm chưa hợp lệ.");
        return;
      }
      payload = { newProduct: parsed.data, source };
    }
    saveMutation.mutate(payload, {
      onSuccess: (result) => {
        toast.success("Đã lưu thành mẫu máy (bản nháp).");
        onOpenChange(false);
        router.push(`/inventory/models/${result.id}` as Route);
      },
      onError: (err) => setError(getApiErrorMessage(err, "Không thể lưu thành mẫu máy."))
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lưu thành mẫu máy</DialogTitle>
          <DialogDescription>
            Tạo một phiên bản mẫu máy (bản nháp) từ BOM này để dùng lại cho các dự án sau.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-text-primary">Thành phẩm</legend>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name="model-product-mode"
                checked={productMode === "existing"}
                onChange={() => setProductMode("existing")}
              />
              Chọn thành phẩm có sẵn
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name="model-product-mode"
                checked={productMode === "new"}
                onChange={() => setProductMode("new")}
              />
              Tạo thành phẩm mới
            </label>
          </fieldset>

          {productMode === "existing" ? (
            <div className="space-y-2">
              <Input
                aria-label="Tìm thành phẩm"
                placeholder="Tìm mã hoặc tên thành phẩm..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="max-h-48 overflow-y-auto rounded-md bg-bg-subtle">
                {productsQuery.isLoading ? (
                  <p className="px-3 py-3 text-sm text-text-secondary">Đang tải...</p>
                ) : !productsQuery.data?.length ? (
                  <p className="px-3 py-3 text-sm text-text-secondary">
                    Chưa có thành phẩm phù hợp. Chọn “Tạo thành phẩm mới” để tạo.
                  </p>
                ) : (
                  productsQuery.data.slice(0, 50).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setProductId(product.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-bg",
                        productId === product.id ? "bg-primary-bg font-semibold" : ""
                      )}
                    >
                      <span className="shrink-0 font-mono text-xs text-text-muted">{product.code}</span>
                      <span className="flex-1 truncate text-text-primary">{product.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="model-new-code" className="text-sm font-semibold text-text-primary">
                  Mã thành phẩm
                </label>
                <Input
                  id="model-new-code"
                  value={newProduct.code}
                  onChange={(event) => setNewProduct({ ...newProduct, code: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="model-new-unit" className="text-sm font-semibold text-text-primary">
                  Đơn vị tính
                </label>
                <Input
                  id="model-new-unit"
                  value={newProduct.unit}
                  onChange={(event) => setNewProduct({ ...newProduct, unit: event.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label htmlFor="model-new-name" className="text-sm font-semibold text-text-primary">
                  Tên thành phẩm
                </label>
                <Input
                  id="model-new-name"
                  value={newProduct.name}
                  onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
                />
              </div>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-text-primary">Nguồn số liệu</legend>
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name="model-source"
                className="mt-1"
                checked={source === "ESTIMATE"}
                onChange={() => setSource("ESTIMATE")}
              />
              <span>
                Dự toán
                <span className="block text-xs text-text-secondary">Giữ nguyên số lượng và đơn giá dự kiến của BOM.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name="model-source"
                className="mt-1"
                checked={source === "ACTUAL"}
                onChange={() => setSource("ACTUAL")}
              />
              <span>
                Thực tế
                <span className="block text-xs text-text-secondary">
                  Lấy số lượng và đơn giá bình quân từ phân bổ và chi phí thực tế của dự án (dòng chưa có thực tế giữ
                  dự toán).
                </span>
              </span>
            </label>
          </fieldset>

          {error ? <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" variant="primary" disabled={saveMutation.isPending} onClick={handleSubmit}>
            {saveMutation.isPending ? "Đang lưu..." : "Lưu thành mẫu máy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
