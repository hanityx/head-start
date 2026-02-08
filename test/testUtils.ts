type FetchMock = jest.Mock<Promise<unknown>, any[]>;

export const ensureFetchMock = (): FetchMock => {
  const current = global.fetch as unknown;
  if (!current || !(current as FetchMock).mock) {
    global.fetch = jest.fn() as unknown as typeof fetch;
  }
  return global.fetch as unknown as FetchMock;
};

export const resetFetchMock = () => {
  ensureFetchMock().mockReset();
};

export const mockFetchJsonOnce = (
  payload: any,
  opts: { ok?: boolean; status?: number } = {}
) => {
  const { ok = true, status = 200 } = opts;
  ensureFetchMock().mockResolvedValueOnce({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });
};

export const mockFetchTextOnce = (
  text: string,
  opts: { ok?: boolean; status?: number } = {}
) => {
  const { ok = true, status = 200 } = opts;
  ensureFetchMock().mockResolvedValueOnce({
    ok,
    status,
    text: async () => text,
  });
};
