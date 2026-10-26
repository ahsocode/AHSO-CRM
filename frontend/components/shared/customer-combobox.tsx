"use client";

import { forwardRef, useMemo, useState } from "react";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import { EntityCombobox, type EntityComboboxProps } from "./entity-combobox";

type Props = Omit<EntityComboboxProps, "options" | "selectedOption" | "onSearchChange" | "isLoading" | "selectedLoading" | "errorMessage" | "selectedErrorMessage">;

export const CustomerCombobox = forwardRef<HTMLInputElement, Props>(function CustomerCombobox(props, ref) {
  const [search, setSearch] = useState("");
  const customers = useCustomers({ page: 1, limit: 20, search: search || undefined });
  const detail = useCustomer(props.value ?? "");
  const options = useMemo(() => (customers.data?.items ?? []).map((customer) => ({ id: customer.id, label: customer.name, description: customer.taxCode })), [customers.data]);
  const selected = detail.data ? { id: detail.data.id, label: detail.data.name, description: detail.data.taxCode } : null;
  return <EntityCombobox {...props} ref={ref} clearLabel={props.clearLabel ?? "Xóa khách hàng đã chọn"} options={options} selectedOption={selected} onSearchChange={setSearch} isLoading={customers.isFetching} selectedLoading={detail.isLoading} errorMessage={customers.isError ? getApiErrorMessage(customers.error, "Không thể tải khách hàng.") : null} selectedErrorMessage={detail.isError ? getApiErrorMessage(detail.error, "Không thể tải khách hàng đã chọn.") : null} />;
});
