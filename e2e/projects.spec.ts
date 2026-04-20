import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("mở projects và thao tác drag-drop kanban nếu có card", async ({ page }) => {
  await login(page);
  await page.goto("/projects?view=kanban");
  await expect(page.getByText("Board theo trạng thái dự án")).toBeVisible();

  const draggableCard = page.locator('article[draggable="true"]').first();
  if ((await draggableCard.count()) > 0) {
    const targetColumn = page.getByRole("heading", { name: "Đàm phán", exact: true });
    await draggableCard.dragTo(targetColumn);
  }

  await expect(page).toHaveURL(/\/projects/);
});
