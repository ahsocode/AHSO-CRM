/** Invoice dates are calendar dates, including every purchase on the sales date. */
export function invoiceDayEnd(date: Date): Date {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}
