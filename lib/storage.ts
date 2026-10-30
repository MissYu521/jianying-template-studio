import { put, list, del } from "@vercel/blob";
import fs from "fs";
import path from "path";

/**
 * 存储抽象层：本地开发写 public/ 目录，Vercel 部署时自动切换 Blob 存储。
 * 切换条件：存在 BLOB_READ_WRITE_TOKEN 环境变量（Vercel 关联 Blob Store 后自动注入）。
 *
 * key 约定（均为逻辑路径，本地映射 public/<key>）：
 * - videos/<jobId>.<ext>           上传的视频原件
 * - frames/<jobId>/frame-xxxx.jpg  抽帧图片
 * - frames/<jobId>/audio.mp3       提取的音频
 * - frames/<jobId>/analysis.json   解析结果
 * - frames/<jobId>/report.json     AI 报告
 * - drafts/<draftId>/<name>.zip    草稿压缩包
 */

const PUBLIC_ROOT = path.join(process.cwd(), "public");

export function isBlobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** 保存文件，返回公开可访问的 URL（Blob 绝对地址或本地 / 开头相对路径） */
export async function saveFile(
  key: string,
  data: Buffer | string,
  contentType: string
): Promise<string> {
  if (isBlobEnabled()) {
    const blob = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }
  const abs = path.join(PUBLIC_ROOT, key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
  return `/${key}`;
}

/** 按 key 读取文件内容；不存在返回 null */
export async function readFile(key: string): Promise<Buffer | null> {
  if (isBlobEnabled()) {
    const { blobs } = await list({ prefix: key, limit: 10 });
    const hit = blobs.find((b) => b.pathname === key);
    if (!hit) return null;
    const res = await fetch(hit.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  const abs = path.join(PUBLIC_ROOT, key);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export async function readJson<T>(key: string): Promise<T | null> {
  const buf = await readFile(key);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, data: unknown): Promise<string> {
  return saveFile(key, JSON.stringify(data), "application/json");
}

/**
 * 从帧 URL 解析出存储 key。
 * 兼容本地相对路径（/frames/<jobId>/frame-xxxx.jpg）与 Blob 绝对地址。
 */
export function frameKeyFromUrl(
  frameUrl: string,
  jobId: string
): string | null {
  const m = frameUrl.match(/\/frames\/([\w-]+)\/frame-(\d{4})\.jpg/);
  if (!m || m[1] !== jobId) return null;
  return `frames/${m[1]}/frame-${m[2]}.jpg`;
}

/** 列出目录下的文件名（仅本地模式；Blob 模式的清单以 analysis.json 为准） */
export function listLocalFiles(dirKey: string, pattern: RegExp): string[] {
  const abs = path.join(PUBLIC_ROOT, dirKey);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => pattern.test(f))
    .sort();
}

/** 清理过期任务数据（默认 1 小时），frames / videos / drafts 通用 */
export async function cleanupOld(
  prefix: string,
  maxAgeMs = 60 * 60 * 1000
): Promise<void> {
  try {
    if (isBlobEnabled()) {
      const { blobs } = await list({ prefix, limit: 1000 });
      const now = Date.now();
      const expired = blobs.filter(
        (b) => now - new Date(b.uploadedAt).getTime() > maxAgeMs
      );
      if (expired.length > 0) {
        await del(expired.map((b) => b.url));
      }
      return;
    }
    const abs = path.join(PUBLIC_ROOT, prefix);
    if (!fs.existsSync(abs)) return;
    const now = Date.now();
    for (const name of fs.readdirSync(abs)) {
      const target = path.join(abs, name);
      try {
        const stat = fs.statSync(target);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(target, { recursive: true, force: true });
        }
      } catch {
        // 单项清理失败不影响整体
      }
    }
  } catch {
    // 清理失败不影响主流程
  }
}

/** 简单并发限制（用于批量上传帧） */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const current = cursor++;
        results[current] = await fn(items[current], current);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
