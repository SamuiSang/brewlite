export async function getEligibleVoucherCodes(apiUrl: string, codes: string[], subtotal: number, token?: string | null): Promise<string[]> {
  const results = await Promise.all(codes.map(async (code) => {
    try {
      const response = await fetch(`${apiUrl}/orders/validate-voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code, subtotal }),
      });
      return response.ok ? code : null;
    } catch {
      return null;
    }
  }));
  return results.filter((code): code is string => code !== null);
}
