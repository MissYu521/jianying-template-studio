import { NextResponse } from "next/server";
import { readJson } from "@/lib/storage";
import type { AnalysisResultData, AiReportData } from "@/lib/types";

export const runtime = "nodejs";

interface ResultResponse {
  ok: boolean;
  data?: {
    jobId: string;
    analysis: AnalysisResultData | null;
    report: AiReportData | null;
  };
  error?: string;
}

/** GET /api/result/[jobId]：读取已完成的解析与 AI 报告结果（本地文件或 Blob） */
export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } }
): Promise<NextResponse<ResultResponse>> {
  const jobId = params.jobId;
  if (typeof jobId !== "string" || !/^[\w-]{8,64}$/.test(jobId)) {
    return NextResponse.json(
      { ok: false, error: "任务标识无效。" },
      { status: 400 }
    );
  }

  const analysis = await readJson<AnalysisResultData>(
    `frames/${jobId}/analysis.json`
  );
  if (!analysis) {
    return NextResponse.json(
      {
        ok: false,
        error: "分析结果不存在或已过期（结果保留约 1 小时），请重新上传视频。",
      },
      { status: 404 }
    );
  }

  const report = await readJson<AiReportData>(`frames/${jobId}/report.json`);

  return NextResponse.json({ ok: true, data: { jobId, analysis, report } });
}
