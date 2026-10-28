import { DocumentDataLoaderService } from "./document-data-loader.service";

describe("DocumentDataLoaderService contract VAT breakdown", () => {
  const dec = (value: number) => value as never;

  function createService(contractItems: Array<{ id: string; quoteItemId: string | null; total: number }>) {
    const quoteItems = [
      { id: "qa", order: 1, name: "A", description: null, unit: "cái", quantity: dec(1), unitPrice: dec(10_000_000), total: dec(10_000_000), taxRate: dec(10) },
      { id: "qb", order: 2, name: "B", description: null, unit: "cái", quantity: dec(1), unitPrice: dec(5_000_000), total: dec(5_000_000), taxRate: dec(8) },
      { id: "qc", order: 3, name: "C", description: null, unit: "cái", quantity: dec(1), unitPrice: dec(2_000_000), total: dec(2_000_000), taxRate: null }
    ];
    const prisma = {
      contract: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          contractNo: "HD-1",
          value: 0,
          project: {
            customer: { contacts: [] },
            quotes: [{ taxRate: dec(10), subtotal: dec(17_000_000), taxAmount: dec(1_400_000), total: dec(18_400_000), items: quoteItems }]
          },
          items: contractItems.map((item, index) => ({
            id: item.id,
            order: index + 1,
            name: item.id,
            description: null,
            unit: "cái",
            quantity: dec(1),
            unitPrice: dec(item.total),
            total: dec(item.total),
            quoteItemId: item.quoteItemId
          })),
          milestones: []
        })
      }
    };
    return new DocumentDataLoaderService(prisma as never, {} as never, {} as never);
  }

  it("prints VAT only for the quote lines the contract actually covers", async () => {
    const service = createService([{ id: "ci1", quoteItemId: "qa", total: 10_000_000 }]);

    const ref = (await service["loadContractOrQuoteReference"]("c1")) as { linkedQuote: { taxBreakdown: Array<{ rate: number | null; base: number; tax: number }> } };

    // 8% (line B) and KCT (line C) are not in the contract, so they must not appear.
    expect(ref.linkedQuote.taxBreakdown).toEqual([expect.objectContaining({ rate: 10, base: 10_000_000, tax: 1_000_000 })]);
  });

  it("keeps each covered line's own rate, including KCT, and groups them", async () => {
    const service = createService([
      { id: "ci1", quoteItemId: "qb", total: 5_000_000 },
      { id: "ci2", quoteItemId: "qc", total: 2_000_000 }
    ]);

    const ref = (await service["loadContractOrQuoteReference"]("c1")) as { linkedQuote: { taxBreakdown: Array<{ rate: number | null; base: number; tax: number }> } };

    expect(ref.linkedQuote.taxBreakdown).toEqual([
      expect.objectContaining({ rate: 8, base: 5_000_000, tax: 400_000 }),
      expect.objectContaining({ rate: null, base: 2_000_000, tax: 0 })
    ]);
  });

  it("falls back to the whole quote when the contract has no items", async () => {
    const service = createService([]);

    const ref = (await service["loadContractOrQuoteReference"]("c1")) as { linkedQuote: { taxBreakdown: Array<{ rate: number | null }> } };

    expect(ref.linkedQuote.taxBreakdown.map((group) => group.rate)).toEqual([10, 8, null]);
  });
});
