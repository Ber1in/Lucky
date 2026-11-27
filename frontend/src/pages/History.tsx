import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Balls } from "../components/Balls";
import { Pagination } from "../components/Pagination";

export function History() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const query = useQuery({
    queryKey: ["draws", page, pageSize],
    queryFn: () => api.draws(page, pageSize),
  });
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">历史开奖</h1>
        <span className="text-sm text-slate-500">共 {query.data?.total ?? 0} 期</span>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">期号</th>
              <th className="px-4 py-3 font-medium">开奖号码</th>
              <th className="px-4 py-3 font-medium">开奖日期</th>
              <th className="px-4 py-3 font-medium">规则</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.data?.items.map((draw) => (
              <tr key={draw.draw_no} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link
                    to={`/draws/${draw.draw_no}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {draw.draw_no}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Balls front={draw.front_numbers} back={draw.back_numbers} size="sm" />
                </td>
                <td className="px-4 py-3 text-slate-500">{draw.draw_date}</td>
                <td className="px-4 py-3 text-slate-500">
                  {draw.rule_version === "seven_tier" ? "七等奖制" : "历史规则"}
                </td>
              </tr>
            ))}
            {!query.data?.items.length && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
