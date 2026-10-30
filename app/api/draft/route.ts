import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import ffmpeg from "fluent-ffmpeg";
import { ensureFfmpegConfigured } from "@/lib/ffmpeg";
import { cleanupOld, readFile, saveFile } from "@/lib/storage";
import {
  generateCapcutDraft,
  PLACEHOLDER_AUDIO_NAME,
  PLACEHOLDER_VIDEO_NAME,
  type AspectRatio,
  type DraftShotInput,
  type DraftSubtitleInput,
} from "@/lib/capcut-draft";

export const runtime = "nodejs";
// Vercel 免费版 Serverless 函数上限 60s
export const maxDuration = 60;

const ASPECT_RATIOS: AspectRatio[] = ["9:16", "16:9", "1:1"];
const CANVAS_SIZES = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
} as const;
const VALID_TRANSITIONS = ["硬切", "叠化", "闪黑", "闪白", "运镜转场", "匹配剪辑"];
const VALID_POSITIONS = ["顶部", "中部", "底部"];
const MAX_SHOTS = 200;
const MAX_SUBTITLES = 300;
const MAX_TEXT_LEN = 120;

interface DraftRequestBody {
  jobId?: string;
  aspectRatio?: string;
  transition?: string;
  shots?: DraftShotInput[];
  subtitles?: DraftSubtitleInput[];
  subtitleStyle?: {
    position?: string;
    font?: string;
    color?: string;
    fontSize?: number;
  };
  audio?: { duration?: number; volume?: number };
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** 生成黑色占位视频（画布比例，1 秒），让剪映打开草稿时素材可见 */
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
      .on("error", (err) => reject(err))
      .run();
  });
}

/** 生成静音占位音频（MP3） */
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
      .on("error", (err) => reject(err))
      .run();
  });
}

