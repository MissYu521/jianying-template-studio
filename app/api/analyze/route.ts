import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
  buildShots,
  detectSceneCuts,
  extractAudio,
  extractFrames,
  probeVideo,
} from "@/lib/ffmpeg";
import {
  cleanupOld,
  mapLimit,
  saveFile,
  saveJson,
} from "@/lib/storage";
import type { AnalyzeResponse, FramePreview } from "@/lib/types";

export const runtime = "nodejs";
// Vercel 免费版 Serverless 函数上限 60s；本地/自托管不受此限制
export const maxDuration = 60;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DURATION_SEC = 3 * 60; // 3 分钟（云端函数执行时间限制，详见 README FAQ）
const MAX_PREVIEW_FRAMES = 24;
const ALLOWED_EXT = [".mp4", ".mov"];
const ALLOWED_MIME = ["video/mp4", "video/quicktime"];

function fail(error: string, status = 400): NextResponse<AnalyzeResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request): Promise<NextResponse<AnalyzeResponse>> {
  // ---------- 1. 解析并校验上传文件 ----------
  let file: File | null = null;
  try {
    const formData = await req.formData();
    const entry = formData.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return fail("上传数据解析失败，请重新选择视频后再试。");
  }

  if (!file) {
    return fail("未检测到视频文件，请选择需要上传的视频。");
  }
  if (file.size === 0) {
    return fail("上传的文件为空，请选择有效的视频文件。");
  }
  if (file.size > MAX_FILE_SIZE) {
    return fail("视频大小超过 100MB 限制，请压缩后再上传。");
  }

  const ext = path.extname(file.name).toLowerCase();
  const mime = file.type.toLowerCase();
  // 部分浏览器对 .mov 会上报空类型或 application/octet-stream，扩展名与 MIME 双重校验
  const extOk = ALLOWED_EXT.includes(ext);
  const mimeOk =
    ALLOWED_MIME.includes(mime) ||
    mime === "" ||
    mime === "application/octet-stream";
  if (!extOk || !mimeOk) {
    return fail("仅支持 MP4 / MOV 格式的视频，请转换格式后再上传。");
  }

  // ---------- 2. 写入工作目录（Vercel 上为 /tmp） ----------
  const jobId = randomUUID();
  const workDir = path.join(os.tmpdir(), "jianying-uploads", jobId);
  const framesWorkDir = path.join(workDir, "frames");
  const tmpPath = path.join(workDir, `source${ext}`);

  try {
    fs.mkdirSync(framesWorkDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buffer);
  } catch {
    return fail("服务器保存上传文件失败，请稍后重试。", 500);
  }

  const warnings: string[] = [];

  try {
    // ---------- 3. 读取视频信息 ----------
    let meta;
    try {
      meta = await probeVideo(tmpPath);
    } catch {
      return fail(
        "无法读取视频信息，文件可能已损坏，或编码格式不受支持（建议使用 H.264 编码的 MP4）。",
        422
      );
    }
    if (!meta.duration || meta.duration <= 0) {
      return fail("无法识别视频时长，文件可能不是有效的视频。", 422);
    }
    if (meta.duration > MAX_DURATION_SEC) {
      return fail("视频时长超过 3 分钟，暂不支持处理，请裁剪后再上传。", 422);
    }

    // ---------- 4. 每秒 2 帧抽帧 ----------
    let frameFiles: string[];
    try {
      frameFiles = await extractFrames(tmpPath, framesWorkDir);
    } catch {
      return fail("视频抽帧失败，视频编码可能不受支持，建议转换为 H.264 编码的 MP4 后重试。", 422);
    }

    // ---------- 5. scdet 场景检测 → 镜头切换点 ----------
    let cuts: number[] = [];
    try {
      cuts = await detectSceneCuts(tmpPath);
    } catch {
      warnings.push("镜头检测暂时不可用，已按单镜头处理，其余结果不受影响。");
    }
    const shots = buildShots(cuts, meta.duration);

    // ---------- 6. 提取音频 ----------
    const audioWorkPath = path.join(workDir, "audio.mp3");
    let audioExtracted = false;
    try {
      await extractAudio(tmpPath, audioWorkPath);
      audioExtracted = true;
    } catch {
      warnings.push("未检测到可用音轨，已跳过音频提取。");
    }

    // ---------- 7. 上传产物到存储层（本地 public/ 或 Vercel Blob） ----------
    // 帧图片（并发上传）
    let frameUrls: Record<string, string>;
    try {
      const entries = await mapLimit(frameFiles, 4, async (name) => {
        const buf = fs.readFileSync(path.join(framesWorkDir, name));
        const url = await saveFile(`frames/${jobId}/${name}`, buf, "image/jpeg");
        return [name, url] as const;
      });
      frameUrls = Object.fromEntries(entries);
    } catch {
      return fail("帧图片保存失败，存储服务暂时不可用，请稍后重试。", 502);
    }

    // 音频
    let audioUrl: string | null = null;
    if (audioExtracted) {
      try {
        audioUrl = await saveFile(
          `frames/${jobId}/audio.mp3`,
          fs.readFileSync(audioWorkPath),
          "audio/mpeg"
        );
      } catch {
        warnings.push("音频保存失败，已跳过音频预览。");
      }
    }

    // 视频原件（供报告页回放）
    let videoUrl: string | null = null;
    try {
      videoUrl = await saveFile(
        `videos/${jobId}${ext}`,
        fs.readFileSync(tmpPath),
        mime === "video/quicktime" ? "video/quicktime" : "video/mp4"
      );
    } catch {
      warnings.push("视频原件保存失败，不影响分析结果。");
    }

    // ---------- 8. 组装并持久化分析结果 ----------
    const sortedNames = frameFiles; // extractFrames 已按名称排序
    const step = Math.max(1, Math.ceil(sortedNames.length / MAX_PREVIEW_FRAMES));
    const frames: FramePreview[] = [];
    for (
      let i = 0;
      i < sortedNames.length && frames.length < MAX_PREVIEW_FRAMES;
      i += step
    ) {
      const name = sortedNames[i];
      const seq = parseInt(name.match(/frame-(\d+)\.jpg/)?.[1] ?? "1", 10);
      frames.push({ url: frameUrls[name], time: (seq - 1) / 2 });
    }

    const resultData = {
      jobId,
      duration: Math.round(meta.duration * 1000) / 1000,
      width: meta.width,
      height: meta.height,
      fps: Math.round(meta.fps * 100) / 100,
      frameCount: frameFiles.length,
      frames,
      audioUrl,
      videoUrl,
      shotCount: shots.length,
      shots,
      warnings,
    };

    try {
      await saveJson(`frames/${jobId}/analysis.json`, resultData);
    } catch {
      // 持久化失败不影响本次响应
    }

    // 异步清理过期数据（不阻塞响应）
    void cleanupOld("frames/");
    void cleanupOld("videos/");
    void cleanupOld("drafts/");

    return NextResponse.json({ ok: true, data: resultData });
  } finally {
    // 工作目录即用即删，处理结果已全部落入存储层
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
