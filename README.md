# 剪映模板工坊（jianying-template-studio）

基于 **Next.js 14 + TypeScript + Tailwind CSS** 的 AI 视频模板创作平台前端。上传视频后，由豆包大模型驱动的 AI 分析视频节奏、字幕与转场，一键生成可复用的剪映模板。

## 技术栈

- Next.js 14（App Router）
- TypeScript
- Tailwind CSS 3
- React 18
- fluent-ffmpeg + ffmpeg-static / ffprobe-static（视频处理）

## 快速开始

### 1. 环境要求

- Node.js >= 18.17
- npm >= 9

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

项目根目录已创建 `.env.local`（本地生效、不提交 Git），预留了豆包大模型相关变量：

```bash
# 豆包大模型 API Key（火山方舟控制台获取：https://console.volcengine.com/ark）
DOUBAO_API_KEY=your_doubao_api_key_here

# 豆包大模型 API 基础地址
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 可选：VL 模型 ID 或推理接入点 ep-xxx（默认 doubao-1.5-vision-pro-32k-250115）
# DOUBAO_MODEL=doubao-1.5-vision-pro-32k-250115

# 可选：设为 true 时 AI 报告返回内置示例数据，便于无 Key 时联调
# DOUBAO_MOCK=false
```

将 `DOUBAO_API_KEY` 替换为你的真实 Key 即可。这两个变量为**服务端变量**（无 `NEXT_PUBLIC_` 前缀），仅在服务端 API Route 中通过 `process.env.DOUBAO_API_KEY` 读取，不会暴露到浏览器。

### 4. 启动开发服务器

```bash
npm run dev
```

启动成功后，在浏览器访问：

- 本地地址：http://localhost:3000
- 局域网访问：终端会输出 `Network: http://<你的局域网IP>:3000`，手机/其他设备连同一 Wi-Fi 即可预览移动端效果

### 5. 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（默认 3000 端口） |
| `npm run build` | 生产环境构建 |
| `npm run start` | 启动生产服务器 |

## 页面流程

```
首页 /              上传视频（拖拽/点击，MP4/MOV ≤100MB）
  │                 「开始分析」→ 进度条（第1步：抽帧分析 → 第2步：AI 剪辑手法分析）
  ▼                 完成后自动跳转报告页
报告页 /report/[jobId]
  │                 左侧：关键帧预览墙 + 镜头列表（缩略图/时间/景别/运镜）
  │                 右侧：AI 四维分析（剪辑节奏/转场风格/字幕风格/调色风格）
  │                       + 视频结构 + 整体总结；AI 失败可在此重试
  ▼                 点击「生成剪映草稿模板」
生成页 /generate/[jobId]
                    目标比例（9:16/16:9）+ 字幕样式预设（4 种）+ 转场（默认 AI 推荐）+ BGM 音量
                    「生成草稿」→ 打包 zip 并自动下载
```

页面间通过 `jobId` 传递数据：解析结果与 AI 报告分别持久化在 `public/frames/<jobId>/analysis.json` 与 `report.json`，子页面经 `GET /api/result/[jobId]` 读取，刷新不丢失。三个页面底部均有「导入剪映专业版」图文教程。

## 目录结构

```
jianying-template-studio/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts        # 视频解析接口（抽帧/镜头检测/音频提取）
│   │   ├── analyze/report/route.ts # AI 剪辑手法分析接口（豆包 VL）
│   │   ├── draft/route.ts          # 剪映草稿生成接口（zip 打包下载）
│   │   └── result/[jobId]/route.ts # 结果读取接口（跨页面数据传递）
│   ├── report/[jobId]/page.tsx     # 报告页
│   ├── generate/[jobId]/page.tsx   # 生成页
│   ├── layout.tsx                  # 根布局（元信息、深色主题）
│   ├── page.tsx                    # 首页（上传入口/功能说明/示例展示）
│   └── globals.css                 # 全局样式（网格背景、渐变文字等）
├── components/
│   ├── Header.tsx                  # 顶部导航
│   ├── UploadZone.tsx              # 首页上传区（校验/双阶段进度/跳转）
│   ├── ReportView.tsx              # 报告页主体（关键帧/镜头列表/四维分析）
│   ├── GenerateView.tsx            # 生成页主体（比例/字幕预设/下载）
│   ├── ImportGuide.tsx             # 剪映导入图文教程（页面底部）
│   ├── FeaturesSection.tsx         # 首页功能说明
│   ├── ShowcaseSection.tsx         # 首页示例展示
│   └── Footer.tsx                  # 页脚
├── lib/
│   ├── ffmpeg.ts                   # fluent-ffmpeg 封装（scdet 场景检测等）
│   ├── doubao.ts                   # 豆包 VL 调用（约束 Prompt/schema 规范化）
│   ├── capcut-draft.ts             # generateCapcutDraft() 剪映草稿 JSON 生成
│   ├── format.ts                   # 时间格式化工具
│   └── types.ts                    # 前后端共享类型
├── public/frames/<jobId>/          # 运行时生成：抽帧/音频/analysis.json/report.json
├── public/drafts/<draftId>/        # 运行时生成：剪映草稿文件夹与 zip
├── .env.local                      # 本地环境变量（不提交 Git）
├── .env.example                    # 环境变量模板
└── tailwind.config.ts              # Tailwind 配置（蓝紫品牌渐变）
```

