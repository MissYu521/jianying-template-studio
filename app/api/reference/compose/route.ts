import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import ffmpeg from "fluent-ffmpeg";
import {
  buildShots,
  detectSceneCuts,
  ensureFfmpegConfigured,
  extractFrames,
  probeMediaDuration,
  probeVideo,
} from "@/lib/ffmpeg";
import { analyzeReferencePattern, DoubaoError } from "@/lib/doubao";
import { cleanupOld, saveFile } from "@/lib/storage";
import {
  generateCapcutDraft,
  PLACEHOLDER_AUDIO_NAME,
  PLACEHOLDER_VIDEO_NAME,
  type AspectRatio,
} from "@/lib/capcut-draft";
import type {
  ArrangementItem,
  ComposeResponse,
  ReferencePattern,
} from "@/lib/types";

export const runtime = "nodejs";
// Vercel 免费版 Serverless 函数上限 60s
export const maxDuration = 60;

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 单文件 100MB
const MAX_MATERIALS = 20;
const MAX_REF_DURATION_SEC = 3 * 60; // 参考片最长 3 分钟
const MAX_PROMPT_LEN = 1000;
const ASPECT_RATIOS: AspectRatio[] = ["9:16", "16:9"];
const CANVAS_SIZES = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
} as const;

function fail(error: string, status = 400): NextResponse<ComposeResponse> {
  return NextResponse.json({ ok: false, error }, { status });
}

