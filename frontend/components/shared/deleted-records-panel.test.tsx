import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeletedRecordsPanel, type DeletedRecordBase } from "./deleted-records-panel";

interface DeletedCustomer extends DeletedRecordBase {
  name: string;
  industry?: string;
  assignedTo?: {
    name: string;
  };
}

let currentRoot: Root | null = null;
let currentContainer: HTMLDivElement | null = null;

function renderPanel(props: Partial<ComponentProps<typeof DeletedRecordsPanel<DeletedCustomer>>> = {}) {
  currentContainer = document.createElement("div");
  document.body.appendChild(currentContainer);
  currentRoot = createRoot(currentContainer);

  act(() => {
    currentRoot?.render(
      <DeletedRecordsPanel<DeletedCustomer>
        title="Khách hàng đã xóa mềm"
        description="Khôi phục để đưa khách hàng trở lại danh sách vận hành."
        emptyTitle="Thùng rác khách hàng đang trống"
        emptyDescription="Không có bản ghi đã xóa."
        items={[]}
        isLoading={false}
        isError={false}
        onRestore={vi.fn()}
        getTitle={(record) => record.name}
        getSubtitle={(record) => record.industry}
        getMeta={(record) => (record.assignedTo ? `Phụ trách: ${record.assignedTo.name}` : null)}
        {...props}
      />
    );
  });

  return currentContainer;
}

function buttonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((element) =>
    element.textContent?.includes(text)
  );

  if (!button) {
    throw new Error(`Không tìm thấy button "${text}"`);
  }

  return button as HTMLButtonElement;
}

afterEach(() => {
  if (currentRoot) {
    act(() => {
      currentRoot?.unmount();
    });
  }
  currentRoot = null;
  currentContainer?.remove();
  currentContainer = null;
});

describe("DeletedRecordsPanel", () => {
  it("renders an empty state when there are no deleted records", () => {
    const container = renderPanel();

    expect(container.textContent).toContain("Khách hàng đã xóa mềm");
    expect(container.textContent).toContain("0 bản ghi");
    expect(container.textContent).toContain("Thùng rác khách hàng đang trống");
    expect(container.textContent).toContain("Không có bản ghi đã xóa.");
  });

  it("renders deleted records and wires restore plus pagination actions", () => {
    const onRestore = vi.fn();
    const onPageChange = vi.fn();
    const container = renderPanel({
      items: [
        {
          id: "customer-1",
          name: "AHSO Deleted Customer",
          industry: "Automation",
          assignedTo: {
            name: "Nguyễn Minh Quân"
          },
          deletedAt: "2026-04-20T03:00:00.000Z"
        }
      ],
      page: 2,
      totalPages: 3,
      total: 9,
      onRestore,
      onPageChange
    });

    expect(container.textContent).toContain("9 bản ghi");
    expect(container.textContent).toContain("AHSO Deleted Customer");
    expect(container.textContent).toContain("Đã xóa mềm");
    expect(container.textContent).toContain("Automation");
    expect(container.textContent).toContain("Phụ trách: Nguyễn Minh Quân");
    expect(container.textContent).toContain("Trang 2/3");

    act(() => {
      buttonByText(container, "Khôi phục").click();
      buttonByText(container, "Trang trước").click();
      buttonByText(container, "Trang sau").click();
    });

    expect(onRestore).toHaveBeenCalledWith("customer-1");
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("shows an error message and disables restore while a restore is pending", () => {
    const errorContainer = renderPanel({
      isError: true,
      errorMessage: "Không thể tải danh sách đã xóa."
    });

    expect(errorContainer.textContent).toContain("Không thể tải danh sách đã xóa.");

    act(() => {
      currentRoot?.unmount();
    });
    currentRoot = null;
    currentContainer?.remove();
    currentContainer = null;

    const pendingContainer = renderPanel({
      isRestoring: true,
      items: [
        {
          id: "customer-2",
          name: "Pending Customer"
        }
      ]
    });

    expect(buttonByText(pendingContainer, "Khôi phục").disabled).toBe(true);
  });
});
