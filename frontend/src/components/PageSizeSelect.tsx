const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

export function PageSizeSelect({
  value,
  onChange,
  options = DEFAULT_PAGE_SIZES,
}: {
  value: number;
  onChange: (value: number) => void;
  options?: number[];
}) {
  return (
    <label className="flex items-center gap-1 text-sm text-slate-500">
      每页
      <select
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size} 条
          </option>
        ))}
      </select>
    </label>
  );
}