function mediaTypeOf(file: File): "video" | "image" | "audio" | null {
  const t = file.type.toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  // 部分浏览器对 mov 等可能上报空类型，按扩展名兜底
  const ext = path.extname(file.name).toLowerCase();
  if ([".mp4", ".mov", ".webm"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "image";
  if ([".mp3", ".wav", ".aac", ".m4a"].includes(ext)) return "audio";
  return null;
}

/** 生成黑色占位视频（与 /api/draft 一致的草稿占位方案） */
function generatePlaceholderVideo(
  outPath: string,
  width: number,
  height: number
): Promise<void> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=black:s=${width}x${height}:d=1:r=30`)
      .inputFormat("lavfi")
      .videoCodec("libx264")
      .outputOptions("-pix_fmt", "yuv420p")
      .output(outPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

/** 生成静音占位音频 */
function generatePlaceholderAudio(
  outPath: string,
  durationSec: number
): Promise<void> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input("anullsrc=r=44100:cl=mono")
      .inputFormat("lavfi")
      .duration(Math.min(Math.max(durationSec, 1), 600))
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .output(outPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

interface MaterialMeta {
  name: string;
  mediaType: "video" | "image" | "audio";
  /** 视频/音频素材的原始时长（秒），图片为 0 */
  duration: number;
}

/**
 * 素材编排：按参考片镜头时长模式为每个视觉素材分配成片时长。
 * intensity（参考强度）：1.0 完全贴近参考节奏，0.3 更接近素材默认时长。
 */
function arrangeMaterials(
  materials: MaterialMeta[],
  refShotDurations: number[],
  pattern: ReferencePattern,
  intensity: number
): ArrangementItem[] {
  const visual = materials.filter((m) => m.mediaType !== "audio");
  const refSeq =
    refShotDurations.length > 0
      ? refShotDurations
      : [pattern.avgShotDuration > 0 ? pattern.avgShotDuration : 2];

  let cursor = 0;
  return visual.map((m, i) => {
    const refDur = refSeq[i % refSeq.length];
    const defaultDur =
      m.mediaType === "image" ? 3 : Math.min(Math.max(m.duration || 4, 0.5), 10);
    const duration =
      Math.round(
        Math.max(0.5, defaultDur + (refDur - defaultDur) * intensity) * 10
      ) / 10;
    const item: ArrangementItem = {
      index: i,
      fileName: m.name,
      mediaType: m.mediaType,
      start: Math.round(cursor * 10) / 10,
      end: Math.round((cursor + duration) * 10) / 10,
      duration,
      transition: pattern.transition,
    };
    cursor += duration;
    return item;
  });
}

export async function POST(req: Request): Promise<NextResponse<ComposeResponse>> {
  const stages: Array<{ name: string; elapsedMs: number }> = [];
  let stageStart = Date.now();
  const markStage = (name: string) => {
    stages.push({ name, elapsedMs: Date.now() - stageStart });
    stageStart = Date.now();
  };

  // ---------- 0. 解析 multipart 表单 ----------
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail("上传数据解析失败，请重新选择素材后再试。");
  }

  const reference = formData.get("reference");
  if (!(reference instanceof File)) {
    return fail("请上传参考样片视频（仅限本地文件）。");
  }
  const materialFiles = formData
    .getAll("materials")
    .filter((f): f is File => f instanceof File);
  if (materialFiles.length === 0) {
    return fail("请至少上传一个视频/图片/音频素材。");
  }
  if (materialFiles.length > MAX_MATERIALS) {
    return fail(`素材数量超过 ${MAX_MATERIALS} 个上限，请精简后再试。`);
  }

  const prompt =
    typeof formData.get("prompt") === "string"
      ? (formData.get("prompt") as string).slice(0, MAX_PROMPT_LEN)
      : "";
  const aspectRatio = formData.get("aspectRatio") as AspectRatio;
  if (!ASPECT_RATIOS.includes(aspectRatio)) {
    return fail("成片比例无效，仅支持 9:16 或 16:9。");
  }
  const intensityRaw = Number(formData.get("intensity"));
  const intensity =
    Number.isFinite(intensityRaw) && intensityRaw >= 0.3 && intensityRaw <= 1.0
      ? intensityRaw
      : 0.7;

  // ---------- 1. 校验并保存到工作目录 ----------
  const jobId = randomUUID();
  const workDir = path.join(os.tmpdir(), "jianying-compose", jobId);

  try {
    fs.mkdirSync(workDir, { recursive: true });

    // 参考片校验
    const refExt = path.extname(reference.name).toLowerCase();
    if (
      !reference.type.toLowerCase().startsWith("video/") &&
      ![".mp4", ".mov", ".webm"].includes(refExt)
    ) {
      return fail("参考样片仅支持视频文件（MP4 / MOV / WebM）。");
    }
    if (reference.size === 0 || reference.size > MAX_FILE_SIZE) {
      return fail("参考样片为空或超过 100MB 限制。");
    }
    const refPath = path.join(workDir, `reference${refExt || ".mp4"}`);
    fs.writeFileSync(refPath, Buffer.from(await reference.arrayBuffer()));

    // 素材校验与保存
    const materials: MaterialMeta[] = [];
    for (let i = 0; i < materialFiles.length; i++) {
      const f = materialFiles[i];
      if (f.size === 0 || f.size > MAX_FILE_SIZE) {
        return fail(`素材「${f.name}」为空或超过 100MB 限制。`);
      }
      const mediaType = mediaTypeOf(f);
      if (!mediaType) {
        return fail(`素材「${f.name}」格式不支持，请使用视频/图片/音频文件。`);
      }
      const ext = path.extname(f.name).toLowerCase();
      const abs = path.join(workDir, `material-${i}${ext}`);
      fs.writeFileSync(abs, Buffer.from(await f.arrayBuffer()));

      // 视频/音频探测原始时长（图片无需探测）
      let duration = 0;
      if (mediaType !== "image") {
        try {
          duration = await probeMediaDuration(abs);
        } catch {
          duration = 0;
        }
      }
      materials.push({ name: f.name, mediaType, duration });
    }

    // ---------- 阶段 1：抽帧参考片 ----------
    let refMeta;
    try {
      refMeta = await probeVideo(refPath);
    } catch {
      return fail(
        "无法读取参考样片，文件可能已损坏或编码不受支持（建议 H.264 编码的 MP4）。",
        422
      );
    }
    if (!refMeta.duration || refMeta.duration <= 0) {
      return fail("无法识别参考样片时长，请更换文件。", 422);
    }
    if (refMeta.duration > MAX_REF_DURATION_SEC) {
      return fail("参考样片时长超过 3 分钟，请裁剪后再上传。", 422);
    }

    const refFramesDir = path.join(workDir, "frames");
    fs.mkdirSync(refFramesDir, { recursive: true });
    let refFrameFiles: string[];
    try {
      refFrameFiles = await extractFrames(refPath, refFramesDir);
    } catch {
      return fail("参考样片抽帧失败，编码可能不受支持。", 422);
    }

    let cuts: number[] = [];
    try {
      cuts = await detectSceneCuts(refPath);
    } catch {
      // 镜头检测失败时按单镜头处理，范式仍可基于统计与画面推断
    }
    const refShots = buildShots(cuts, refMeta.duration);
    markStage("抽帧参考片");

    // ---------- 阶段 2：解析剪辑范式（豆包 VL） ----------
    // 取参考片前/中/后三个镜头的中点帧作为代表帧
    let pattern: ReferencePattern;
    try {
      const sampleShotIdx = [
        0,
        Math.floor(refShots.length / 2),
        refShots.length - 1,
      ];
      const framesBase64: string[] = [];
      for (const idx of Array.from(new Set(sampleShotIdx))) {
        const shot = refShots[idx];
        const mid = (shot.start + shot.end) / 2;
        const frameIdx = Math.min(
          Math.max(Math.floor(mid * 2) + 1, 1),
          refFrameFiles.length
        );
        const framePath = path.join(
          refFramesDir,
          `frame-${String(frameIdx).padStart(4, "0")}.jpg`
        );
        if (fs.existsSync(framePath)) {
          framesBase64.push(fs.readFileSync(framePath).toString("base64"));
        }
      }
      pattern = await analyzeReferencePattern({
        totalDuration: refMeta.duration,
        shotDurations: refShots.map((s) => s.duration),
        framesBase64,
        userPrompt: prompt,
      });
    } catch (err) {
      if (err instanceof DoubaoError) return fail(err.message, 503);
      return fail("剪辑范式解析失败，豆包大模型服务可能暂时不可用，请稍后重试。", 502);
    }
    markStage("解析剪辑范式");

    // ---------- 阶段 3：匹配素材（编排） ----------
    const arrangement = arrangeMaterials(
      materials,
      refShots.map((s) => s.duration),
      pattern,
      intensity
    );
    if (arrangement.length === 0) {
      return fail("素材中缺少视频或图片，无法编排成片画面。");
    }
    const totalDuration =
      Math.round(arrangement[arrangement.length - 1].end * 10) / 10;
    markStage("匹配素材");

    // ---------- 阶段 4：生成 CapCut 草稿 ----------
    // 字幕：提示词声明不要字幕则跳过，否则用素材文件名生成字幕轨
    const noSubtitle = /不要字幕|无字幕|不加字幕|不需要字幕/.test(prompt);
    const subtitles = noSubtitle
      ? []
      : arrangement.map((a) => ({
          start: a.start,
          end: a.end,
          text: a.fileName.replace(/\.[^.]+$/, "").slice(0, 20) || `片段 ${a.index + 1}`,
        }));

    // BGM：取第一个音频素材时长，无音频素材则按成片总时长
    const firstAudio = materials.find((m) => m.mediaType === "audio");
    const audioDuration =
      firstAudio && firstAudio.duration > 0 ? firstAudio.duration : totalDuration;

    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const draftName = `参考成片_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    let downloadUrl: string;
    let fileName: string;
    try {
      const generated = generateCapcutDraft({
        draftName,
        aspectRatio,
        shots: arrangement.map((a) => ({
          duration: a.duration,
          transition: pattern.transition !== "硬切" ? pattern.transition : undefined,
          label: a.fileName.replace(/\.[^.]+$/, "").slice(0, 20),
        })),
        subtitles,
        subtitleStyle: { position: "底部", font: "黑体", color: "#FFFFFF", fontSize: 15 },
        audio: { duration: audioDuration, volume: 0.8 },
      });

      const draftFolder = path.join(workDir, draftName);
      fs.mkdirSync(draftFolder, { recursive: true });
      for (const [relPath, content] of Object.entries(generated.files)) {
        fs.writeFileSync(path.join(draftFolder, relPath), content as string | Buffer);
      }

      const canvas = CANVAS_SIZES[aspectRatio as "9:16" | "16:9"];
      await generatePlaceholderVideo(
        path.join(draftFolder, PLACEHOLDER_VIDEO_NAME),
        canvas.width,
        canvas.height
      );
      await generatePlaceholderAudio(
        path.join(draftFolder, PLACEHOLDER_AUDIO_NAME),
        audioDuration
      );

      const zip = new AdmZip();
      zip.addLocalFolder(draftFolder, draftName);
      fileName = `${draftName}.zip`;
      downloadUrl = await saveFile(
        `drafts/${jobId}/${fileName}`,
        zip.toBuffer(),
        "application/zip"
      );
    } catch {
      return fail("草稿生成或打包失败，请稍后重试。", 500);
    }
    markStage("生成 CapCut 草稿");

    void cleanupOld("drafts/");

    return NextResponse.json({
      ok: true,
      data: {
        jobId,
        pattern,
        arrangement,
        totalDuration,
        draft: {
          draftName,
          fileName,
          downloadUrl,
          shotCount: arrangement.length,
          subtitleCount: subtitles.length,
        },
        stages,
        warnings: [],
      },
    });
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
