import { randomUUID } from "crypto";

/**
 * 剪映专业版草稿生成器
 *
 * 生成符合剪映专业版（JianyingPro）草稿格式的完整 JSON 文件：
 * - draft_content.json：画布、素材库（materials）、轨道（tracks：视频轨/音频轨/字幕轨）、
 *   片段（segments：时间戳/转场引用/字幕样式引用）
 * - draft_meta_info.json：草稿元信息（名称、时长、封面、时间戳）
 *
 * 时间单位约定：剪映草稿内所有时间均为「微秒」（1 秒 = 1_000_000 微秒）。
 */

// ============================================================
// 对外类型
// ============================================================

export type AspectRatio = "9:16" | "16:9" | "1:1";

export interface DraftShotInput {
  /** 镜头时长（秒） */
  duration: number;
  /** 该镜头与前一个镜头之间的转场类型（首个镜头忽略）。硬切/空值表示不添加转场 */
  transition?: string;
  /** 镜头备注（用于占位素材命名，如「镜头1」） */
  label?: string;
}

export interface DraftSubtitleInput {
  /** 开始时间（秒，时间线绝对时间） */
  start: number;
  /** 结束时间（秒） */
  end: number;
  /** 字幕文本 */
  text: string;
}

export interface SubtitleStyleInput {
  /** 位置：顶部 / 中部 / 底部 */
  position: string;
  /** 字体名（需剪映本地存在，缺失时剪映自动回退默认字体） */
  font: string;
  /** 颜色，如 #FFFFFF */
  color: string;
  /** 字号（剪映字号体系，默认 15） */
  fontSize?: number;
}

export interface AudioConfigInput {
  /** BGM 时长（秒） */
  duration: number;
  /** 音量 0 ~ 1 */
  volume: number;
}

export interface GenerateDraftOptions {
  /** 草稿名称（默认：剪映模板_yyyyMMdd_HHmmss） */
  draftName?: string;
  aspectRatio: AspectRatio;
  shots: DraftShotInput[];
  subtitles: DraftSubtitleInput[];
  subtitleStyle: SubtitleStyleInput;
  audio: AudioConfigInput;
  /** 草稿封面图（可选，JPEG Buffer，写入 draft_cover.jpg） */
  coverImage?: Buffer;
}

export interface GeneratedDraft {
  draftName: string;
  /** 键为草稿文件夹内的相对路径，值为文件内容 */
  files: Record<string, string | Buffer>;
}

// ============================================================
// 常量
// ============================================================

const CANVAS_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

/** 剪映草稿占位素材文件名（实际文件由调用方生成后放入草稿文件夹） */
export const PLACEHOLDER_VIDEO_NAME = "placeholder_video.mp4";
export const PLACEHOLDER_AUDIO_NAME = "bgm_placeholder.mp3";

/** AI 转场类型 → 剪映转场名称映射（硬切表示无转场） */
const TRANSITION_NAME_MAP: Record<string, string | null> = {
  硬切: null,
  叠化: "叠化",
  闪黑: "闪黑",
  闪白: "闪白",
  运镜转场: "运镜",
  匹配剪辑: "叠化", // 剪映无同名转场，降级为叠化
};

const TRANSITION_DURATION_US = 500_000; // 转场默认 0.5s

/** 字幕位置 → 剪映画布纵向坐标（原点在画布中心，向上为正） */
const POSITION_Y_MAP: Record<string, number> = {
  顶部: 0.72,
  中部: 0,
  底部: -0.72,
};

const us = (seconds: number): number => Math.round(seconds * 1_000_000);

