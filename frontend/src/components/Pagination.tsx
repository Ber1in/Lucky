import { useEffect, useState } from "react";
import { PageSizeSelect } from "./PageSizeSelect";

export function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const [draft, setDraft] = useState(String(page));

  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(page));
      return;
    }
    const target = Math.min(Math.max(1, Math.trunc(parsed)), totalPages);
    setDraft(String(target));
    if (target !== page) {
      onPageChange(target);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-500">
      <PageSizeSelect value={pageSize} onChange={onPageSizeChange} options={pageSizeOptions} />
      <span>共 {totalPages} 页</span>
      <button className="btn-ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        上一页
      </button>
      <label className="flex items-center gap-1">
        <input
          className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm text-slate-700"
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        页
      </label>
      <button
        className="btn-ghost"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