export async function POST(req: Request) {
  // ---------- 1. 解析与校验 ----------
  let body: DraftRequestBody;
  try {
    body = (await req.json()) as DraftRequestBody;
  } catch {
    return fail("请求数据格式不正确，请刷新页面后重试。");
  }

  const aspectRatio = body.aspectRatio as AspectRatio;
  if (!ASPECT_RATIOS.includes(aspectRatio)) {
    return fail("画布比例无效，仅支持 9:16、16:9 或 1:1。");
  }

  if (!Array.isArray(body.shots) || body.shots.length === 0) {
    return fail("缺少镜头列表，请先完成视频解析。");
  }
  if (body.shots.length > MAX_SHOTS) {
    return fail("镜头数量超出草稿生成上限。");
  }
  for (const s of body.shots) {
    if (typeof s?.duration !== "number" || !(s.duration > 0) || s.duration > 3600) {
      return fail("镜头时长数据无效，请重新解析视频。");
    }
    if (
      s.transition !== undefined &&
      s.transition !== "" &&
      !VALID_TRANSITIONS.includes(s.transition)
    ) {
      return fail("转场类型无效，请选择列表中的转场。");
    }
  }

  const transition =
    body.transition && VALID_TRANSITIONS.includes(body.transition)
      ? body.transition
      : "硬切";

  const subtitles: DraftSubtitleInput[] = [];
  if (body.subtitles !== undefined) {
    if (!Array.isArray(body.subtitles) || body.subtitles.length > MAX_SUBTITLES) {
      return fail("字幕列表数据无效。");
    }
    for (const sub of body.subtitles) {
      if (
        typeof sub?.start !== "number" ||
        typeof sub?.end !== "number" ||
        typeof sub?.text !== "string" ||
        sub.end <= sub.start ||
        sub.start < 0
      ) {
        return fail("字幕时间或文本数据无效。");
      }
      subtitles.push({
        start: sub.start,
        end: sub.end,
        text: sub.text.slice(0, MAX_TEXT_LEN),
      });
    }
  }

  const style = body.subtitleStyle ?? {};
  const subtitleStyle = {
    position:
      style.position && VALID_POSITIONS.includes(style.position)
        ? style.position
        : "底部",
    font: typeof style.font === "string" && style.font.trim() ? style.font.slice(0, 50) : "黑体",
    color:
      typeof style.color === "string" && /^#[0-9a-fA-F]{6}$/.test(style.color)
        ? style.color
        : "#FFFFFF",
    fontSize:
      typeof style.fontSize === "number" && style.fontSize >= 5 && style.fontSize <= 60
        ? style.fontSize
        : 15,
  };

  const audioDuration = body.audio?.duration;
  const volume = body.audio?.volume;
  if (typeof audioDuration !== "number" || !(audioDuration > 0) || audioDuration > 3600) {
    return fail("音频时长配置无效。");
  }
  const audio = {
    duration: audioDuration,
    volume: typeof volume === "number" ? Math.min(Math.max(volume, 0), 1) : 0.8,
  };

  const totalDuration = body.shots.reduce((sum, s) => sum + s.duration, 0);

  // ---------- 2. 生成草稿文件夹（工作目录，完成后打包上传存储层） ----------
  const draftId = randomUUID();
  const workDir = path.join(os.tmpdir(), "jianying-drafts", draftId);

  try {
    const canvas = CANVAS_SIZES[aspectRatio];

    // 镜头列表带上统一转场类型（首个镜头无转场）
    const shots: DraftShotInput[] = body.shots.map((s, i) => ({
      duration: s.duration,
      transition: i > 0 && transition !== "硬切" ? transition : undefined,
      label: s.label ?? `镜头${i + 1}`,
    }));

    // 封面：取该任务第一帧抽帧（如存在；兼容本地与 Blob）
    let coverImage: Buffer | undefined;
    if (typeof body.jobId === "string" && /^[\w-]{8,64}$/.test(body.jobId)) {
      const buf = await readFile(`frames/${body.jobId}/frame-0001.jpg`);
      if (buf) coverImage = buf;
    }

    const generated = generateCapcutDraft({
      aspectRatio,
      shots,
      subtitles,
      subtitleStyle,
      audio,
      coverImage,
    });
    const draftName = generated.draftName;

    const draftFolder = path.join(workDir, draftName);
    fs.mkdirSync(draftFolder, { recursive: true });

    // 写入 JSON / 封面文件
    for (const [relPath, content] of Object.entries(generated.files)) {
      fs.writeFileSync(path.join(draftFolder, relPath), content as string | Buffer);
    }

    // 生成占位素材（黑场视频 + 静音音频）
    await generatePlaceholderVideo(
      path.join(draftFolder, PLACEHOLDER_VIDEO_NAME),
      canvas.width,
      canvas.height
    );
    await generatePlaceholderAudio(
      path.join(draftFolder, PLACEHOLDER_AUDIO_NAME),
      audio.duration
    );

    // ---------- 3. 打包 zip（zip 内顶层为草稿文件夹）并保存 ----------
    const zip = new AdmZip();
    zip.addLocalFolder(draftFolder, draftName);
    const zipBuffer = zip.toBuffer();

    const fileName = `${draftName}.zip`;
    let downloadUrl: string;
    try {
      downloadUrl = await saveFile(
        `drafts/${draftId}/${fileName}`,
        zipBuffer,
        "application/zip"
      );
    } catch {
      return fail("草稿打包保存失败，存储服务暂时不可用，请稍后重试。", 502);
    }

    void cleanupOld("drafts/");

    return NextResponse.json({
      ok: true,
      data: {
        draftName,
        fileName,
        downloadUrl,
        shotCount: shots.length,
        subtitleCount: subtitles.length,
        transition,
        aspectRatio,
        durationSec: Math.round(totalDuration * 100) / 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("镜头列表为空")) {
      return fail("镜头列表为空，无法生成草稿。");
    }
    return fail("草稿生成失败，请稍后重试。", 500);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
