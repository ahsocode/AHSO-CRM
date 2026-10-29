"use client";

import { useEffect, useRef, useState } from "react";
import { DateInput, FormDialog, FormField, NumberInput, SelectField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentSourceContracts, useDocumentSourceData, useSaveDocumentSourceData } from "@/hooks/use-documents";
import { toast } from "@/hooks/use-toast";
import { getDocumentErrorMessage, getDocumentFieldErrors } from "./document-errors";
import { DOCUMENT_SOURCE_FORMS, sourceDateFromISO, sourceDateToISO, type SourceDocumentType } from "./document-source-fields";

type Values = Record<string, string | number | boolean | undefined>;
type Row = { key: number; values: Values };

export function DocumentSourceDialog({projectId, type, entityId, label, onClose}: {
  projectId: string;
  type: SourceDocumentType;
  entityId: string;
  label: string;
  onClose: () => void;
}) {
  const config = DOCUMENT_SOURCE_FORMS[type];
  const source = useDocumentSourceData(type, entityId, true);
  const contracts = useDocumentSourceContracts(entityId, type === "AR_RECONCILIATION");
  const save = useSaveDocumentSourceData(projectId);
  const nextKey = useRef(1);
  const [values, setValues] = useState<Values>({});
  const [rows, setRows] = useState<Row[]>([{key:0, values:{}}]);
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized || !source.isSuccess || source.isFetching) return;
    const data = source.data;
    const existingRows = data[config.rowsKey];
    setRows(Array.isArray(existingRows) && existingRows.length
      ? existingRows.map((item, index) => ({key:index, values:item as Values}))
      : [{key:0, values:{}}]);
    nextKey.current = Array.isArray(existingRows) && existingRows.length ? existingRows.length : 1;
    setValues({
      ...(config.date ? {[config.date.key]:sourceDateFromISO(data[config.date.key])} : {}),
      ...(config.text ? {[config.text.key]:typeof data[config.text.key] === "string" ? data[config.text.key] as string : ""} : {}),
      ...(config.confirmation ? {[config.confirmation.key]:data[config.confirmation.key] === config.confirmation.value} : {})
    });
    setInitialized(true);
  }, [source.isSuccess, source.isFetching, source.data, initialized, config]);

  const change = (key: string, value: Values[string]) => {
    setValues(previous => ({...previous, [key]:value}));
    setDirty(true);
  };
  const changeRow = (index: number, key: string, value: Values[string]) => {
    setRows(previous => previous.map((row, rowIndex) => rowIndex === index ? {...row, values:{...row.values, [key]:value}} : row));
    setDirty(true);
  };
  return <FormDialog open onOpenChange={open => { if (!open) onClose(); }} title="Nhập dữ liệu thực tế"
    description={`${label}. Chỉ ghi nhận nội dung đã có bằng chứng thực tế. Lưu sẽ cập nhật dữ liệu nguồn của loại tài liệu này.`}
    size="lg" isDirty={dirty} isSubmitting={save.isPending || source.isPending} submitLabel="Lưu dữ liệu" submittingLabel={save.isPending ? "Đang lưu…" : "Đang tải…"}
    error={formError ?? (source.isError ? getDocumentErrorMessage(source.error) : null)}
    onSubmit={async event => {
      event.preventDefault();
      if (!initialized) { setFormError("Cần tải xong dữ liệu nguồn trước khi lưu."); return; }
      setErrors({}); setFormError(null);
      const data: Record<string, unknown> = {
        [config.rowsKey]: rows.map(row => Object.fromEntries(config.rowFields.map(field => [field.key, row.values[field.key] ?? (field.control === "number" ? undefined : "")]))),
        ...(config.date ? {[config.date.key]:sourceDateToISO(String(values[config.date.key] ?? ""))} : {}),
        ...(config.text ? {[config.text.key]:values[config.text.key] ?? ""} : {}),
        ...(config.confirmation ? {[config.confirmation.key]:values[config.confirmation.key] ? config.confirmation.value : false} : {})
      };
      try {
        await save.mutateAsync({type, entityId, data});
        toast({title:"Đã lưu dữ liệu thực tế", description:label});
        onClose();
      } catch (error) {
        setErrors(getDocumentFieldErrors(error));
        setFormError(getDocumentErrorMessage(error));
      }
    }}>
    {source.isPending ? <p role="status">Đang tải dữ liệu đã ghi nhận…</p> : null}
    {source.isError ? <Button type="button" variant="outline" onClick={() => source.refetch()}>Tải lại dữ liệu</Button> : null}
    {initialized ? <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
      <legend className="sr-only">Dữ liệu thực tế của {label}</legend>
      {config.date ? <FormField required label={config.date.label} error={errors[config.date.key]}>
        <DateInput value={String(values[config.date.key] ?? "")} onChange={value => change(config.date!.key, value)} />
      </FormField> : null}
      {config.text ? <FormField required label={config.text.label} error={errors[config.text.key]}>
        <Input value={String(values[config.text.key] ?? "")} onChange={event => change(config.text!.key, event.target.value)} />
      </FormField> : null}
      <div className="space-y-3">
        <h4 className="font-semibold text-text-primary">{config.rowsLabel}</h4>
        {errors[config.rowsKey] ? <p role="alert" className="text-sm text-danger">{errors[config.rowsKey]}</p> : null}
        {contracts.isError && type === "AR_RECONCILIATION" ? <p role="alert" className="text-sm text-danger">{getDocumentErrorMessage(contracts.error)}</p> : null}
        {rows.map((row, index) => <fieldset key={row.key} className="min-w-0 space-y-3 rounded-xl bg-bg-subtle p-3">
          <legend className="px-1 text-sm font-medium">Dòng {index + 1}</legend>
          {config.rowFields.map(field => {
            const path = `${config.rowsKey}.${index}.${field.key}`;
            const value = row.values[field.key];
            return <FormField key={field.key} label={field.label} required={!field.optional} error={errors[path]}>
              {props => field.control === "number"
                ? <NumberInput {...props} value={typeof value === "number" ? value : undefined} onChange={next => changeRow(index, field.key, next)} />
                : field.control === "select" || field.control === "contracts"
                  ? <SelectField {...props} value={typeof value === "string" ? value : ""} loading={field.control === "contracts" && contracts.isPending}
                    options={field.control === "contracts" ? (contracts.data ?? []).map(contract => ({value:contract.id, label:contract.contractNo})) : (field.options ?? []).map(option => ({value:option, label:option}))}
                    onValueChange={next => changeRow(index, field.key, next)} />
                  : <Textarea {...props} rows={field.key === "content" ? 3 : 2} value={typeof value === "string" ? value : ""} onChange={event => changeRow(index, field.key, event.target.value)} />}
            </FormField>;
          })}
          <Button type="button" variant="ghost" aria-label={`Xóa dòng ${index + 1}`} onClick={() => {
            setRows(previous => previous.filter(item => item.key !== row.key)); setErrors({}); setDirty(true);
          }}>Xóa dòng</Button>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={rows.length >= 200} onClick={() => {
          setRows(previous => [...previous, {key:nextKey.current++, values:{}}]); setDirty(true);
        }}>Thêm dòng</Button>
      </div>
      {config.confirmation ? <FormField required label={config.confirmation.label} error={errors[config.confirmation.key]}>
        <input type="checkbox" checked={Boolean(values[config.confirmation.key])} onChange={event => change(config.confirmation!.key, event.target.checked)} className="h-5 w-5 accent-primary" />
      </FormField> : null}
    </fieldset> : null}
  </FormDialog>;
}
