import { createRenderHarness, stripStyles } from './__fixtures__/document-fixtures';

describe('bilingual addendum date', () => {
  it('uses the recorded addendum date in both languages, even when generated on another day', async () => {
    const harness = await createRenderHarness('full');
    const original = harness.prisma.documentSourceData.findUnique;
    harness.prisma.documentSourceData.findUnique = async args => {
      const record = await original(args);
      return {data:{...record.data, addendumDate:'2026-09-16T00:00:00+07:00'}};
    };
    const html = stripStyles(await harness.render('CONTRACT_ADDENDUM','vi-en'));
    expect(html).toContain('ngày 16 tháng 09 năm 2026');
    expect(html).toContain('Today, on 16/09/2026');
    expect([...html.matchAll(/Today, on (\d{2}\/\d{2}\/\d{4})/g)].map(match => match[1])).toEqual(['16/09/2026']);
  });
});