## 视频分析 API

### `POST /api/analyze`

上传视频并执行完整分析流程，统一使用 fluent-ffmpeg 处理：

1. **抽帧**：按每秒 2 帧输出 JPEG 至 `public/frames/<jobId>/`
2. **镜头检测**：FFmpeg `scdet` 滤镜检测场景切换点（FFmpeg < 4.4 时自动降级为 `select scene + showinfo` 方案），输出每个镜头的起止时间
3. **音频提取**：音轨转码为 MP3（无音轨时跳过并给出警告）

**请求**：`multipart/form-data`，字段名 `file`

**成功响应**：

```json
{
  "ok": true,
  "data": {
    "jobId": "…",
    "duration": 6,
    "width": 640,
    "height": 360,
    "fps": 30,
    "frameCount": 12,
    "frames": [{ "url": "/frames/<jobId>/frame-0001.jpg", "time": 0 }],
    "audioUrl": "/frames/<jobId>/audio.mp3",
    "shotCount": 3,
    "shots": [{ "index": 0, "start": 0, "end": 2, "duration": 2 }],
    "warnings": []
  }
}
```

**失败响应**（`ok: false`，附面向用户的友好提示）：

| 场景 | HTTP 状态码 | 提示示例 |
| --- | --- | --- |
| 格式不支持 | 400 | 仅支持 MP4 / MOV 格式的视频，请转换格式后再上传。 |
| 超过 100MB | 400 | 视频大小超过 100MB 限制，请压缩后再上传。 |
| 文件损坏/编码不支持 | 422 | 无法读取视频信息，文件可能已损坏，或编码格式不受支持… |
| 时长超过 10 分钟 | 422 | 视频时长超过 10 分钟，暂不支持处理，请裁剪后再上传。 |
| 抽帧失败 | 422 | 视频抽帧失败，视频编码可能不受支持… |

> 说明：FFmpeg 二进制由 `ffmpeg-static` / `ffprobe-static` 随包提供，无需手动安装；缺失时自动回退系统 PATH 中的 FFmpeg。历史任务目录（`public/frames/<jobId>`）超过 1 小时会自动清理。

## AI 剪辑手法分析（豆包多模态 VL）

### `POST /api/analyze/report`

在 FFmpeg 解析结果之上，调用豆包多模态 VL 模型生成「剪辑手法分析报告」。

**请求体**（JSON）：

```json
{
  "jobId": "…",
  "duration": 6,
  "width": 640,
  "height": 360,
  "shots": [
    {
      "index": 0,
      "start": 0,
      "end": 2,
      "duration": 2,
      "frameUrl": "/frames/<jobId>/frame-0003.jpg"
    }
  ]
}
```

**处理流程**：

1. **镜头级分析**：为每个镜头取代表帧（中点对应帧），base64 内联后随多模态消息发送给 VL 模型，分析景别、运镜方式、画面风格（色调/滤镜感）、字幕位置与样式、画面内容概括
2. **全局分析**：汇总全部镜头结果，分析剪辑节奏（快切/慢节奏）、常用转场类型（硬切/叠化/闪黑/运镜转场）、视频结构（开头钩子 → 中间内容 → 结尾）、BGM 风格推测
3. **输出**：严格结构化 JSON，前端渲染为「剪辑手法分析报告」

### Prompt 约束策略

为保证模型输出稳定、字段固定，Prompt 与服务端做了多层约束：