function defaultDraftName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `剪映模板_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ============================================================
// 主函数
// ============================================================

export function generateCapcutDraft(options: GenerateDraftOptions): GeneratedDraft {
  const {
    aspectRatio,
    shots,
    subtitles,
    subtitleStyle,
    audio,
    coverImage,
  } = options;

  if (!Array.isArray(shots) || shots.length === 0) {
    throw new Error("镜头列表为空，无法生成草稿。");
  }
  const canvas = CANVAS_SIZES[aspectRatio] ?? CANVAS_SIZES["9:16"];
  const draftName = options.draftName?.trim() || defaultDraftName();
  const nowMs = Date.now();

  // ---------- 素材库 ----------
  const videoMaterials: Record<string, unknown>[] = [];
  const transitionMaterials: Record<string, unknown>[] = [];
  const textMaterials: Record<string, unknown>[] = [];

  // ---------- 视频轨 ----------
  const videoSegments: Record<string, unknown>[] = [];
  let cursorUs = 0; // 时间线游标（微秒）

  shots.forEach((shot, i) => {
    const durationUs = us(shot.duration);
    const videoMaterialId = randomUUID();

    // materials.videos：每个镜头一个视频素材占位
    videoMaterials.push({
      audio_fade: null,
      category_id: "",
      category_name: "local",
      check_flag: 63487,
      crop: {
        lower_left_x: 0,
        lower_left_y: 1,
        lower_right_x: 1,
        lower_right_y: 1,
        upper_left_x: 0,
        upper_left_y: 0,
        upper_right_x: 1,
        upper_right_y: 0,
      },
      crop_ratio: "free",
      crop_scale: 1.0,
      duration: durationUs,
      extra_type_option: 0,
      formula_id: "",
      freeze: null,
      gameplay: null,
      has_audio: false,
      height: canvas.height,
      id: videoMaterialId,
      intensifies_audio: null,
      local_id: "",
      local_material_id: "",
      material_id: "",
      material_name: `${shot.label ?? `镜头${i + 1}`}_占位素材.mp4`,
      material_url: "",
      media_path: "",
      object_locked: null,
      path: PLACEHOLDER_VIDEO_NAME,
      picture_from: "none",
      picture_set_category_id: "",
      picture_set_category_name: "",
      request_id: "",
      reverse_intensifies_path: "",
      reverse_path: "",
      source: 0,
      source_platform: 0,
      stable: null,
      team_id: "",
      type: "video",
      video_algorithm: {
        algorithms: [],
        deflicker: null,
        motion_blur_config: null,
        visibility_duration: 0,
      },
      width: canvas.width,
    });

    // 转场：挂在当前镜头片段上（表示与前一片段之间的转场）
    const extraMaterialRefs: string[] = [];
    const transitionName =
      i > 0 && shot.transition
        ? (TRANSITION_NAME_MAP[shot.transition] ?? null)
        : null;
    if (transitionName) {
      const transitionId = randomUUID();
      transitionMaterials.push({
        category_id: "",
        category_name: "local",
        duration: TRANSITION_DURATION_US,
        effect_id: "",
        id: transitionId,
        is_overlap: false,
        name: transitionName,
        path: "",
        platform: "all",
        request_id: "",
        resource_id: "",
        type: "transition",
      });
      extraMaterialRefs.push(transitionId);
    }

    // segments：镜头片段与时间戳
    videoSegments.push({
      cartoon: false,
      clip: {
        alpha: 1.0,
        flip: { horizontal: false, vertical: false },
        rotation: 0.0,
        scale: { x: 1.0, y: 1.0 },
        transform: { x: 0.0, y: 0.0 },
      },
      common_keyframes: [],
      enable_adjust: true,
      enable_color_curves: true,
      enable_color_match_adjust: false,
      enable_color_wheels: true,
      enable_lut: true,
      enable_smart_color_adjust: false,
      extra_material_refs: extraMaterialRefs,
      group_id: "",
      hdr_settings: { intensity: 1.0, mode: 1, nits: 1000 },
      id: randomUUID(),
      intensifies_audio_path: "",
      is_placeholder: false,
      is_tone_modify: false,
      keyframe_refs: [],
      last_nonzero_volume: 1.0,
      material_id: videoMaterialId,
      render_index: 0,
      reverse: false,
      source_timerange: { duration: durationUs, start: 0 },
      speed: 1.0,
      target_timerange: { duration: durationUs, start: cursorUs },
      template_id: "",
      template_scene: "empty",
      track_attribute: 0,
      track_render_index: 0,
      uniform_scale: { on: true, value: 1.0 },
      visible: true,
      volume: 1.0,
    });

    cursorUs += durationUs;
  });

  const totalDurationUs = cursorUs;

  // ---------- 字幕轨 ----------
  const textSegments: Record<string, unknown>[] = [];
  const posY = POSITION_Y_MAP[subtitleStyle.position] ?? POSITION_Y_MAP["底部"];
  const fontSize = subtitleStyle.fontSize ?? 15;

  subtitles
    .filter((s) => s.text.trim() && s.end > s.start)
    .sort((a, b) => a.start - b.start)
    .forEach((sub) => {
      const textMaterialId = randomUUID();

      // materials.texts：带样式配置的字幕素材
      textMaterials.push({
        add_type: 0,
        alignment: 1,
        background_alpha: 1.0,
        background_color: "",
        background_style: 0,
        bold: false,
        caption: "",
        check_flag: 7,
        color: subtitleStyle.color,
        content: sub.text,
        font_category_id: "",
        font_id: "",
        font_name: subtitleStyle.font,
        font_path: "",
        font_resource_id: "",
        font_size: fontSize,
        font_source_platform: 0,
        font_title: "none",
        font_url: "",
        fonts: [],
        global_alpha: 1.0,
        has_shadow: false,
        id: textMaterialId,
        initial_scale: 1.0,
        is_rich_text: false,
        italic: false,
        keywords: [],
        layer_weight: 1,
        letter_spacing: 0.0,
        line_spacing: 0.02,
        name: "",
        preset_category: "",
        preset_category_id: "",
        preset_has_set_alignment: false,
        preset_id: "",
        preset_index: 0,
        recognize_task_id: "",
        recognize_type: 0,
        shadow_alpha: 0.9,
        shadow_angle: -45.0,
        shadow_color: "#000000",
        shadow_distance: 5.0,
        shadow_point: { x: 1.0, y: -1.0 },
        shadow_smoothness: 0.45,
        stroke_alpha: 1.0,
        stroke_color: "#000000",
        stroke_width: 0.06,
        text_align: 1,
        text_color: subtitleStyle.color,
        text_size: fontSize,
        text_to_audio_ids: [],
        tts_auto_update: false,
        type: "text",
        typesetting: 0,
        underline: false,
        underline_offset: 0.22,
        underline_width: 0.05,
      });

      // 字幕片段：按绝对时间点插入，位置通过 clip.transform.y 控制
      textSegments.push({
        cartoon: false,
        clip: {
          alpha: 1.0,
          flip: { horizontal: false, vertical: false },
          rotation: 0.0,
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0.0, y: posY },
        },
        common_keyframes: [],
        enable_adjust: false,
        enable_color_curves: true,
        enable_color_match_adjust: false,
        enable_color_wheels: true,
        enable_lut: false,
        enable_smart_color_adjust: false,
        extra_material_refs: [],
        group_id: "",
        hdr_settings: { intensity: 1.0, mode: 1, nits: 1000 },
        id: randomUUID(),
        intensifies_audio_path: "",
        is_placeholder: false,
        is_tone_modify: false,
        keyframe_refs: [],
        last_nonzero_volume: 1.0,
        material_id: textMaterialId,
        render_index: 0,
        reverse: false,
        source_timerange: null, // 文本片段无源区间
        speed: 1.0,
        target_timerange: {
          duration: us(sub.end - sub.start),
          start: us(sub.start),
        },
        template_id: "",
        template_scene: "empty",
        track_attribute: 0,
        track_render_index: 0,
        uniform_scale: null,
        visible: true,
        volume: 1.0,
      });
    });

  // ---------- 音频轨（BGM） ----------
  const audioMaterialId = randomUUID();
  const audioDurationUs = us(audio.duration);
  const volume = Math.min(Math.max(audio.volume, 0), 1);

  const audioMaterials = [
    {
      app_id: 0,
      category_id: "",
      category_name: "local",
      check_flag: 1,
      duration: audioDurationUs,
      effect_id: "",
      formula_id: "",
      id: audioMaterialId,
      intensifies_path: "",
      name: "BGM_占位音频",
      path: PLACEHOLDER_AUDIO_NAME,
      request_id: "",
      resource_id: "",
      source_platform: 0,
      team_id: "",
      text_id: "",
      tone_category_id: "",
      tone_category_name: "",
      tone_effect_id: "",
      tone_effect_name: "",
      type: "extract_music",
      video_id: "",
      wave_points: [],
    },
  ];

  const audioSegments = [
    {
      cartoon: false,
      clip: null,
      common_keyframes: [],
      enable_adjust: false,
      enable_color_curves: true,
      enable_color_match_adjust: false,
      enable_color_wheels: true,
      enable_lut: false,
      enable_smart_color_adjust: false,
      extra_material_refs: [],
      group_id: "",
      hdr_settings: { intensity: 1.0, mode: 1, nits: 1000 },
      id: randomUUID(),
      intensifies_audio_path: "",
      is_placeholder: false,
      is_tone_modify: false,
      keyframe_refs: [],
      last_nonzero_volume: volume,
      material_id: audioMaterialId,
      render_index: 0,
      reverse: false,
      source_timerange: { duration: audioDurationUs, start: 0 },
      speed: 1.0,
      target_timerange: {
        duration: Math.min(audioDurationUs, totalDurationUs),
        start: 0,
      },
      template_id: "",
      template_scene: "empty",
      track_attribute: 0,
      track_render_index: 0,
      uniform_scale: null,
      visible: true,
      volume,
    },
  ];

  // ---------- 轨道组装：视频轨（主轨） + 字幕轨 + 音频轨 ----------
  const tracks: Record<string, unknown>[] = [
    {
      attribute: 0,
      flag: 0,
      id: randomUUID(),
      is_default_hide: false,
      name: "",
      segments: videoSegments,
      type: "video",
    },
  ];
  if (textSegments.length > 0) {
    tracks.push({
      attribute: 0,
      flag: 0,
      id: randomUUID(),
      is_default_hide: false,
      name: "",
      segments: textSegments,
      type: "text",
    });
  }
  tracks.push({
    attribute: 0,
    flag: 0,
    id: randomUUID(),
    is_default_hide: false,
    name: "",
    segments: audioSegments,
    type: "audio",
  });

  // ---------- draft_content.json ----------
  const draftContent = {
    canvas_config: {
      height: canvas.height,
      ratio: "original",
      width: canvas.width,
    },
    color_space: 0,
    config: {
      adjust_max_index: 1,
      attachment_info: [],
      combination_max_index: 1,
      export_range: null,
      extract_audio_last_index: 1,
      lyrics_recognition_id: "",
      lyrics_sync: true,
      lyrics_taskinfo: [],
      maintrack_adsorb: true,
      material_save_mode: 0,
      original_speed_last_index: 1,
      record_audio_last_index: 1,
      stickers_max_index: 1,
      subtitle_recognition_id: "",
      subtitle_sync: true,
      subtitle_taskinfo: [],
      system_font_list: [],
      video_mute: false,
      zoom_info_params: null,
    },
    cover: null,
    create_time: 0,
    duration: totalDurationUs,
    extra_info: null,
    fps: 30.0,
    free_render_index_mode: false,
    keyframe_graph_list: [],
    materials: {
      audio_balances: [],
      audio_effects: [],
      audios: audioMaterials,
      beats: [],
      canvases: [],
      chromas: [],
      color_curves: [],
      effects: [],
      filters: [],
      handwrites: [],
      hsl: [],
      images: [],
      log_color_wheels: [],
      loudnesses: [],
      manual_deformations: [],
      masks: [],
      material_animations: [],
      material_colors: [],
      multi_language_refs: [],
      placeholders: [],
      plugin_effects: [],
      primary_color_wheels: [],
      realtime_denoises: [],
      shapes: [],
      smart_crops: [],
      smart_relights: [],
      sound_channel_mappings: [],
      speeds: [],
      stickers: [],
      tail_leaders: [],
      text_templates: [],
      texts: textMaterials,
      transitions: transitionMaterials,
      video_effects: [],
      videos: videoMaterials,
      vocal_beautifiers: [],
      vocal_separations: [],
    },
    mutable_config: null,
    name: draftName,
    new_version: "110.0.0",
    platform: {
      app_id: 3704,
      app_source: "lv",
      app_version: "6.0.0",
      device_id: "",
      hard_disk_id: "",
      mac_address: "",
      os: "windows",
      os_version: "10.0.22621",
      version_code: "",
    },
    relationships: [],
    render_index_track_mode: false,
    retouch_cover: null,
    tracks,
    update_time: 0,
    version: 360,
  };

  // ---------- draft_meta_info.json ----------
  const draftMetaInfo = {
    draft_cloud_last_action_download: false,
    draft_cover: coverImage ? "draft_cover.jpg" : "",
    draft_fold_path: "", // 由剪映打开时按实际草稿目录解析
    draft_id: randomUUID(),
    draft_json_file: "draft_content.json",
    draft_materials: [],
    draft_name: draftName,
    draft_new_version: "",
    draft_removable_storage_device: "",
    draft_root_path: "",
    draft_timeline_materials_size_: 0,
    draft_type: "",
    tm_draft_cloud_completed: "",
    tm_draft_cloud_modified: 0,
    tm_draft_create: nowMs,
    tm_draft_modified: nowMs,
    tm_duration: totalDurationUs,
  };

  // ---------- 文件清单 ----------
  const files: Record<string, string | Buffer> = {
    "draft_content.json": JSON.stringify(draftContent),
    "draft_meta_info.json": JSON.stringify(draftMetaInfo),
  };
  if (coverImage) {
    files["draft_cover.jpg"] = coverImage;
  }

  return { draftName, files };
}
