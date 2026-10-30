import type {
  GlobalAnalysis,
  ShotAnalysis,
  ShotFrameInput,
} from "./types";

/** 枚举约束：模型输出将被规范到这些固定取值 */
export const SHOT_TYPES = ["远景", "全景", "中景", "近景", "特写"] as const;
export const CAMERA_MOVEMENTS = ["固定", "推", "拉", "摇", "移", "跟", "甩"] as const;
export const PACE_TYPES = ["快切", "中等偏快", "中等", "中等偏慢", "慢节奏"] as const;
export const TRANSITION_TYPES = ["硬切", "叠化", "闪黑", "闪白", "运镜转场", "匹配剪辑"] as const;
export const SUBTITLE_POSITIONS = ["顶部", "中部", "底部", "其他"] as const;

const DEFAULT_MODEL = "doubao-1.5-vision-pro-32k-250115";
const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export class DoubaoError extends Error {
  constructor(
    public readonly code:
      | "NOT_CONFIGURED"
      | "AUTH"
      | "MODEL_NOT_FOUND"
      | "RATE_LIMITED"
      | "TIMEOUT"
      | "NETWORK"
      | "UPSTREAM"
      | "EMPTY",
    message: string
  ) {
    super(message);
  }
}

export function isDoubaoConfigured(): boolean {
  const key = process.env.DOUBAO_API_KEY;
  return Boolean(key && key !== "your_doubao_api_key_here");
}

export function doubaoModel(): string {
  return process.env.DOUBAO_MODEL || DEFAULT_MODEL;
}

function isMock(): boolean {
  return process.env.DOUBAO_MOCK === "true";
}

// ============================================================
// Prompt：镜头级分析（多模态 VL）
// ============================================================

const SHOT_SYSTEM_PROMPT = `你是一名专业的视频剪辑分析师，擅长从画面中提取可用于剪辑模板复刻的结构化特征。

【硬性规则 —— 必须严格遵守】
1. 只输出一个 JSON 对象。禁止输出任何解释、前缀、后缀、注释或 Markdown 代码块标记（如 \`\`\`json）。
2. JSON 的字段名、层级结构、字段类型必须与用户给出的 schema 完全一致，不得新增、删除或重命名字段。
3. 枚举字段只能从指定候选值中原样选择一个，禁止输出候选值以外的任何文字。
4. 所有描述性字符串使用简体中文，并遵守长度限制。
5. 不确定时选择最接近的候选值，禁止输出"未知"、"无法判断"等模糊内容（布尔字段除外）。`;

function buildShotPrompt(shot: ShotFrameInput, total: number): string {
  return `# 任务
分析这张视频镜头代表帧的画面特征，输出该镜头的结构化分析结果。

# 镜头上下文
- 该镜头为视频第 ${shot.index + 1}/${total} 个镜头
- 时间区间：${shot.start}s ~ ${shot.end}s（时长 ${shot.duration}s）

# 输出 JSON Schema（严格遵守）
{
  "shotType": "景别。枚举值，只能是：远景、全景、中景、近景、特写",
  "cameraMovement": "运镜方式。枚举值，只能是：固定、推、拉、摇、移、跟、甩",
  "visualStyle": "画面风格。字符串，≤30字，须涵盖色调倾向与滤镜质感。示例：冷色调青橙电影感、暖黄复古胶片感、高饱和日系清新",
  "subtitle": {
    "exists": "布尔值。画面中是否包含烧录字幕（忽略播放器控件、水印角标）",
    "position": "字幕位置。枚举值：顶部、中部、底部、其他。无字幕时为空字符串",
    "style": "字幕样式。字符串，≤20字。示例：白色黑体黑色描边、黄色综艺花字。无字幕时为空字符串"
  },
  "summary": "一句话概括画面主体内容与场景。字符串，≤40字"
}

# 判断依据
- 景别：按主体在画面中的占比判断。面部充满画面→特写；胸部以上→近景；半身/全身→中景；全身且带明显环境→全景；环境为主、主体占比很小→远景。
- 运镜：单帧无法确认运动时输出"固定"；画面存在明显径向模糊可推断"推/拉"，存在水平方向运动模糊可推断"摇/移"。
- 字幕：仅统计烧录在画面内的字幕。`;
}

