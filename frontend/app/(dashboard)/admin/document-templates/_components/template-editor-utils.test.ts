import { describe, expect, it, vi } from "vitest";
import type { DocumentTemplateLayout, TemplateBox } from "@/lib/types";
import {
  addBoxToLayout,
  clampBoxToPage,
  computeGeometryIssues,
  getValueByPath,
  interpolateTemplateString,
  removeBoxFromLayout,
  snapToGrid,
  updateBoxInLayout
} from "./template-editor-utils";

const baseLayout: DocumentTemplateLayout = {
  version: 1,
  page: {
    widthMm: 210,
    heightMm: 297,
    gridMm: 5,
    marginMm: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10
    }
  },
  pages: [
    {
      id: "page-1",
      boxes: []
    }
  ]
};

function textBox(overrides: Partial<TemplateBox> = {}): TemplateBox {
  return {
    id: "box-1",
    type: "text",
    page: 0,
    x: 10,
    y: 10,
    width: 40,
    height: 20,
    zIndex: 1,
    content: {
      text: {
        vi: "Xin chào"
      }
    },
    ...overrides
  } as TemplateBox;
}

describe("template editor utilities", () => {
  it("resolves nested values and array indexes for dynamic tokens", () => {
    const context = {
      quote: {
        items: [
          {
            name: "Tủ điện"
          }
        ]
      }
    };

    expect(getValueByPath(context, "quote.items.0.name")).toBe("Tủ điện");
    expect(getValueByPath(context, "quote.items.name")).toBeUndefined();
  });

  it("interpolates filters used by document template preview", () => {
    vi.setSystemTime(new Date("2026-04-25T00:00:00+07:00"));

    expect(
      interpolateTemplateString("{{customer.name|upper}} - {{quote.total|currency}} - {{quote.date|date}}", {
        customer: {
          name: "ahso"
        },
        quote: {
          total: 12500000,
          date: "2026-04-25T00:00:00.000Z"
        }
      })
    ).toBe("AHSO - 12.500.000 - 25/04/2026");

    vi.useRealTimers();
  });

  it("snaps and clamps boxes inside the printable A4 area", () => {
    expect(snapToGrid(12, 5)).toBe(10);
    expect(snapToGrid(13, 5)).toBe(15);

    expect(
      clampBoxToPage(baseLayout, textBox({ x: -10, y: 500, width: 60, height: 30 }))
    ).toMatchObject({
      x: 10,
      y: 257
    });
  });

  it("adds, updates and removes boxes without mutating unrelated pages", () => {
    const added = addBoxToLayout(baseLayout, textBox());
    expect(added.pages[0].boxes).toHaveLength(1);
    expect(baseLayout.pages[0].boxes).toHaveLength(0);

    const updated = updateBoxInLayout(added, "box-1", (box) => ({
      ...box,
      x: 25
    }));
    expect(updated.pages[0].boxes[0]).toMatchObject({ x: 25 });

    const removed = removeBoxFromLayout(updated, "box-1");
    expect(removed.pages[0].boxes).toHaveLength(0);
  });

  it("reports out-of-bounds and overlap validation issues", () => {
    const layout: DocumentTemplateLayout = {
      ...baseLayout,
      pages: [
        {
          id: "page-1",
          boxes: [
            textBox({ id: "left", x: 10, y: 10, width: 50, height: 20 }),
            textBox({ id: "right", x: 40, y: 20, width: 50, height: 20 }),
            textBox({ id: "outside", x: 205, y: 10, width: 20, height: 20 })
          ]
        }
      ]
    };

    expect(computeGeometryIssues(layout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          boxId: "outside",
          code: "out_of_bounds"
        }),
        expect.objectContaining({
          boxId: "left",
          code: "overlap"
        })
      ])
    );
  });
});
