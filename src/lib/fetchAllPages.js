const PAGE_SIZE = 1000;

export const fetchAllPages = async (createQuery) => {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await createQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
    offset += PAGE_SIZE;
  }
};
