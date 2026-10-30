import { NextResponse } from "next/server";
import {
  analyzeGlobalEditing,
  analyzeShotFrame,
  DoubaoError,
  doubaoModel,
  isDoubaoConfigured,
} from "@/lib/doubao";
import { frameKeyFromUrl, mapLimit, readFile, saveJson } from "@/lib/storage";
import type {
  AiReportRequest,
  AiReportResponse,
  ShotAnalysis,
  ShotFrameInput,
} from "@/lib/types";

export const runtime = "nodejs";
// Vercel 免费版 Serverless 函数上限 60s
export const maxDuration = 60;

/** 最多送 AI 分析的镜头数（超出时均匀抽样，控制成本与耗时） */
const MAX_ANALYZE_SHOTS = 12;
/** 镜头分析并发数 */
const CONCURRENCY = 3;
const MAX_SHOTS_TOTAL = 200;

function fail(error: string, status = 400): NextResponse<AiReportResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

/** 校验并读取代表帧：仅允许该 jobId 下的 frame-xxxx.jpg，防路径穿越；兼容本地与 Blob */
async function loadFrameBase64(
  jobId: string,
  frameUrl: string
): Promise<{ base64: string } | { error: string }> {
  const key = frameKeyFromUrl(frameUrl, jobId);
  if (!key) {
    return { error: "代表帧地址不合法，请重新上传视频后再试。" };
  }
  const buf = await readFile(key);
  if (!buf) {
    return {
      error:
        "代表帧图片不存在或已被自动清理（结果保留约 1 小时），请重新上传视频。",
    };
  }
  return { base64: buf.toString("base64") };
}

/** 均匀抽样：镜头数超过上限时等距选取 */
function sampleShots(shots: ShotFrameInput[]): ShotFrameInput[] {
  if (shots.length <= MAX_ANALYZE_SHOTS) return shots;
  const step = shots.length / MAX_ANALYZE_SHOTS;
  const picked: ShotFrameInput[] = [];
  for (let i = 0; i < MAX_ANALYZE_SHOTS; i++) {
    picked.push(shots[Math.floor(i * step)]);
  }
  return picked;
}

/** 镜头分析失败时的占位结果（不阻断整体报告） */
function failedShot(shot: ShotFrameInput): ShotAnalysis {
  return {
    index: shot.index,
    start: shot.start,
    end: shot.end,
    duration: shot.duration,
    frameUrl: shot.frameUrl,
    shotType: "未识别",
    cameraMovement: "未识别",
    visualStyle: "分析失败",
    subtitle: { exists: false, position: "", style: "" },
    summary: "该镜头分析失败，请重试",
    analyzed: false,
  };
}

export async function POST(req: Request): Promise<NextResponse<AiReportResponse>> {
  const startedAt = Date.now();

  // ---------- 1. 解析并校验请求体 ----------
  let body: AiReportRequest;
  try {
    body = (await req.json()) as AiReportRequest;
  } catch {
    return fail("请求数据格式不正确，请刷新页面后重试。");
  }

  const { jobId, duration, shots } = body ?? {};
  if (typeof jobId !== "string" || !/^[\w-]{8,64}$/.test(jobId)) {
    return fail("任务标识无效，请重新上传视频。");
  }
  if (typeof duration !== "number" || !(duration > 0) || duration > 3600) {
    return fail("视频时长信息无效，请重新上传视频。");
  }
  if (!Array.isArray(shots) || shots.length === 0) {
    return fail("缺少镜头列表，请先完成视频解析。");
  }
  if (shots.length > MAX_SHOTS_TOTAL) {
    return fail("镜头数量超出处理上限，请裁剪视频后再试。");
  }
  for (const s of shots) {
    if (
      typeof s?.index !== "number" ||
      typeof s?.start !== "number" ||
      typeof s?.end !== "number" ||
      typeof s?.duration !== "number" ||
      typeof s?.frameUrl !== "string" ||
      s.end < s.start
    ) {
      return fail("镜头数据不完整，请重新上传视频。");
    }
  }

  // ---------- 2. 配置检查 ----------
  if (!isDoubaoConfigured() && process.env.DOUBAO_MOCK !== "true") {
    return fail(
      "服务器尚未配置豆包大模型 API Key，请在 .env.local 中填入 DOUBAO_API_KEY 后重启服务。",
      503
    );
  }

  // ---------- 3. 逐镜头 VL 分析（均匀抽样 + 并发限制 + 单镜头失败容错） ----------
  const sampled = sampleShots(shots);

  let shotResults: ShotAnalysis[];
  try {
    shotResults = await mapLimit(sampled, CONCURRENCY, async (shot) => {
      const frame = await loadFrameBase64(jobId, shot.frameUrl);
      if ("error" in frame) {
        return failedShot(shot);
      }
      try {
        return await analyzeShotFrame(frame.base64, shot, shots.length);
      } catch (err) {
        // 配置/鉴权类错误需整体失败，向上抛出
        if (
          err instanceof DoubaoError &&
          ["NOT_CONFIGURED", "AUTH", "MODEL_NOT_FOUND", "RATE_LIMITED"].includes(err.code)
        ) {
          throw err;
        }
        return failedShot(shot);
      }
    });
  } catch (err) {
    if (err instanceof DoubaoError) return fail(err.message, 503);
    return fail("镜头分析过程中出现未知错误，请稍后重试。", 500);
  }

  const successShots = shotResults.filter((s) => s.analyzed);
  if (successShots.length === 0) {
    return fail("所有镜头均分析失败，豆包大模型服务可能暂时不可用，请稍后重试。", 502);
  }

  // ---------- 4. 全局剪辑手法分析 ----------
  const avgShotDuration =
    Math.round((duration / shots.length) * 100) / 100;

  let global;
  try {
    global = await analyzeGlobalEditing(
      { duration, shotCount: shots.length, avgShotDuration },
      successShots
    );
  } catch (err) {
    if (err instanceof DoubaoError) return fail(err.message, 503);
    return fail("全局剪辑手法分析失败，请稍后重试。", 502);
  }

  const reportData = {
    jobId,
    model: doubaoModel(),
    analyzedShots: successShots.length,
    totalShots: shots.length,
    avgShotDuration,
    shots: shotResults,
    global,
    elapsedMs: Date.now() - startedAt,
  };

  // 持久化 AI 报告，供报告页/生成页按 jobId 读取（本地文件或 Blob）
  try {
    await saveJson(`frames/${jobId}/report.json`, reportData);
  } catch {
    // 持久化失败不影响本次响应
  }

  return NextResponse.json({ ok: true, data: reportData });
}
