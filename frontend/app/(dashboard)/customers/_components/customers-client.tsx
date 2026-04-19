"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuthStore } from "@/hooks/use-auth";
import { useBulkCustomers, useCreateCustomer, useCustomers } from "@/hooks/use-customers";
import { useUsers } from "@/hooks/use-users";
import { useToast } from "@/hooks/use-toast";
import { isLeadershipRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CustomerStatus, CustomerUpsertInput } from "@/lib/types";
import { CsvImportDialog, CsvColumnSpec } from "@/components/shared/csv-import-dialog";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { downloadExcelRows } from "@/lib/utils";
import { CustomerFilters, type VipFilterValue } from "./customer-filters";
import { CustomerOverviewCards } from "./customer-overview-cards";
import { CustomerTable } from "./customer-table";

const PAGE_SIZE = 8;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Đã xảy ra lỗi khi tải dữ liệu khách hàng.";
}

const CUSTOMER_STATUS_MAP: Record<string, CustomerStatus> = {
  lead: "LEAD",
  prospect: "PROSPECT",
  active: "ACTIVE",
  inactive: "INACTIVE",
  "tiềm năng": "LEAD",
  "đang làm việc": "ACTIVE",
  "ngưng": "INACTIVE"
};

const parseBoolean = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return ["true", "1", "yes", "y", "vip", "x", "có", "co"].includes(normalized);
};

