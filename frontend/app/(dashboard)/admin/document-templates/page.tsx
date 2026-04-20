"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useApproveDocumentTemplateVariant,
  useCreateDocumentTemplateVariant,
  useDeleteDocumentTemplateVariant,
  useDocumentTemplateCatalog,
  useDocumentTemplateRegistry,
  useDocumentTemplateVariant,
  useDocumentTemplateVariants,
  useDuplicateDocumentTemplateVariant,
  useSetActiveDocumentTemplateVariant,
  useSubmitDocumentTemplateVariant,
  useUpdateDocumentTemplateVariant
} from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import type {
  DocumentTemplateLayout,
  DocumentTemplateType,
  TemplateBox,
  TemplateBoxLibraryItem,
  TemplateValidationIssue
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { TemplateCanvas } from "./_components/template-canvas";
import { TemplateInspector } from "./_components/template-inspector";
import { TemplateVariantList } from "./_components/template-variant-list";
import {
  addBoxToLayout,
  clampBoxToPage,
  cloneLayout,
  computeGeometryIssues,
  createNewBoxId,
  removeBoxFromLayout,
  updateBoxInLayout
} from "./_components/template-editor-utils";

function getDefaultVariantName(type: string) {
  return `${type} Draft ${new Date().toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function findBox(layout: DocumentTemplateLayout | null, boxId?: string) {
  if (!layout || !boxId) {
    return undefined;
  }

  return layout.pages.flatMap((page) => page.boxes).find((box) => box.id === boxId);
}

function createBoxFromLibrary(
  item: TemplateBoxLibraryItem,
  layout: DocumentTemplateLayout
): TemplateBox {
  const page = layout.pages[0];
  const offset = page.boxes.length * 6;
  const cloned = cloneLayout({
    version: 1,
    page: layout.page,
    pages: [{ id: "temp", boxes: [item.defaultBox] }]
  }).pages[0].boxes[0];

  return clampBoxToPage(layout, {
    ...cloned,
    id: createNewBoxId(item.type),
    x: cloned.x + offset,
    y: cloned.y + offset
  });
}

export default function DocumentTemplatesPage() {
  const { success, error } = useToast();
  const registryQuery = useDocumentTemplateRegistry();
  const [selectedType, setSelectedType] = useState<DocumentTemplateType | undefined>();
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [draftName, setDraftName] = useState("");
  const [draftLayout, setDraftLayout] = useState<DocumentTemplateLayout | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string>();
  const [previewLanguage, setPreviewLanguage] = useState<"vi" | "viEn">("vi");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [overflowIssues, setOverflowIssues] = useState<TemplateValidationIssue[]>([]);

  const variantsQuery = useDocumentTemplateVariants(selectedType);
  const variantQuery = useDocumentTemplateVariant(selectedVariantId);
  const catalogQuery = useDocumentTemplateCatalog(selectedType);

  const createMutation = useCreateDocumentTemplateVariant();
  const updateMutation = useUpdateDocumentTemplateVariant(selectedVariantId);
  const submitMutation = useSubmitDocumentTemplateVariant(selectedVariantId);
  const approveMutation = useApproveDocumentTemplateVariant(selectedVariantId);
  const setActiveMutation = useSetActiveDocumentTemplateVariant(selectedVariantId);
  const duplicateMutation = useDuplicateDocumentTemplateVariant(selectedVariantId);
  const deleteMutation = useDeleteDocumentTemplateVariant(selectedVariantId);

  useEffect(() => {
    if (selectedType) {
      return;
    }

    const firstEditorType = registryQuery.data?.find((item) => item.editorEnabled)?.type;
    if (firstEditorType) {
      setSelectedType(firstEditorType);
    }
  }, [registryQuery.data, selectedType]);

  useEffect(() => {
    if (!variantsQuery.data) {
      return;
    }

    const stillExists = variantsQuery.data.some((variant) => variant.id === selectedVariantId);
    if (!selectedVariantId || !stillExists) {
      setSelectedVariantId(variantsQuery.data[0]?.id);
    }
  }, [selectedVariantId, variantsQuery.data]);

  const activeVariant = variantQuery.data ?? variantsQuery.data?.find((variant) => variant.id === selectedVariantId);

  useEffect(() => {
    if (!activeVariant) {
      setDraftLayout(null);
      setDraftName("");
      setSelectedBoxId(undefined);
      return;
    }

    setDraftName(activeVariant.name);
    setDraftLayout(cloneLayout(activeVariant.layoutJson));
    setSelectedBoxId(activeVariant.layoutJson.pages[0]?.boxes[0]?.id);
  }, [activeVariant?.id]);

  const selectedBox = useMemo(() => findBox(draftLayout, selectedBoxId), [draftLayout, selectedBoxId]);
  const geometryIssues = useMemo(
    () => (draftLayout ? computeGeometryIssues(draftLayout) : []),
    [draftLayout]
  );
  const allIssues = useMemo(
    () => [...geometryIssues, ...overflowIssues],
    [geometryIssues, overflowIssues]
  );
  const blockingIssues = allIssues.filter((issue) => issue.severity === "error");
  const warningIssues = allIssues.filter((issue) => issue.severity === "warning");

  const isEditable = Boolean(activeVariant && activeVariant.status === "DRAFT" && !activeVariant.isActive);
  const isDirty = useMemo(() => {
    if (!activeVariant || !draftLayout) {
      return false;
    }

    return (
      draftName !== activeVariant.name ||
      JSON.stringify(draftLayout) !== JSON.stringify(activeVariant.layoutJson)
    );
  }, [activeVariant, draftLayout, draftName]);

  const handleCreateVariant = async () => {
    if (!selectedType) {
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        type: selectedType,
        name: getDefaultVariantName(selectedType)
      });
      setSelectedVariantId(created.id);
      success("Đã tạo draft variant mới");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể tạo draft variant."));
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedVariantId || !draftLayout) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        name: draftName,
        layoutJson: draftLayout
      });
      success("Đã lưu draft template");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể lưu draft template."));
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedVariantId || !draftLayout) {
      return;
    }

    try {
      if (isDirty) {
        await updateMutation.mutateAsync({
          name: draftName,
          layoutJson: draftLayout
        });
      }
      await submitMutation.mutateAsync();
      success("Đã gửi variant sang trạng thái chờ duyệt");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể gửi variant sang chờ duyệt."));
    }
  };

  const handleApprove = async () => {
    if (blockingIssues.length > 0) {
      error("Template vẫn còn lỗi layout hoặc overflow. Hãy sửa trước khi publish.");
      return;
    }

    try {
      await approveMutation.mutateAsync();
      success("Đã publish variant");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể publish variant."));
    }
  };

  const handleSetActive = async () => {
    try {
      await setActiveMutation.mutateAsync();
      success("Đã đặt variant làm active");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể đặt variant làm active."));
    }
  };

  const handleDuplicate = async () => {
    try {
      const duplicated = await duplicateMutation.mutateAsync({
        name: activeVariant ? `${activeVariant.name} copy` : undefined
      });
      setSelectedVariantId(duplicated.id);
      success("Đã tạo bản sao draft");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể duplicate variant."));
    }
  };

  const handleDelete = async () => {
    if (!selectedVariantId) {
      return;
    }

    if (!window.confirm("Xóa draft variant này? Hành động này không thể hoàn tác.")) {
      return;
    }

    try {
      await deleteMutation.mutateAsync();
      setSelectedVariantId(undefined);
      success("Đã xóa variant");
    } catch (mutationError) {
      error(getApiErrorMessage(mutationError, "Không thể xóa variant."));
    }
  };

  const handleUpdateSelectedBox = (updater: (box: TemplateBox) => TemplateBox) => {
    if (!draftLayout || !selectedBoxId) {
      return;
    }

    setDraftLayout((current) => {
      if (!current) {
        return current;
      }

      return updateBoxInLayout(current, selectedBoxId, (box) =>
        clampBoxToPage(current, updater(box))
      );
    });
  };

  const handleDeleteSelectedBox = () => {
    if (!draftLayout || !selectedBoxId) {
      return;
    }

    if (!window.confirm(`Xóa box "${selectedBoxId}" khỏi bản nháp hiện tại?`)) {
      return;
    }

    setDraftLayout(removeBoxFromLayout(draftLayout, selectedBoxId));
    setSelectedBoxId(draftLayout.pages[0]?.boxes.find((box) => box.id !== selectedBoxId)?.id);
  };

  const handleAddBox = (item: TemplateBoxLibraryItem) => {
    if (!draftLayout) {
      return;
    }

    const nextBox = createBoxFromLibrary(item, draftLayout);
    setDraftLayout(addBoxToLayout(draftLayout, nextBox));
    setSelectedBoxId(nextBox.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trình biên tập mẫu tài liệu"
        description="Thiết kế và quản lý variant template theo bố cục A4. Canvas là khu vực làm việc chính, hai panel hai bên chỉ giữ lại những công cụ cần thiết."
        action={
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
            Về quản trị
          </Link>
        }
      />

      {registryQuery.isLoading ? (
        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <LoadingSkeleton className="h-[720px] w-full" />
          <LoadingSkeleton className="h-[720px] w-full" />
          <LoadingSkeleton className="h-[720px] w-full" />
        </div>
      ) : null}

      {!registryQuery.isLoading && !registryQuery.data?.length ? (
        <EmptyState
          title="Không nạp được template registry"
          description="Backend chưa trả về registry của documents module."
        />
      ) : null}

      {!registryQuery.isLoading && registryQuery.data?.length ? (
        <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="xl:sticky xl:top-24">
            <TemplateVariantList
              registry={registryQuery.data}
              selectedType={selectedType}
              variants={variantsQuery.data ?? []}
              selectedVariantId={selectedVariantId}
              onSelectType={(type) => {
                setSelectedType(type);
                setSelectedVariantId(undefined);
              }}
              onSelectVariant={setSelectedVariantId}
              onCreateVariant={handleCreateVariant}
            />
          </aside>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <div className="space-y-5 p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <h2 className="text-xl font-bold text-text-primary">
                      {activeVariant?.name ?? "Chọn một variant để mở editor"}
                    </h2>
                    <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                      Canvas A4 là vùng làm việc trung tâm. Chọn loại tài liệu ở cột trái, tinh chỉnh box ở cột phải, và dùng thanh điều khiển bên dưới để lưu hoặc đưa variant sang quy trình duyệt.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {activeVariant ? (
                        <Badge variant={activeVariant.isActive ? "success" : "info"}>
                          {activeVariant.isActive ? "Đang dùng" : activeVariant.status}
                        </Badge>
                      ) : null}
                      {selectedType ? (
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
                          Loại: {selectedType}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                          isDirty
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {isDirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ với draft"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                          blockingIssues.length > 0
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : warningIssues.length > 0
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-white text-text-secondary"
                        )}
                      >
                        {blockingIssues.length > 0
                          ? `${blockingIssues.length} lỗi chặn publish`
                          : warningIssues.length > 0
                            ? `${warningIssues.length} cảnh báo`
                            : "Không có lỗi layout"}
                      </span>
                    </div>
                  </div>

                  {activeVariant ? (
                    <div className="space-y-2 xl:min-w-[220px]">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                        Chế độ xem trước
                      </p>
                      <Tabs
                        value={previewLanguage}
                        onValueChange={(value) => setPreviewLanguage(value as "vi" | "viEn")}
                      >
                        <TabsList className="h-11 rounded-xl bg-slate-100/80">
                          <TabsTrigger value="vi">VI</TabsTrigger>
                          <TabsTrigger value="viEn">VI-EN</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  ) : (
                    <Tabs
                      value={previewLanguage}
                      onValueChange={(value) => setPreviewLanguage(value as "vi" | "viEn")}
                    >
                      <TabsList className="h-11 rounded-xl bg-slate-100/80">
                        <TabsTrigger value="vi">VI</TabsTrigger>
                        <TabsTrigger value="viEn">VI-EN</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                </div>

                {activeVariant ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                          Tên variant
                        </Label>
                        <Input
                          value={draftName}
                          disabled={!isEditable}
                          onChange={(event) => setDraftName(event.target.value)}
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                            Box đang chọn
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">
                            {selectedBoxId ?? "Chưa chọn box"}
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {selectedBoxId
                              ? "Bạn có thể kéo thả trên canvas hoặc chỉnh sâu ở inspector."
                              : "Chọn một box trên canvas để chỉnh vị trí và nội dung."}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                            Trạng thái chỉnh sửa
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">
                            {isEditable ? "Draft có thể chỉnh sửa" : "Variant đang khóa chỉnh sửa"}
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {isEditable
                              ? "Lưu draft trước khi gửi duyệt hoặc publish."
                              : "Chỉ draft chưa active mới có thể chỉnh trực tiếp."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 xl:w-[320px]">
                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                          Công cụ bản nháp
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveDraft}
                            disabled={!isEditable || !isDirty}
                          >
                            Lưu draft
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsPreviewOpen(true)}
                            disabled={!activeVariant || !draftLayout}
                          >
                            Xem trước
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleDeleteSelectedBox}
                            disabled={!isEditable || !selectedBoxId}
                          >
                            Xóa box
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleDuplicate}
                            disabled={!activeVariant}
                          >
                            Nhân bản
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleDelete}
                            disabled={!isEditable}
                          >
                            Xóa draft
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                          Quy trình phê duyệt
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSubmitReview}
                            disabled={!isEditable}
                          >
                            Gửi duyệt
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSetActive}
                            disabled={!activeVariant || activeVariant.status !== "PUBLISHED" || activeVariant.isActive}
                          >
                            Đặt làm bản dùng
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleApprove}
                            disabled={!activeVariant || activeVariant.status !== "PENDING_APPROVAL" || blockingIssues.length > 0}
                          >
                            Duyệt & publish
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    allIssues.length > 0
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                  )}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          allIssues.length > 0 ? "text-amber-700" : "text-emerald-700"
                        )}
                      >
                        {allIssues.length > 0
                          ? `Validation issues (${allIssues.length})`
                          : "Canvas hiện không có lỗi layout"}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-sm",
                          allIssues.length > 0 ? "text-amber-700" : "text-emerald-700"
                        )}
                      >
                        {allIssues.length > 0
                          ? "Sửa các lỗi chồng lấn, tràn nội dung hoặc vượt vùng in trước khi publish."
                          : "Bạn có thể tiếp tục căn chỉnh, lưu draft hoặc đưa variant sang bước duyệt."}
                      </p>
                    </div>

                    {allIssues.length > 0 ? (
                      <ul className="max-w-xl space-y-1 text-sm text-amber-700">
                        {allIssues.slice(0, 4).map((issue, index) => (
                          <li key={`${issue.code}-${issue.boxId}-${index}`}>{issue.message}</li>
                        ))}
                        {allIssues.length > 4 ? (
                          <li>... và thêm {allIssues.length - 4} vấn đề khác</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {!activeVariant || !draftLayout || !catalogQuery.data ? (
              <EmptyState
                title="Chọn một variant"
                description="Khi chọn variant, canvas A4 và inspector sẽ hiện ra để bạn sắp xếp box."
              />
            ) : (
              <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <div className="flex flex-col gap-2 border-b border-slate-200/70 px-6 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">Canvas thiết kế</h3>
                    <p className="text-sm text-text-secondary">
                      Kéo thả box trực tiếp trên mặt giấy A4. Vùng khung nét đứt là giới hạn in an toàn.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-text-secondary">
                      Grid: {draftLayout.page.gridMm}mm
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-text-secondary">
                      Box: {draftLayout.pages[0]?.boxes.length ?? 0}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-text-secondary">
                      Ngôn ngữ: {previewLanguage === "vi" ? "VI" : "VI-EN"}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-100/70 p-5">
                  <TemplateCanvas
                    layout={draftLayout}
                    sampleData={catalogQuery.data.sampleData}
                    previewLanguage={previewLanguage}
                    selectedBoxId={selectedBoxId}
                    editable={isEditable}
                    onSelectBox={setSelectedBoxId}
                    onLayoutChange={setDraftLayout}
                    onOverflowIssuesChange={setOverflowIssues}
                  />
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Inspector nhanh
              </p>
              <p className="mt-2 text-sm font-semibold text-text-primary">
                {selectedBox ? selectedBox.id : "Chưa chọn box"}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {selectedBox
                  ? "Chỉnh nội dung, vị trí và style ở các nhóm bên dưới."
                  : "Chọn một box trên canvas để mở đúng nhóm thiết lập."}
              </p>
            </section>

            <TemplateInspector
              selectedBox={selectedBox}
              editable={isEditable}
              boxLibrary={catalogQuery.data?.boxLibrary ?? []}
              tokenGroups={catalogQuery.data?.tokenGroups ?? []}
              issues={allIssues}
              onUpdateBox={handleUpdateSelectedBox}
              onDeleteBox={handleDeleteSelectedBox}
              onAddBox={handleAddBox}
            />
          </aside>
        </div>
      ) : null}

      {isPreviewOpen && draftLayout && catalogQuery.data ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-4 border-b border-border/70 px-6 py-4">
              <div>
                <p className="text-lg font-bold text-text-primary">
                  Xem trước template
                </p>
                <p className="text-sm text-text-secondary">
                  Bản xem sạch của {draftName || activeVariant?.name || "template hiện tại"} ở chế độ{" "}
                  {previewLanguage === "vi" ? "Tiếng Việt" : "Song ngữ VI-EN"}.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  In thử
                </Button>
                <Button type="button" variant="ghost" onClick={() => setIsPreviewOpen(false)}>
                  Đóng
                </Button>
              </div>
            </div>

            <div className="overflow-auto bg-slate-100/80 p-6">
              <TemplateCanvas
                layout={draftLayout}
                sampleData={catalogQuery.data.sampleData}
                previewLanguage={previewLanguage}
                selectedBoxId={undefined}
                editable={false}
                presentationMode
                onSelectBox={() => {}}
                onLayoutChange={() => {}}
                onOverflowIssuesChange={() => {}}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
