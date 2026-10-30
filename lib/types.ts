/** 单个镜头的起止信息 */
export interface Shot {
  index: number;
  /** 开始时间（秒） */
  start: number;
  /** 结束时间（秒） */
  end: number;
  /** 时长（秒） */
  duration: number;
}

/** 抽帧预览缩略图 */
export interface FramePreview {
  /** 可公开访问的帧图片 URL */
  url: string;
  /** 该帧在视频中的时间点（秒） */
  time: number;
}

/** 视频分析结果（/api/analyze 成功响应的 data 字段） */
export interface AnalysisResultData {
  jobId: string;
  /** 视频总时长（秒） */
  duration: number;
  width: number;
  height: number;
  fps: number;
  /** 抽帧总数量 */
  frameCount: number;
  /** 均匀采样后的预览帧 */
  frames: FramePreview[];
  /** 提取出的音频文件 URL；无音轨时为 null */
  audioUrl: string | null;
  /** 上传视频原件 URL（报告页回放用） */
  videoUrl?: string | null;
  /** 镜头数量 */
  shotCount: number;
  /** 镜头列表 */
  shots: Shot[];
  /** 非致命警告（如无音轨、镜头检测降级等） */
  warnings: string[];
}

/** /api/analyze 统一响应结构 */
export type AnalyzeResponse =
  | { ok: true; data: AnalysisResultData }
  | { ok: false; error: string };

// ---------- AI 剪辑手法分析（/api/analyze/report） ----------

/** 提交给 AI 报告接口的镜头信息（含代表帧） */
export interface ShotFrameInput {
  index: number;
  start: number;
  end: number;
  duration: number;
  /** 代表帧图片 URL（/frames/<jobId>/frame-xxxx.jpg） */
  frameUrl: string;
}

/** /api/analyze/report 请求体 */
export interface AiReportRequest {
  jobId: string;
  duration: number;
  width: number;
  height: number;
  shots: ShotFrameInput[];
}

/** 单个镜头的 VL 模型分析结果 */
export interface ShotAnalysis {
  index: number;
  start: number;
  end: number;
  duration: number;
  /** 代表帧 URL（前端展示用） */
  frameUrl: string;
  /** 景别：远景/全景/中景/近景/特写 */
  shotType: string;
  /** 运镜方式：固定/推/拉/摇/移/跟/甩 */
  cameraMovement: string;
  /** 画面风格（色调、滤镜感） */
  visualStyle: string;
  /** 字幕信息 */
  subtitle: {
    exists: boolean;
    position: string;
    style: string;
  };
  /** 画面内容一句话概括 */
  summary: string;
  /** 该镜头是否成功完成 AI 分析（失败时其余字段为占位值） */
  analyzed: boolean;
}

/** 全局剪辑手法分析结果 */
export interface GlobalAnalysis {
  /** 剪辑节奏：快切/中等偏快/中等/中等偏慢/慢节奏 */
  editingPace: string;
  paceDescription: string;
  /** 常用转场类型列表 */
  transitions: string[];
  /** 视频结构：开头钩子 → 中间内容 → 结尾 */
  structure: {
    opening: string;
    body: string;
    ending: string;
  };
  /** BGM 风格推测 */
  bgmStyle: string;
  /** 整体剪辑手法总结 */
  overallSummary: string;
}

/** AI 剪辑手法分析报告 */
export interface AiReportData {
  jobId: string;
  model: string;
  /** 实际完成 AI 分析的镜头数（镜头过多时均匀抽样） */
  analyzedShots: number;
  totalShots: number;
  /** 平均镜头时长（秒） */
  avgShotDuration: number;
  shots: ShotAnalysis[];
  global: GlobalAnalysis;
  elapsedMs: number;
}

export type AiReportResponse =
  | { ok: true; data: AiReportData }
  | { ok: false; error: string };

// ---------- AI 参考式成片生成（/api/reference/compose） ----------

/** 参考样片剪辑范式（豆包 VL 分析输出） */
export interface ReferencePattern {
  /** 剪辑节奏：快切/中等偏快/中等/中等偏慢/慢节奏 */
  paceType: string;
  /** 平均镜头时长（秒） */
  avgShotDuration: number;
  /** 镜头时长模式描述 */
  durationPattern: string;
  /** 主转场类型 */
  transition: string;
  /** 整体画面风格 */
  visualStyle: string;
  /** 叙事结构 */
  narrativeStructure: string;
  /** BGM 建议 */
  bgmSuggestion: string;
}

/** 素材编排结果项 */
export interface ArrangementItem {
  index: number;
  /** 素材文件名 */
  fileName: string;
  /** 素材类型：video / image */
  mediaType: string;
  /** 成片时间线起点（秒） */
  start: number;
  end: number;
  duration: number;
  /** 与前一片段的转场 */
  transition: string;
}

/** 成片生成响应数据 */
export interface ComposeResultData {
  jobId: string;
  pattern: ReferencePattern;
  /** 素材编排列表（视频轨，按时间顺序） */
  arrangement: ArrangementItem[];
  /** 成片总时长（秒） */
  totalDuration: number;
  /** 草稿产物 */
  draft: {
    draftName: string;
    fileName: string;
    downloadUrl: string;
    shotCount: number;
    subtitleCount: number;
  };
  /** 各阶段耗时 */
  stages: Array<{ name: string; elapsedMs: number }>;
  warnings: string[];
}

export type ComposeResponse =
  | { ok: true; data: ComposeResultData }
  | { ok: false; error: string };