export function CustomersClient() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CustomerStatus | "">("");
  const [industry, setIndustry] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [vipFilter, setVipFilter] = useState<VipFilterValue>("all");
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"assign" | "delete">("assign");
  const [bulkAssignedToId, setBulkAssignedToId] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const normalizedIndustry = industry.trim();
  const createCustomer = useCreateCustomer();
  const bulkCustomers = useBulkCustomers();
  const queryClient = useQueryClient();
  const { error: showError, success } = useToast();

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, status, normalizedIndustry, assignedToId, vipFilter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, deferredSearch, status, normalizedIndustry, assignedToId, vipFilter]);

  const canManageUsers = isLeadershipRole(user?.role);
  const usersQuery = useUsers(canManageUsers);
  const customersQuery = useCustomers({
    page,
    limit: PAGE_SIZE,
    search: deferredSearch || undefined,
    status: status || undefined,
    industry: normalizedIndustry || undefined,
    assignedToId: assignedToId || undefined,
    isVip: vipFilter === "all" ? undefined : vipFilter === "vip"
  });

  const canReset =
    search.length > 0 ||
    status.length > 0 ||
    normalizedIndustry.length > 0 ||
    assignedToId.length > 0 ||
    vipFilter !== "all";

  const assigneeList = usersQuery.data ?? [];
  const visibleIds = customersQuery.data?.items.map((customer) => customer.id) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const findAssigneeIdByEmail = (email: string): string | undefined => {
    const needle = email.trim().toLowerCase();
    if (!needle) return undefined;
    return assigneeList.find((u) => u.email?.toLowerCase() === needle)?.id;
  };

  const importColumns: CsvColumnSpec<CustomerUpsertInput>[] = [
    {
      header: "Tên khách hàng *",
      key: "name",
      required: true,
      example: "Công ty Vinamilk",
      transform: (value) => {
        if (!value) throw new Error("Thiếu tên khách hàng");
        return value;
      }
    },
    { header: "Tên viết tắt", key: "shortName", example: "VNM", transform: (v) => v || undefined },
    { header: "Mã số thuế", key: "taxCode", example: "0300588569", transform: (v) => v || undefined },
    { header: "Ngành", key: "industry", example: "FMCG", transform: (v) => v || undefined },
    { header: "Địa chỉ", key: "address", example: "10 Tân Trào, Q.7, TP.HCM", transform: (v) => v || undefined },
    { header: "Website", key: "website", example: "https://vinamilk.com.vn", transform: (v) => v || undefined },
    { header: "Điện thoại", key: "phone", example: "02854 155 555", transform: (v) => v || undefined },
    { header: "Email", key: "email", example: "contact@vinamilk.com.vn", transform: (v) => v || undefined },
    { header: "Nguồn", key: "source", example: "Hội chợ VIFA", transform: (v) => v || undefined },
    {
      header: "Trạng thái",
      key: "status",
      example: "LEAD",
      transform: (v) => {
        if (!v) return "LEAD" as CustomerStatus;
        const normalized = v.trim().toLowerCase();
        const mapped = CUSTOMER_STATUS_MAP[normalized] ?? (v.trim().toUpperCase() as CustomerStatus);
        if (!["LEAD", "PROSPECT", "ACTIVE", "INACTIVE"].includes(mapped)) {
          throw new Error(`Trạng thái "${v}" không hợp lệ (LEAD/PROSPECT/ACTIVE/INACTIVE)`);
        }
        return mapped;
      }
    },
    {
      header: "VIP",
      key: "isVip",
      example: "false",
      transform: (v) => parseBoolean(v)
    },
    {
      header: "Email người phụ trách *",
      key: "assignedToId",
      required: true,
      example: user?.email ?? "admin@ahso.vn",
      transform: (v) => {
        const trimmed = v.trim();
        if (!trimmed) {
          if (user?.id) return user.id;
          throw new Error("Thiếu email người phụ trách");
        }
        const found = findAssigneeIdByEmail(trimmed);
        if (!found) {
          throw new Error(`Không tìm thấy user với email "${trimmed}"`);
        }
        return found;
      }
    },
    { header: "Ghi chú", key: "notes", example: "Khách đã ký NDA", transform: (v) => v || undefined }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Danh mục khách hàng"
        description="Không gian theo dõi lead, prospect và khách hàng đang vận hành. Giao diện này bám layout AHSO để khóa pattern cho module tuần 2."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/customers/new" className={cn(buttonVariants({ variant: "primary" }))}>
              <AppIcon name="plus" className="h-4 w-4" />
              Thêm khách hàng
            </Link>
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Về dashboard
            </Link>
          </div>
        }
      />

      <CsvImportDialog<CustomerUpsertInput>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import danh sách khách hàng từ CSV"
        description="Tải file mẫu, điền dữ liệu theo cột, rồi upload để nhập hàng loạt."
        templateFilename="khach-hang-mau.csv"
        columns={importColumns}
        submitRow={async (input) => {
          const result = await createCustomer.mutateAsync(input);
          return { displayName: input.name + (result?.id ? ` (ID: ${result.id.slice(0, 6)}…)` : "") };
        }}
        onFinish={() => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      />

      <CustomerOverviewCards meta={customersQuery.data?.meta} isLoading={customersQuery.isLoading} />

      <CustomerFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        industry={industry}
        onIndustryChange={setIndustry}
        assignedToId={assignedToId}
        onAssignedToIdChange={setAssignedToId}
        vipFilter={vipFilter}
        onVipFilterChange={setVipFilter}
        onReset={() => {
          setSearch("");
          setStatus("");
          setIndustry("");
          setAssignedToId("");
          setVipFilter("all");
          setPage(1);
        }}
        canReset={canReset}
        users={usersQuery.data ?? []}
        usersUnavailable={!canManageUsers || usersQuery.isError}
      />

      {selectedIds.length > 0 ? (
        <BulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
          {canManageUsers ? (
            <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "assign" | "delete")}>
              <option value="assign">Chuyển người phụ trách</option>
              <option value="delete">Xóa mềm</option>
            </Select>
          ) : (
            <Select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "assign" | "delete")}>
              <option value="delete">Xóa mềm</option>
            </Select>
          )}

          {bulkAction === "assign" && canManageUsers ? (
            <Select value={bulkAssignedToId} onChange={(event) => setBulkAssignedToId(event.target.value)}>
              <option value="">Chọn người phụ trách</option>
              {assigneeList.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          ) : null}

          <Button
            type="button"
            variant="outline"
            disabled={bulkCustomers.isPending}
            onClick={() => {
              if (bulkAction === "assign" && !bulkAssignedToId) {
                showError("Chọn người phụ trách trước khi áp dụng.");
                return;
              }

              if (bulkAction === "delete" && !window.confirm(`Xóa mềm ${selectedIds.length} khách hàng đã chọn?`)) {
                return;
              }

              bulkCustomers.mutate(
                {
                  action: bulkAction,
                  ids: selectedIds,
                  assignedToId: bulkAction === "assign" ? bulkAssignedToId : undefined
                },
                {
                  onSuccess: () => {
                    setSelectedIds([]);
                    success(`Đã xử lý ${selectedIds.length} khách hàng.`);
                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể thực hiện bulk action.");
                  }
                }
              );
            }}
          >
            Áp dụng
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={bulkCustomers.isPending}
            onClick={() => {
              bulkCustomers.mutate(
                {
                  action: "export",
                  ids: selectedIds
                },
                {
                  onSuccess: async (data) => {
                    const items = data.items ?? [];
                    if (!items.length) {
                      showError("Không có dữ liệu để export.");
                      return;
                    }
                    const csv = buildCsv(Object.keys(items[0]), items);
                    downloadCsv("customers-selected.csv", csv);
                    await downloadExcelRows("customers-selected.xlsx", items);
                    success("Đã xuất danh sách khách hàng đã chọn.");
                  },
                  onError: (error) => {
                    showError(error instanceof Error ? error.message : "Không thể export dữ liệu.");
                  }
                }
              );
            }}
          >
            Export CSV + Excel
          </Button>
        </BulkActionsBar>
      ) : null}

      <CustomerTable
        allVisibleSelected={allVisibleSelected}
        items={customersQuery.data?.items ?? []}
        meta={customersQuery.data?.meta}
        isLoading={customersQuery.isLoading}
        isError={customersQuery.isError}
        errorMessage={getErrorMessage(customersQuery.error)}
        onPageChange={setPage}
        onToggleSelect={(id) =>
          setSelectedIds((current) =>
            current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
          )
        }
        onToggleSelectAll={() =>
          setSelectedIds((current) =>
            allVisibleSelected
              ? current.filter((id) => !visibleIds.includes(id))
              : [...new Set([...current, ...visibleIds])]
          )
        }
        selectedIds={selectedIds}
      />
    </div>
  );
}