| 层级 | 手段 |
| --- | --- |
| 提示词 | System Prompt 明确「只输出一个 JSON 对象、禁止 Markdown 围栏、不得增删改字段、枚举只能从候选值选择」 |
| 提示词 | User Prompt 内嵌完整 JSON Schema + 字段语义 + 判断依据 + 长度限制 |
| 接口参数 | `response_format: { "type": "json_object" }` + `temperature: 0.15` |
| 解析层 | 容错剥离 ```json 围栏，截取首个 `{` 至末个 `}` |
| 校验层 | 服务端按固定 schema 规范化：枚举非法值回退、字符串超长截断、缺字段补默认值 |
| 稳定性 | JSON 解析失败自动重试一次；单镜头失败不影响整体报告 |

### 响应结构

```json
{
  "ok": true,
  "data": {
    "jobId": "…",
    "model": "doubao-1.5-vision-pro-32k-250115",
    "analyzedShots": 3,
    "totalShots": 3,
    "avgShotDuration": 2,
    "shots": [
      {
        "index": 0,
        "shotType": "特写",
        "cameraMovement": "推",
        "visualStyle": "冷色调青橙电影感",
        "subtitle": { "exists": true, "position": "底部", "style": "白色黑体描边" },
        "summary": "人物面部特写，情绪强烈",
        "analyzed": true
      }
    ],
    "global": {
      "editingPace": "快切",
      "paceDescription": "平均镜头时长 1.8s，节奏密集",
      "transitions": ["硬切", "闪黑"],
      "structure": { "opening": "…", "body": "…", "ending": "…" },
      "bgmStyle": "推测为快节奏卡点电子乐",
      "overallSummary": "…"
    },
    "elapsedMs": 8421
  }
}
```

### 环境变量补充

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DOUBAO_API_KEY` | 是 | 火山方舟控制台创建的 API Key |
| `DOUBAO_BASE_URL` | 否 | 默认 `https://ark.cn-beijing.volces.com/api/v3` |
| `DOUBAO_MODEL` | 否 | VL 模型 ID 或推理接入点 `ep-xxx`，默认 `doubao-1.5-vision-pro-32k-250115` |
| `DOUBAO_MOCK` | 否 | 设为 `true` 时返回内置示例报告，便于无 Key 时联调前端 |

> 成本控制：镜头数超过 12 个时均匀抽样后再送模型；镜头级分析并发 3，单镜头失败不影响整体报告。

## 剪映草稿生成

### `POST /api/draft`

基于解析/AI 分析结果，调用核心函数 `generateCapcutDraft()`（`lib/capcut-draft.ts`）生成**剪映专业版草稿**，打包为 `剪映模板_xxx.zip` 提供下载。

**请求体**（JSON）：

```json
{
  "jobId": "…",
  "aspectRatio": "9:16",
  "transition": "叠化",
  "shots": [{ "duration": 2, "label": "镜头1" }],
  "subtitles": [{ "start": 0, "end": 2, "text": "字幕文本" }],
  "subtitleStyle": { "position": "底部", "font": "黑体", "color": "#FFE95B", "fontSize": 15 },
  "audio": { "duration": 6, "volume": 0.7 }
}
```

**草稿文件夹结构**（zip 内顶层即草稿文件夹）：

```
剪映模板_xxx/
├── draft_content.json     # 主内容：画布配置 + materials + tracks
├── draft_meta_info.json   # 元信息：草稿名/时长/封面/时间戳
├── draft_cover.jpg        # 封面（取视频首帧）
├── placeholder_video.mp4  # 黑场占位视频（按画布比例生成）
└── bgm_placeholder.mp3    # 静音占位音频（按 BGM 时长生成）
```

**draft_content.json 关键内容**：

- `canvas_config`：按 9:16（1080×1920）/ 16:9（1920×1080）/ 1:1（1080×1080）生成
- `materials.videos`：每个镜头一个视频素材占位（`placeholder_video.mp4`）
- `tracks`：视频轨（主轨）+ 字幕轨 + 音频轨
- `segments`：镜头片段按微秒时间戳顺序排列；镜头间的转场（materials.transitions）通过片段 `extra_material_refs` 引用
- 字幕片段按绝对时间点插入字幕轨，样式（位置/字体/颜色/字号）写入 text material，位置映射 `clip.transform.y`（顶部 0.72 / 中部 0 / 底部 -0.72）

**导入剪映专业版**：

1. 解压 zip，得到「剪映模板_xxx」文件夹
2. 将文件夹放入剪映草稿目录：
   - **Windows**：`C:\Users\<用户名>\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft`
   - **macOS**：`~/Movies/JianyingPro Drafts`（新版：`~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft`）
3. 打开剪映专业版 → 首页「本地草稿」即可看到该模板
4. 占位素材为黑场/静音，替换为实际素材后即可正式剪辑
