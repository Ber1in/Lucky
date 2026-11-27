const pad = (value: number) => String(value).padStart(2, "0");

export function Balls({
  front,
  back,
  size = "md",
}: {
  front: number[];
  back: number[];
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {front.map((number) => (
        <span key={`f-${number}`} className={`ball ball-front ${dimension}`}>
          {pad(number)}
        </span>
      ))}
      <span className="px-1 text-slate-400">+</span>
      {back.map((number) => (
        <span key={`b-${number}`} className={`ball ball-back ${dimension}`}>
          {pad(number)}
        </span>
      ))}
    </div>
  );
}