// ============================================================
// Prompt：全局剪辑手法分析
// ============================================================

const GLOBAL_SYSTEM_PROMPT = `你是一名资深的视频剪辑手法分析师，擅长从逐镜头分析结果中提炼整条视频的剪辑策略，输出可直接指导模板复刻的结构化结论。

【硬性规则 —— 必须严格遵守】
1. 只输出一个 JSON 对象。禁止输出任何解释、前缀、后缀、注释或 Markdown 代码块标记。
2. JSON 的字段名、层级结构、字段类型必须与用户给出的 schema 完全一致，不得新增、删除或重命名字段。
3. 枚举字段只能从指定候选值中原样选择；数组字段的元素也只能来自候选值。
4. 所有描述性字符串使用简体中文，并遵守长度限制。`;

function buildGlobalPrompt(
  meta: { duration: number; shotCount: number; avgShotDuration: number },
  shots: ShotAnalysis[]
): string {
  const shotsDigest = shots
    .map(
      (s) =>
        `镜头${s.index + 1}(${s.start}-${s.end}s, ${s.duration}s): 景别=${s.shotType}, 运镜=${s.cameraMovement}, 风格=${s.visualStyle}, 字幕=${s.subtitle.exists ? `${s.subtitle.position}/${s.subtitle.style}` : "无"}, 内容=${s.summary}`
    )
    .join("\n");

  return `# 任务
基于以下整段视频的逐镜头分析结果，推断该视频的整体剪辑手法特征。

# 视频信息
- 总时长：${meta.duration}s
- 镜头数量：${meta.shotCount}
- 平均镜头时长：${meta.avgShotDuration}s

# 逐镜头分析结果
${shotsDigest}

# 输出 JSON Schema（严格遵守）
{
  "editingPace": "剪辑节奏。枚举值：快切、中等偏快、中等、中等偏慢、慢节奏。判断依据：平均镜头时长<2s→快切；2~4s→中等偏快或中等；4~8s→中等偏慢；>8s→慢节奏",
  "paceDescription": "节奏描述。字符串，≤60字，结合镜头时长分布与内容密度说明",
  "transitions": "常用转场类型。字符串数组，1~3 项，每项只能是：硬切、叠化、闪黑、闪白、运镜转场、匹配剪辑。判断依据：相邻镜头风格突变大→硬切；镜头风格渐变连贯→叠化；存在全黑画面间隔→闪黑；运镜方向一致的镜头衔接→运镜转场",
  "structure": {
    "opening": "开头钩子分析（针对前 1~2 个镜头）。字符串，≤60字，说明如何吸引观众",
    "body": "中间内容分析。字符串，≤60字，说明主体内容的组织方式",
    "ending": "结尾处理分析（针对最后 1~2 个镜头）。字符串，≤60字"
  },
  "bgmStyle": "BGM 风格推测。字符串，≤40字，基于画面风格与剪辑节奏推测并体现推测性质。示例：推测为快节奏卡点电子乐、推测为舒缓钢琴氛围乐",
  "overallSummary": "整体剪辑手法总结。字符串，≤120字，提炼可复用为剪辑模板的核心特征"
}`;
}

// ============================================================
// 豆包 Chat Completions 调用（OpenAI 兼容协议）
// ============================================================

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

