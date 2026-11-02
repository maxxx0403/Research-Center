import { ChevronLeft, ChevronRight } from 'lucide-react';

const CatalogPagination = ({ page, pageCount, itemCount, pageSize, itemLabel, onPageChange }) => {
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, itemCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Showing {firstItem}–{lastItem} of {itemCount} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="text-muted-foreground">{page} / {pageCount}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default CatalogPagination;
