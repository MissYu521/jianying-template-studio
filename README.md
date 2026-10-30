# 剪映模板工坊（jianying-template-studio）

基于 **Next.js 14 + TypeScript + Tailwind CSS** 的 AI 视频剪辑分析与剪映草稿生成平台。上传视频后自动完成抽帧、镜头检测与音频提取，由豆包多模态大模型逐镜头分析剪辑手法（景别/运镜/字幕/调色），生成「剪辑手法分析报告」，并可一键打包生成**剪映专业版草稿模板**（zip）下载使用。

## 技术栈

- Next.js 14（App Router）+ React 18 + TypeScript + Tailwind CSS 3
- fluent-ffmpeg + ffmpeg-static / ffprobe-static（抽帧、scdet 场景检测、音频提取）
- 豆包多模态 VL 模型（剪辑手法分析）
- Vercel Blob（云端文件存储，本地开发自动降级为 `public/` 目录）
- adm-zip（草稿打包）

## 页面流程

```
首页 /              上传视频（拖拽/点击，MP4/MOV ≤100MB）
  │                 「开始分析」→ 进度条（第1步：抽帧分析 → 第2步：AI 剪辑手法分析）
  ▼                 完成后自动跳转报告页
报告页 /report/[jobId]
  │                 左侧：视频回放 + 关键帧预览墙 + 镜头列表（缩略图/时间/景别/运镜）
  │                 右侧：AI 四维分析（剪辑节奏/转场风格/字幕风格/调色风格）
  │                       + 视频结构 + 整体总结；AI 失败可在此重试
  ▼                 点击「生成剪映草稿模板」
生成页 /generate/[jobId]
                    目标比例（9:16/16:9）+ 字幕样式预设（4 种）+ 转场（默认 AI 推荐）+ BGM 音量
                    「生成草稿」→ 打包 zip 并自动下载

参考成片页 /reference
                    分区1：批量上传视频/图片/音频素材（列表展示，拖拽排序）
                    分区2：参考样片上传（仅限本地文件，附版权提示）
                    分区3：剪辑提示词（时长/风格/BGM偏好/字幕要求/节奏快慢）
                    分区4：成片比例（9:16/16:9）+ 参考强度（0.3~1.0）
                    「开始分析参考片并编排素材」→
                    进度面板：抽帧参考片 → 解析剪辑范式 → 匹配素材 → 生成 CapCut 草稿
                    结果：剪辑范式 + 素材编排时间线 + 草稿 zip 下载
```

**参考式成片编排规则**：每个视觉素材的成片时长 = `素材默认时长 + (参考镜头时长 - 默认时长) × 参考强度`（强度 1.0 完全贴近参考片节奏，0.3 保留素材原始节奏）；参考镜头时长序列循环套用；音频素材自动作为 BGM 轨道；提示词含"不要字幕"等字样时跳过字幕轨，否则按素材名生成占位字幕。草稿内为占位素材，导入剪映后按素材名替换即可。

页面间通过 `jobId` 传递数据：解析结果与 AI 报告分别持久化为 `analysis.json` / `report.json`，子页面经 `GET /api/result/[jobId]` 读取，刷新不丢失。三个页面底部均有「导入剪映专业版」图文教程。

## 本地运行

### 1. 环境要求

- Node.js >= 18.17
- npm >= 9

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`（本地生效、不提交 Git），按需填写：

```bash
# 必填（AI 分析）：豆包大模型 API Key（火山方舟控制台 https://console.volcengine.com/ark 创建）
DOUBAO_API_KEY=your_doubao_api_key_here

# 可选：豆包 API 基础地址
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 可选：VL 模型 ID 或推理接入点 ep-xxx（默认 doubao-1.5-vision-pro-32k-250115）
# DOUBAO_MODEL=doubao-1.5-vision-pro-32k-250115

# 可选：设为 true 时 AI 报告返回内置示例数据，便于无 Key 时联调前端
# DOUBAO_MOCK=false

# 可选：Vercel Blob Token；本地不配置时使用 public/ 目录存储
# BLOB_READ_WRITE_TOKEN=
```

> 以上变量均为**服务端变量**（无 `NEXT_PUBLIC_` 前缀），仅在服务端 API Route 中读取，不会暴露到浏览器。

### 4. 启动

```bash
npm run dev      # 开发服务器，访问 http://localhost:3000
npm run build    # 生产构建
npm run start    # 生产模式启动
```

局域网预览移动端：终端输出的 `Network: http://<局域网IP>:3000`。