async function callDoubaoChat(
  messages: Array<{ role: "system" | "user"; content: ChatContent }>,
  options: { maxTokens: number; timeoutMs?: number }
): Promise<string> {
  if (!isDoubaoConfigured()) {
    throw new DoubaoError(
      "NOT_CONFIGURED",
      "服务器尚未配置豆包大模型 API Key，请在 .env.local 中填入 DOUBAO_API_KEY 后重启服务。"
    );
  }

  const baseUrl = (process.env.DOUBAO_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DOUBAO_API_KEY}`,
      },
      body: JSON.stringify({
        model: doubaoModel(),
        messages,
        temperature: 0.15, // 低温保证输出稳定
        max_tokens: options.maxTokens,
        response_format: { type: "json_object" }, // 服务端强制 JSON 输出
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new DoubaoError("TIMEOUT", "豆包大模型响应超时，请稍后重试。");
    }
    throw new DoubaoError(
      "NETWORK",
      "无法连接豆包大模型服务，请检查网络或 DOUBAO_BASE_URL 配置。"
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new DoubaoError(
        "AUTH",
        "豆包 API Key 无效或已过期，请检查 .env.local 中的 DOUBAO_API_KEY。"
      );
    }
    if (res.status === 404) {
      throw new DoubaoError(
        "MODEL_NOT_FOUND",
        "豆包模型不可用，请检查 DOUBAO_MODEL 配置或在火山方舟控制台创建推理接入点。"
      );
    }
    if (res.status === 429) {
      throw new DoubaoError(
        "RATE_LIMITED",
        "豆包服务请求过于频繁或额度不足，请稍后重试。"
      );
    }
    throw new DoubaoError(
      "UPSTREAM",
      `豆包服务暂时不可用（HTTP ${res.status}），请稍后重试。`
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new DoubaoError("EMPTY", "豆包大模型返回了空内容，请重试。");
  }
  return content;
}

// ============================================================
// JSON 提取与 schema 规范化（防止模型输出偏离）
// ============================================================

/** 容错提取 JSON：剥离可能的 Markdown 围栏，截取首个 { 至末个 } */
function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("INVALID_JSON_OUTPUT");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function pickEnum<T extends string>(
  value: unknown,
  candidates: readonly T[],
  fallback: T
): T {
  if (typeof value === "string") {
    const hit = candidates.find((c) => value.includes(c));
    if (hit) return hit;
  }
  return fallback;
}

function pickString(value: unknown, maxLen: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

/** 将模型输出规范到固定 schema：缺失字段补默认值，非法枚举值回退 */
function sanitizeShotAnalysis(raw: Record<string, unknown>): Pick<
  ShotAnalysis,
  "shotType" | "cameraMovement" | "visualStyle" | "subtitle" | "summary"
> {
  const subtitleRaw = (raw.subtitle ?? {}) as Record<string, unknown>;
  const exists = subtitleRaw.exists === true;
  return {
    shotType: pickEnum(raw.shotType, SHOT_TYPES, "中景"),
    cameraMovement: pickEnum(raw.cameraMovement, CAMERA_MOVEMENTS, "固定"),
    visualStyle: pickString(raw.visualStyle, 40, "未识别"),
    subtitle: {
      exists,
      position: exists
        ? pickEnum(subtitleRaw.position, SUBTITLE_POSITIONS, "底部")
        : "",
      style: exists ? pickString(subtitleRaw.style, 30) : "",
    },
    summary: pickString(raw.summary, 60, "画面内容未识别"),
  };
}

function sanitizeGlobalAnalysis(raw: Record<string, unknown>): GlobalAnalysis {
  const structureRaw = (raw.structure ?? {}) as Record<string, unknown>;
  const transitionsRaw = Array.isArray(raw.transitions) ? raw.transitions : [];
  const transitions = transitionsRaw
    .map((t) =>
      TRANSITION_TYPES.find((c) => typeof t === "string" && t.includes(c))
    )
    .filter((t): t is (typeof TRANSITION_TYPES)[number] => Boolean(t));
  return {
    editingPace: pickEnum(raw.editingPace, PACE_TYPES, "中等"),
    paceDescription: pickString(raw.paceDescription, 80, "节奏信息不足"),
    transitions:
      transitions.length > 0
        ? Array.from(new Set(transitions)).slice(0, 3)
        : ["硬切"],
    structure: {
      opening: pickString(structureRaw.opening, 80, "开头信息不足"),
      body: pickString(structureRaw.body, 80, "主体内容信息不足"),
      ending: pickString(structureRaw.ending, 80, "结尾信息不足"),
    },
    bgmStyle: pickString(raw.bgmStyle, 60, "暂无足够信息推测 BGM 风格"),
    overallSummary: pickString(raw.overallSummary, 160, "整体剪辑手法信息不足"),
  };
}

// ============================================================
// Mock 模式（DOUBAO_MOCK=true）：便于无 Key 时联调前端
// ============================================================

function mockShotAnalysis(shot: ShotFrameInput): ShotAnalysis {
  const shotType = SHOT_TYPES[shot.index % SHOT_TYPES.length];
  const movement = CAMERA_MOVEMENTS[shot.index % CAMERA_MOVEMENTS.length];
  return {
    index: shot.index,
    start: shot.start,
    end: shot.end,
    duration: shot.duration,
    frameUrl: shot.frameUrl,
    shotType,
    cameraMovement: movement,
    visualStyle: "冷色调蓝紫科技光效，轻微胶片颗粒感",
    subtitle: {
      exists: shot.index % 2 === 0,
      position: shot.index % 2 === 0 ? "底部" : "",
      style: shot.index % 2 === 0 ? "白色黑体黑色描边" : "",
    },
    summary: `示例画面内容描述（镜头 ${shot.index + 1}）`,
    analyzed: true,
  };
}

function mockGlobalAnalysis(avgShotDuration: number): GlobalAnalysis {
  return {
    editingPace: avgShotDuration < 2 ? "快切" : avgShotDuration <= 4 ? "中等偏快" : "中等",
    paceDescription: `平均镜头时长 ${avgShotDuration.toFixed(1)}s，镜头切换紧凑，内容密度较高。`,
    transitions: ["硬切", "闪黑"],
    structure: {
      opening: "开头以高冲击画面快速建立主题，3 秒内给出核心看点。",
      body: "中段通过多角度镜头组接展开内容，信息密度均匀。",
      ending: "结尾收束于主体特写，配合字幕强化记忆点。",
    },
    bgmStyle: "推测为节奏感强的卡点电子乐（示例数据）",
    overallSummary:
      "示例报告：该视频以快切节奏为主，硬切转场贯穿全片，景别变化丰富，适合复刻为卡点类剪辑模板。",
  };
}

// ============================================================
// 对外接口
// ============================================================

/** 分析单个镜头的代表帧（失败自动重试一次；返回已规范化的固定 schema） */
export async function analyzeShotFrame(
  imageBase64: string,
  shot: ShotFrameInput,
  totalShots: number
): Promise<ShotAnalysis> {
  if (isMock()) return mockShotAnalysis(shot);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callDoubaoChat(
        [
          { role: "system", content: SHOT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: buildShotPrompt(shot, totalShots) },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        { maxTokens: 800 }
      );
      const parsed = sanitizeShotAnalysis(extractJson(content));
      return {
        index: shot.index,
        start: shot.start,
        end: shot.end,
        duration: shot.duration,
        frameUrl: shot.frameUrl,
        ...parsed,
        analyzed: true,
      };
    } catch (err) {
      lastError = err;
      // 鉴权/配置类错误无重试价值
      if (
        err instanceof DoubaoError &&
        ["NOT_CONFIGURED", "AUTH", "MODEL_NOT_FOUND", "RATE_LIMITED"].includes(err.code)
      ) {
        throw err;
      }
    }
  }
  throw lastError;
}

/** 全局剪辑手法分析（基于逐镜头结果汇总推断） */
export async function analyzeGlobalEditing(
  meta: { duration: number; shotCount: number; avgShotDuration: number },
  shots: ShotAnalysis[]
): Promise<GlobalAnalysis> {
  if (isMock()) return mockGlobalAnalysis(meta.avgShotDuration);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callDoubaoChat(
        [
          { role: "system", content: GLOBAL_SYSTEM_PROMPT },
          { role: "user", content: buildGlobalPrompt(meta, shots) },
        ],
        { maxTokens: 1500 }
      );
      return sanitizeGlobalAnalysis(extractJson(content));
    } catch (err) {
      lastError = err;
      if (
        err instanceof DoubaoError &&
        ["NOT_CONFIGURED", "AUTH", "MODEL_NOT_FOUND", "RATE_LIMITED"].includes(err.code)
      ) {
        throw err;
      }
    }
  }
  throw lastError;
}
