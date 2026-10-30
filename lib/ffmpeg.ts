import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import type { Shot } from "./types";

let configured = false;

/**
 * 配置 ffmpeg / ffprobe 可执行文件路径。
 * 优先使用随 npm 包安装的静态二进制（ffmpeg-static / ffprobe-static），
 * 缺失时回退到系统 PATH 中的 ffmpeg。
 */
export function ensureFfmpegConfigured(): void {
  if (configured) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
    }
  } catch {
    // 回退到系统 PATH 中的 ffmpeg
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeStatic = require("ffprobe-static") as
      | { path?: string }
      | undefined;
    const probePath = ffprobeStatic?.path;
    if (probePath && fs.existsSync(probePath)) {
      ffmpeg.setFfprobePath(probePath);
    }
  } catch {
    // 回退到系统 PATH 中的 ffprobe
  }
  configured = true;
}

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

/** 读取视频基础信息（时长、分辨率、帧率） */
export function probeVideo(filePath: string): Promise<VideoMeta> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const stream = data.streams.find((s) => s.codec_type === "video");
      if (!stream) return reject(new Error("NO_VIDEO_STREAM"));
      const [n, d] = String(stream.avg_frame_rate ?? "0/1")
        .split("/")
        .map(Number);
      resolve({
        duration: Number(data.format.duration ?? 0),
        width: stream.width ?? 0,
        height: stream.height ?? 0,
        fps: n && d ? n / d : 0,
      });
    });
  });
}

/** 读取媒体文件时长（不限流类型，音频/视频通用） */
export function probeMediaDuration(filePath: string): Promise<number> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve(Number(data.format.duration ?? 0));
    });
  });
}

/** 按每秒 2 帧抽帧，输出 frame-0001.jpg ... 到指定目录，返回帧文件名列表 */
export function extractFrames(
  filePath: string,
  outDir: string
): Promise<string[]> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions("-vf", "fps=2", "-q:v", "4")
      .output(path.join(outDir, "frame-%04d.jpg"))
      .on("end", () => {
        const files = fs
          .readdirSync(outDir)
          .filter((f) => /^frame-\d+\.jpg$/.test(f))
          .sort();
        if (files.length === 0) {
          reject(new Error("NO_FRAMES_EXTRACTED"));
        } else {
          resolve(files);
        }
      })
      .on("error", (err) => reject(err))
      .run();
  });
}

const NULL_OUTPUT = os.platform() === "win32" ? "NUL" : "/dev/null";

/** 从 ffmpeg stderr 日志行中解析所有 pts_time 时间点 */
function collectPtsTimes(stderrLines: string[]): number[] {
  const times: number[] = [];
  for (const line of stderrLines) {
    const m = line.match(/pts_time:([0-9]+(?:\.[0-9]+)?)/);
    if (m) times.push(parseFloat(m[1]));
  }
  return times;
}

/** 用指定滤镜跑一遍视频，收集 stderr 中打印的帧时间点 */
function runSceneFilter(filePath: string, filter: string): Promise<number[]> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    const stderrLines: string[] = [];
    ffmpeg(filePath)
      .noAudio()
      .videoFilters(filter)
      .format("null")
      .output(NULL_OUTPUT)
      .on("stderr", (line) => stderrLines.push(line))
      .on("end", () => resolve(collectPtsTimes(stderrLines)))
      .on("error", (err, _stdout, stderr) =>
        reject(new Error(stderr || err.message))
      )
      .run();
  });
}

/**
 * 检测镜头切换点（返回切换点时间戳，升序）。
 * 首选 FFmpeg scdet 滤镜（>= 4.4），不支持时回退 select scene + showinfo 方案。
 */
export async function detectSceneCuts(filePath: string): Promise<number[]> {
  try {
    return await runSceneFilter(
      filePath,
      "scdet=threshold=10:sc_pass=1,metadata=mode=print"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No such filter") || msg.includes("scdet")) {
      // 旧版 FFmpeg 无 scdet：使用 select scene score 方案兜底
      return runSceneFilter(filePath, "select='gt(scene\\,0.3)',showinfo");
    }
    throw err;
  }
}

/** 提取视频音轨为 MP3 */
export function extractAudio(
  filePath: string,
  outPath: string
): Promise<void> {
  ensureFfmpegConfigured();
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .format("mp3")
      .output(outPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * 根据切换点与总时长构建镜头列表。
 * 过滤贴边切换点，并合并间隔小于 0.4s 的密集切换（防抖）。
 */
export function buildShots(cuts: number[], duration: number): Shot[] {
  const MIN_GAP = 0.4;
  const valid = cuts
    .filter((t) => t > 0.2 && t < duration - 0.2)
    .sort((a, b) => a - b);
  const merged: number[] = [];
  for (const t of valid) {
    if (merged.length === 0 || t - merged[merged.length - 1] >= MIN_GAP) {
      merged.push(t);
    }
  }
  const points = [0, ...merged, duration];
  const shots: Shot[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    shots.push({
      index: i,
      start: round3(points[i]),
      end: round3(points[i + 1]),
      duration: round3(points[i + 1] - points[i]),
    });
  }
  return shots;
}