## Vercel 部署

### 1. 推送代码到 GitHub

```bash
git init
git add -A
git commit -m "feat: 剪映模板工坊"
git branch -M main
git remote add origin https://github.com/<你的用户名>/jianying-template-studio.git
git push -u origin main
```

（仓库可先在 https://github.com/new 创建，保持空白不要初始化 README）

### 2. 导入 Vercel

1. 登录 https://vercel.com → **Add New → Project**
2. 选择 `jianying-template-studio` 仓库 → **Import**
3. Framework 自动识别为 Next.js，保持默认即可，先不点 Deploy（先配环境变量）

### 3. 配置环境变量

在 **Environment Variables** 中添加：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DOUBAO_API_KEY` | 是 | 火山方舟控制台创建的 API Key |
| `DOUBAO_BASE_URL` | 否 | 默认 `https://ark.cn-beijing.volces.com/api/v3` |
| `DOUBAO_MODEL` | 否 | VL 模型 ID 或推理接入点 `ep-xxx` |
| `DOUBAO_MOCK` | 否 | `true` 时返回示例报告（联调用） |
| `BLOB_READ_WRITE_TOKEN` | 是 | 创建 Blob Store 后自动注入（见下一步） |

### 4. 启用 Vercel Blob 存储

项目依赖文件存储（上传的视频、抽帧、草稿 zip），Vercel 免费版文件系统为临时性，**必须启用 Blob**：

1. 项目页 → **Storage** 标签 → **Create Database** → 选择 **Blob**
2. 命名（如 `jianying-media`）→ Create
3. 点击 **Connect to Project**，选择本项目 → Connect
4. 连接后 `BLOB_READ_WRITE_TOKEN` 会**自动注入**项目环境变量

### 5. 部署并访问

回到 **Deployments** 点击 **Deploy**（或推送新 commit 触发自动部署）。部署完成后获得默认域名：

```
https://jianying-template-studio.vercel.app
```

（实际域名为 `https://<项目名>-<随机后缀>.vercel.app`，也可在 Settings → Domains 绑定自定义域名。此后每次 push 到 main 分支都会自动部署。）

## 存储说明

| 环境 | 存储位置 | 说明 |
| --- | --- | --- |
| 本地开发（无 Blob Token） | `public/frames/`、`public/videos/`、`public/drafts/` | 文件写入本地磁盘，1 小时自动清理 |
| Vercel 部署（有 Blob Token） | Vercel Blob Store | 视频原件、抽帧、音频、结果 JSON、草稿 zip 全部存入 Blob，1 小时自动清理 |

切换由 `lib/storage.ts` 按 `BLOB_READ_WRITE_TOKEN` 是否存在自动完成，无需修改代码。

## 剪映草稿兼容性

生成的草稿基于**剪映专业版（JianyingPro）桌面端草稿格式**（`draft_content.json` + `draft_meta_info.json`，时间单位为微秒）：

- **兼容版本**：剪映专业版 Windows / macOS **3.x ~ 6.x**。格式字段按 6.0 版本生成，低版本剪映打开时会自动升级草稿
- **不适用**：剪映手机版（移动端无本地草稿目录）、CapCut 国际版（草稿格式不同）
- **占位素材**：草稿内视频为 1 秒黑场占位片段、音频为静音占位音频，剪映中替换为你的素材即可
- **转场**：「叠化/闪黑/闪白/运镜」映射为剪映内置基础转场；个别版本若转场未显示，可手动在转场面板重新拖入
- **字幕字体**：指定的字体需本机已安装，缺失时剪映自动回退默认字体

## 常见问题（FAQ）

### 导入剪映后草稿不显示？

1. 检查草稿目录层级：解压后应是 `草稿目录/剪映模板_xxx/draft_content.json`，注意不要多套一层文件夹
2. 确认放入的是正确目录（见页面底部教程的双平台路径），放好后**重启剪映专业版**
3. 仍不显示：打开剪映 → 草稿页下拉刷新，或检查剪映是否为专业版（手机版不支持）

### 打开草稿提示"素材丢失"？

属正常现象：草稿中的素材路径为占位文件，换机后路径失效。剪映中右键片段 → 替换素材即可；轨道结构、字幕、转场均保留。

### 转场效果没有显示？

不同剪映版本的转场资源 ID 存在差异，未显示时在剪映转场面板搜索对应名称（如"叠化"）手动拖入两个片段之间即可。

### Vercel 上视频分析超时？

免费版 Serverless 函数上限 60 秒。受上传 + 抽帧 + 上传 Blob 耗时限制，建议：

- 视频时长控制在 **3 分钟以内**（接口已限制），分辨率 1080p 以内
- 更长视频请本地运行（本地无此限制），或升级 Vercel Pro（函数上限 300s，需同步调大路由的 `maxDuration`）

### AI 分析失败 / 报告页显示重试？

- 检查 `DOUBAO_API_KEY` 是否已正确配置且未过期
- 确认模型可用：`DOUBAO_MODEL` 默认 `doubao-1.5-vision-pro-32k-250115`，也可在火山方舟控制台创建推理接入点后填入 `ep-xxx`
- 未配置 Key 时可设 `DOUBAO_MOCK=true` 使用示例数据预览完整流程

### Blob 存储用量？

免费版 Blob 为 1GB 存储。系统会对超过 1 小时的任务数据（帧/视频/草稿）自动清理，正常使用不会累积。如提示配额不足，可在 Vercel Dashboard → Storage 中手动清理。

## API 文档

### `POST /api/analyze`

上传视频执行解析（multipart/form-data，字段 `file`）：抽帧（fps=2）→ scdet 镜头检测 → 音频提取 → 产物存入存储层。响应含 `jobId`、`duration`、`shots[]`、`frames[]`、`audioUrl`、`videoUrl`。

### `POST /api/analyze/report`

接收 `{ jobId, duration, width, height, shots[] }`（每镜头含代表帧 `frameUrl`），调用豆包 VL 逐镜头分析景别/运镜/画面风格/字幕，再全局推断剪辑节奏/转场/视频结构/BGM 风格。输出严格结构化 JSON（Prompt 多层约束：system 规则 + 内嵌 schema + `response_format: json_object` + 服务端规范化 + 失败重试）。

### `GET /api/result/[jobId]`

读取 `{ analysis, report }`，供报告页/生成页拉取数据。

### `POST /api/draft`

接收 `{ jobId, aspectRatio, transition, shots[], subtitles[], subtitleStyle, audio }`，生成剪映草稿文件夹并打包 `剪映模板_xxx.zip`，返回 `downloadUrl`。

**草稿文件夹结构**：

```
剪映模板_xxx/
├── draft_content.json     # 画布配置 + materials + tracks（视频轨/字幕轨/音频轨）
├── draft_meta_info.json   # 草稿名/时长/封面/时间戳
├── draft_cover.jpg        # 封面（取视频首帧）
├── placeholder_video.mp4  # 黑场占位视频（按画布比例生成）
└── bgm_placeholder.mp3    # 静音占位音频
```

## 目录结构

```
jianying-template-studio/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts        # 视频解析接口（抽帧/镜头检测/音频提取）
│   │   ├── analyze/report/route.ts # AI 剪辑手法分析接口（豆包 VL）
│   │   ├── draft/route.ts          # 剪映草稿生成接口（zip 打包下载）
│   │   ├── reference/compose/route.ts # AI 参考式成片接口（范式解析+素材编排）
│   │   └── result/[jobId]/route.ts # 结果读取接口（跨页面数据传递）
│   ├── report/[jobId]/page.tsx     # 报告页
│   ├── generate/[jobId]/page.tsx   # 生成页
│   ├── reference/page.tsx          # AI 参考式成片生成页
│   ├── layout.tsx / page.tsx / globals.css
├── components/                     # UploadZone / ReportView / GenerateView / ImportGuide 等
├── lib/
│   ├── ffmpeg.ts                   # fluent-ffmpeg 封装（scdet 场景检测等）
│   ├── doubao.ts                   # 豆包 VL 调用（约束 Prompt/schema 规范化）
│   ├── capcut-draft.ts             # generateCapcutDraft() 剪映草稿 JSON 生成
│   ├── storage.ts                  # 存储抽象层（本地 public/ ↔ Vercel Blob 自动切换）
│   ├── format.ts / types.ts
└── tailwind.config.ts
```
