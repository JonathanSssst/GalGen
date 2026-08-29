# GalGen 项目开发计划文档

> **项目名称**：GalGen（Galgame Generator）
> **项目简介**：使用 Python 开发的 Galgame 后台管理器
> **当前版本**：v2.2
> **最后更新**：2026-08-29

## 修订记录

| 版本 | 日期 | 修订说明 |
| --- | --- | --- |
| v1.0 | - | 初稿：GalGen 双端架构与功能规划、.gg 文件格式规范、技术选型、一键生成 .exe 方案 |
| v2.0 | 2026-08-29 | AI 语音生成（edge-tts，角色→声线映射/批量生成/旁白声线）；SortableJS 拖拽排序（对话/选项/章节）；Alpine.js 声明式表单；版本号三段化（总/大/小）+ 保存递增小版本 + 生成 exe 递增大版本；角色立绘列表式管理（standees 取代 expressions）；资产音频/视频/图片预览 + 真实引用次数分析 + 批量多选删除；快捷键（Ctrl+Z 撤销 / Ctrl+Y 重做 / Ctrl+F）；系统字体下拉（中文前置）；功能区宽度可拖拽调整；性能优化（get_type_hints 缓存、commit 防抖） |
| v2.1 | 2026-08-29 | **剧情模型重构**：一条剧情 = 一个对话单元（文本/选项/音效/视频），游戏端按章节顺序自动推进；剧情页三栏改两栏；新增音效（播放方式/淡入淡出/倍速/互斥）、视频（沉浸播放/可跳过）、函数库（跳转/解锁/修改变量）、选项指向函数；功能区宽度持久化+多页面联动；顶部按钮 SVG 图标；资产新增 ico 分类与 exe 图标设置；快捷键修复（Ctrl+N 新建内容 / Ctrl+Shift+N 新建项目 / Ctrl+Shift+S 另存为）与悬浮提示；`.gg` 格式升级 v2（保存自动迁移） |
| v2.2 | 2026-08-29 | 支持**资产重命名**（磁盘文件同步改名 + 引用路径更新，自动补扩展名）；新建剧情的类型选择改为**屏幕居中模态框**（类型带说明、含取消按钮）；README 同步 |

---

## 1. 项目概述

GalGen（Galgame Generator）是使用 Python 开发的 Galgame 后台管理器，采用"管理器端 + 游戏端"双端架构：

- **管理器端（GalGen 管理器）**：负责角色、场景、剧情、章节、资产等内容的编辑与项目管理，支持一键生成游戏端可执行文件。
- **游戏端**：管理器端生成的产物，面向玩家，提供阅读、分支选择、存档、鉴赏等游戏功能。

双端均基于 **pywebview + Web 前端** 实现（见 [6. 技术选型](#6-技术选型)）：界面用 HTML/CSS/JS 编写，由 pywebview 以原生 WebView 承载，Python 后端负责数据读写与文件操作。

## 2. 管理器端

GalGen 主界面为 GalGen 管理器，包含以下功能模块：

### 2.1 角色

进行角色管理，支持以下操作：

- 新建、编辑、删除角色；
- 定义角色变量（如好感度等）与常量（如年龄、生日等）；
- 添加角色简介、性格说明等文本信息；
- **立绘列表式管理**：为角色维护立绘列表（从资产选择或上传），支持删除、重命名、设为默认；剧情中立绘仅能选择当前角色的立绘（旁白可用全部）；
- **显示名列表**：为角色配置多个显示名（如「孩子」「康斯坦丁」），剧情中作为说话者显示名下拉选项，用于化名揭示等场景。

### 2.2 场景

进行场景管理，支持以下操作：

- 新建、编辑、删除场景；
- 上传场景图片文件；
- 定义场景名称、描述等信息。

### 2.3 剧情

编辑章节剧情。v2.1 起**一条剧情 = 一个对话单元**，剧情列表支持多选、拖拽排序、复制/上移/下移/批量删除；新建时弹出**屏幕居中的类型选择模态框**（各类型带说明，含取消按钮）。

剧情类型分为四种：

- **文本（Text）**：角色发言或旁白，可绑定角色、说话者显示名、立绘、语音、场景；可引用多个**函数**（跳转/解锁/修改变量）；
- **选项（Choice）**：需要玩家选择，每个选项可**指向一个函数**（函数内含跳转/解锁结局/解锁隐藏剧情·隐藏CG/修改变量等动作）；
- **音效（SFX）**：纯音频，播放方式可选【播放（立即下一条）】【播放并等待】【循环直到指定剧情】；支持淡入/淡出时长、倍速、**互斥**（有语音/视频播放时暂停，停止后恢复）；
- **视频（Video）**：沉浸播放（隐藏对话区），可选可点击跳过，播完自动进入下一条。

支持的编辑操作：

- 剧情列表支持插入、排序、编辑、删除、复制、多选等操作；
- 文本/选项剧情可添加多个**功能**引用（函数库统一管理动作，可复用）；
- 通过直观的树状图展示剧情分支，并在分支上标明跳转条件；
- 支持一键导出剧情为 txt 等格式（导出格式见 [4.3 剧情导出格式](#43-剧情导出格式txt)）。

### 2.3a 函数

管理可复用的动作集合（函数库），供剧情/选项引用：

- 新建、编辑、删除函数；
- 函数可组合动作：**跳转至剧情**、**指向结局**、**解锁隐藏剧情**、**解锁 CG**、**修改变量**（多条效果）；
- 剧情「功能」栏可引用多个函数；选项「指向函数」引用单个函数。

### 2.4 章节

编辑章节信息，包含章节名称、章节列表、章节分支等，每个分支指向一个结局。

### 2.5 结局

管理项目的结局，支持以下操作：

- 新建、编辑、删除结局；
- 定义结局名称、类型（好结局 / 坏结局 / 普通结局 / 隐藏结局）、描述；
- 绑定结局 CG 资产；
- 标记为隐藏结局（不显示在游戏端结局统计中）。

章节分支与选项可指向结局（下拉选择器自动引用结局列表）。

### 2.6 资产

管理项目的所有资产，支持不同的筛选与排序模式：

- **资产分类**：背景（bg）、场景（scene）、立绘（standee）、CG（cg）、界面（ui）、背景音乐（bgm）、音效（se）、语音（voice）、视频（video）、图标（ico）；
- **预览**：图片（img）、音频（audio）、视频（video）均支持内嵌预览；
- **重命名**：可直接编辑文件名，磁盘文件同步改名、引用路径自动更新（未带扩展名时自动沿用原扩展名）；
- **引用分析**：自动统计每个资产被引用的次数（遍历角色/剧情/函数/结局），支持展开查看具体引用位置；
- **批量操作**：勾选或 Ctrl+点击多选，批量删除；
- **筛选模式**：按角色、按场景等；**排序模式**：按上传日期、按引用次数等；
- 支持使用预设的 UI 资产而非自定义资产。

### 2.7 生成

GalGen 的主要功能，一键生成 `.exe` 的游戏文件（具体见 [5. 游戏端](#5-游戏端)与 [7. 一键生成 .exe 实现方案](#7-一键生成-exe-实现方案)）。后续计划支持一键生成 `.apk` 文件。

### 2.8 设置

设置项目信息与生成配置：

- 项目名称、作者、项目简介；
- **版本号**：总版本 / 大版本 / 小版本三段分栏编辑（数字输入框，样式与文字速度一致）；
- **版本自动递增开关**：保存时自动递增小版本（可开关）、生成 exe 时自动递增大版本并清零小版本（可开关）；
- **exe 图标**：从 ico 分类资产中选择，生成时作为程序图标；
- **游戏端默认配置**：文字速度、自动阅读等待、中文字体/英文及数字字体（系统字体下拉，中文前置）、默认字号、窗口宽高。

### 2.9 AI 功能

AI 语音生成（基于 edge-tts，免费、无需 API Key）：

- 角色 → 音色映射：为每个角色（含旁白）指定合成声线，生成时自动路由；
- 批量生成：按剧情范围生成对话语音，自动创建 voice 类资产并回写对话引用；
- 声线下拉仅显示中/英文音色；
- 支持覆盖已生成、生成进度与日志。

### 2.10 快捷键

| 快捷键 | 功能 |
| --- | --- |
| Ctrl+N | 新建内容（按当前页面；剧情页弹出类型选择） |
| Ctrl+Shift+N | 新建项目 |
| Ctrl+S | 保存（成功后顶部悬浮提示） |
| Ctrl+Shift+S | 另存为 |
| Ctrl+O | 打开项目 |
| Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z | 撤销 / 重做 |
| Ctrl+F | 聚焦搜索框 |

## 3. 开发模式与项目文件

GalGen 采用项目式开发模式：所有项目信息通过特定编码格式（JSON）存储为 `.gg` 格式的文件；打开应用时加载项目，支持自动恢复上一次关闭时正在运行的项目。

## 4. 固定格式规范

### 4.1 项目文件格式（.gg）

所有项目信息以 `.gg` 文件存储，其格式规范如下：

| 项目 | 规范 |
| --- | --- |
| 文件扩展名 | `.gg` |
| 文件编码 | UTF-8（无 BOM） |
| 换行符 | LF（`\n`） |
| 数据格式 | JSON（RFC 8259） |
| 缩进 | 2 个空格 |
| 字段命名 | snake_case（小写下划线） |
| 日期格式 | ISO 8601，如 `2026-08-27T10:30:00+08:00` |

`.gg` 文件顶层结构包含 `meta` 与 `data` 两个字段：

```json
{
  "meta": {
    "format_version": 2,
    "generator": "GalGen",
    "generator_version": "1.0.0",
    "created_at": "2026-08-27T10:30:00+08:00",
    "updated_at": "2026-08-27T10:30:00+08:00"
  },
  "data": {}
}
```

| meta 字段 | 类型 | 说明 |
| --- | --- | --- |
| `format_version` | int | 文件格式版本号，随格式演进递增，用于兼容性判断 |
| `generator` | string | 生成器标识，固定为 `GalGen` |
| `generator_version` | string | 管理器版本号（语义化版本号） |
| `created_at` | string | 文件创建时间（ISO 8601） |
| `updated_at` | string | 文件最近修改时间（ISO 8601） |

`data` 字段按功能模块组织，顶层包含以下字段：

| data 字段 | 类型 | 说明 |
| --- | --- | --- |
| `project` | object | 项目设置（名称、作者、版本、游戏默认配置等） |
| `characters` | array | 角色列表 |
| `scenes` | array | 场景列表 |
| `chapters` | array | 章节列表 |
| `scripts` | array | 剧情（单条对话单元）列表 |
| `functions` | array | 函数（动作集合）列表 |
| `assets` | array | 资产清单 |
| `endings` | array | 结局列表 |

```json
{
  "project": {},
  "characters": [],
  "scenes": [],
  "chapters": [],
  "scripts": [],
  "functions": [],
  "assets": [],
  "endings": []
}
```

各子模块的具体结构见以下小节。

#### 4.1.1 project（项目设置）

```json
{
  "name": "示例项目",
  "author": "作者",
  "version": "1.0.0",
  "version_major": 1,
  "version_minor": 0,
  "version_patch": 0,
  "auto_patch_on_save": true,
  "auto_minor_on_build": true,
  "description": "项目简介",
  "defaults": {
    "text_speed": 30,
    "auto_advance_delay": 3.0,
    "font_cn": "微软雅黑",
    "font_en": "Microsoft YaHei",
    "font_size": 24,
    "window_width": 1280,
    "window_height": 720
  }
}
```

| project 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 项目名称 |
| `author` | string | 作者 |
| `version` | string | 项目版本号（SemVer，由三段合成） |
| `version_major` / `version_minor` / `version_patch` | int | 版本号三段（总/大/小版本），设置页分栏编辑 |
| `auto_patch_on_save` | boolean | 保存时自动递增小版本（默认 true） |
| `auto_minor_on_build` | boolean | 生成 exe 时自动递增大版本、清零小版本（默认 true） |
| `exe_icon` | string | exe 图标资产 ID（ico 分类资产，可为空） |
| `description` | string | 项目简介 |
| `defaults` | object | 游戏端默认配置，可在管理器「设置」模块修改 |

> 兼容性：旧文件仅含 `version` 字符串时，加载自动解析到三段；`defaults.font` 自动迁移为 `font_cn`/`font_en`。

#### 4.1.2 characters（角色）

`characters` 为对象数组，单个角色结构如下：

```json
{
  "id": "char_0001",
  "name": "林晓",
  "description": "角色简介",
  "personality": "性格说明",
  "variables": {
    "affection": 0
  },
  "constants": {
    "age": 18,
    "birthday": "2026-01-01"
  },
  "default_standee": "asset_0001",
  "standees": [
    { "name": "normal", "asset_id": "asset_0001" },
    { "name": "happy", "asset_id": "asset_0002" }
  ],
  "voice": "voice_char_0001",
  "labels": ["孩子", "康斯坦丁"]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 角色 ID，全局唯一 |
| `name` | string | 角色名称 |
| `description` | string | 角色简介 |
| `personality` | string | 性格说明 |
| `variables` | object | 可变变量（如好感度），键值对 |
| `constants` | object | 不可变常量（年龄、生日等） |
| `default_standee` | string | 默认立绘资产 ID |
| `standees` | array | 立绘列表，每项 `{name, asset_id}`（列表式管理，取代旧 expressions） |
| `voice` | string | 默认语音资产 ID（可为空） |
| `labels` | array | 显示名列表，剧情中作为说话者显示名下拉选项 |

> 兼容性：旧文件含 `expressions` 时，加载自动迁移为 `standees` 并取 normal 为默认立绘。

#### 4.1.3 scenes（场景）

```json
{
  "id": "scene_0001",
  "name": "教学楼天台",
  "background": "asset_0101",
  "description": "傍晚的天台，风很大"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 场景 ID，全局唯一 |
| `name` | string | 场景名称 |
| `background` | string | 背景图资产 ID |
| `description` | string | 场景描述（可选） |

#### 4.1.4 chapters（章节）

```json
{
  "id": "chap_0001",
  "name": "第一章 · 相遇",
  "order": 1,
  "start_script": "script_0001",
  "branches": [
    {
      "id": "br_0001",
      "name": "进入好结局",
      "condition": "affection >= 80",
      "ending_id": "end_0001"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 章节 ID，全局唯一 |
| `name` | string | 章节名称 |
| `order` | int | 章节顺序 |
| `start_script` | string | 章节起始剧情 ID |
| `branches` | array | 章节分支列表，每个分支指向一个结局 |

**分支跳转条件（`condition`）语法**：`变量 比较符 数值`，如 `char_0001.affection >= 10`、`score > 5`。
- 比较符：`>=`、`<=`、`>`、`<`、`==`、`!=`；
- 角色变量用 `角色ID.变量名` 形式（如 `char_0001.affection`）；全局变量直接用变量名；省略角色前缀时也会在全部角色变量中查找同名变量；
- 条件为空字符串表示「无条件」，作为兜底分支；
- 游戏端在剧情结束时按分支顺序取**第一个条件成立**的分支进入对应结局。

#### 4.1.5 scripts（剧情）

v2.1 起**一条剧情 = 一个对话单元**（文本/选项/音效/视频），游戏端按章节顺序 + `order` 自动播放下一条，直到章节分支/结局或手动存档。

```json
{
  "id": "script_0001",
  "chapter_id": "chap_0001",
  "order": 0,
  "dialogs": [
    {
      "id": "dlg_0001",
      "type": "text",
      "character_id": "char_0001",
      "speaker_label": "",
      "standee": "asset_0002",
      "voice": "voice_0001",
      "scene_id": "scene_0001",
      "content": "你也来了呀。",
      "actions": ["fn_0001"]
    }
  ]
}
```

**dialog 字段**（`type` 决定有效字段）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 对话 ID |
| `type` | enum | `text` / `choice` / `sfx` / `video` |
| `character_id` | string | 发言角色 ID（text/choice；空=旁白） |
| `speaker_label` | string | 说话者显示名覆盖（可选） |
| `standee` | string | 立绘资产 ID（有角色时限定该角色立绘） |
| `voice` | string | 语音资产 ID |
| `scene_id` | string | 场景 ID |
| `content` | string | 对话文本（text/choice 的问题文本） |
| `options` | array | 选项列表（choice 必填） |
| `actions` | array | 功能引用列表（仅 text/choice，可多个） |
| `sfx` | array | 音效模块列表（sfx 类型） |
| `video_asset_id` | string | 视频资产 ID（video 类型） |
| `video_skippable` | boolean | 视频可点击跳过（默认 true） |

**选项（Option）字段**：`id`、`content`、`action_id`（指向函数）。旧字段 `jump_to/effects/unlock_*/ending_id` 保留用于读取旧文件，编辑器隐藏。

**音效模块（SoundEffect）字段**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 音效 ID |
| `play_mode` | enum | `play`（播放后立即下一条）/ `play_and_wait`（播完再下一条）/ `loop_until`（循环直到指定剧情） |
| `asset_id` | string | 音效资产 ID（se 分类） |
| `fade_in` / `fade_out` | number | 淡入/淡出时长（秒） |
| `rate` | number | 播放倍速 |
| `exclusive` | boolean | 互斥：有语音/视频播放时暂停，停止后恢复 |
| `stop_script_id` | string | 循环播放时停止的剧情 ID |

> 兼容性：旧文件（v1，一条剧情含多条对话）加载时自动拆分为多个单条剧情。

#### 4.1.5a functions（函数）

函数是一组动作的集合，供剧情/选项引用。动作包括：跳转、解锁结局/隐藏剧情/隐藏CG、修改变量。

```json
{
  "id": "fn_0001",
  "name": "好感+1",
  "description": "",
  "jump_to": "script_0005",
  "unlock_cg": "asset_0203",
  "unlock_script": "script_0008",
  "ending_id": "end_0001",
  "effects": [
    { "target": "char_0001", "variable": "affection", "operation": "add", "value": 1 }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 函数 ID |
| `name` | string | 函数名称 |
| `jump_to` | string | 跳转剧情 ID（可为空） |
| `unlock_cg` / `unlock_script` | string | 解锁 CG / 隐藏剧情资产 ID（可为空） |
| `ending_id` | string | 指向结局 ID（可为空） |
| `effects` | array | 修改变量效果列表 |

变量修改效果（effect）结构：

```json
{
  "target": "char_0001",
  "variable": "affection",
  "operation": "add",
  "value": 5
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `target` | string | 作用对象：角色 ID 或 `global` |
| `variable` | string | 变量名 |
| `operation` | enum | `add` / `sub` / `set` |
| `value` | number | 数值 |

#### 4.1.6 assets（资产）

```json
{
  "id": "asset_0001",
  "type": "image",
  "category": "standee",
  "file_name": "char_0001_normal.png",
  "rel_path": "assets/images/standee/char_0001_normal.png",
  "tags": ["林晓", "立绘"],
  "created_at": "2026-08-27T10:30:00+08:00",
  "reference_count": 3
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 资产 ID，全局唯一 |
| `type` | enum | `image` / `audio` / `video` |
| `category` | enum | `bg` / `scene` / `standee` / `cg` / `ui` / `bgm` / `se` / `voice` / `video` / `ico` |
| `file_name` | string | 原始文件名 |
| `rel_path` | string | 项目内相对路径 |
| `tags` | array | 标签，用于筛选 |
| `created_at` | string | 上传时间（ISO 8601） |
| `reference_count` | int | 被引用次数，用于排序 |

#### 4.1.7 endings（结局）

```json
{
  "id": "end_0001",
  "name": "好结局 · 雨过天晴",
  "ending_type": "good",
  "description": "结局描述",
  "cg": "asset_0201",
  "is_hidden": false
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 结局 ID，全局唯一 |
| `name` | string | 结局名称 |
| `ending_type` | enum | `good` / `bad` / `normal` / `hidden` |
| `description` | string | 结局描述 |
| `cg` | string | 结局 CG 资产 ID（可为空） |
| `is_hidden` | boolean | 是否隐藏结局 |

### 4.2 资产文件格式

| 资产类型 | 支持格式 |
| --- | --- |
| 图片 | PNG、JPG/JPEG、WebP |
| 图标 | ICO（exe 图标） |
| 音频 | MP3、OGG、WAV |
| 视频 | MP4、WebM |

资产文件名建议遵循「类型前缀_用途」的命名规范，例如 `bg_rainy_night.png`、`voice_char_001_laugh.mp3`，以便在筛选与引用时快速识别。

### 4.3 剧情导出格式（.txt）

- 文件编码：UTF-8（无 BOM）；
- 换行符：LF（`\n`）；
- 内容结构：每行一条对话，按「角色名：对话内容」的格式输出；选项行以特殊标记（如 `→`）开头，并标注其绑定的跳转结果。

### 4.4 通用编码约定

- 项目、角色、场景、章节的 ID 建议采用「小写前缀 + 递增序号」的格式（如 `char_0001`），保持唯一性与可读性；函数前缀为 `fn_`；
- 项目版本号遵循语义化版本号（SemVer）规范，即 `主版本号.次版本号.修订号`（管理器内以总/大/小三段分栏编辑）；
- 所有时间统一采用本地时区表示，并在 `.gg` 文件中以 ISO 8601 格式记录。

## 5. 游戏端

游戏端是 GalGen 的生成产物，主要包含以下功能：

### 5.1 基础阅读系统

- 文字逐字打印效果（打字机效果）；
- 一键快进：跳过已经读过的文本；
- 自动阅读：自动翻页，无需点击鼠标；
- 点击鼠标 / 回车翻页，基本键盘方向键操作（点击数字选择选项、上下左右键切换选项、回车键选中）；
- 文字速度调节，字体、字号调整（支持在管理器中设置和修改默认值）；
- **顺序推进**：一条剧情播完自动播放下一条（按章节 `order` + 剧情 `order`），直到章节分支/结局或手动存档。

### 5.2 分支选项系统【核心】

- 剧情弹出多个选项，进入不同分支（取决于管理器的设定）；
- 选项指向**函数**（跳转/解锁结局/解锁隐藏剧情·隐藏CG/修改变量等动作组合）；
- 隐藏好感度变量：选择不同选项修改角色好感数值；
- 根据好感判定：进入个人线、触发坏结局、解锁隐藏 CG 图等。

### 5.2a 音效 / 视频 / 功能

- **音效（SFX）**：纯音频播放，支持【播放（立即下一条）】【播放并等待】【循环直到指定剧情】三种方式；淡入/淡出时长、倍速；**互斥**音效在语音/视频播放时暂停、停止后恢复；
- **视频（Video）**：沉浸播放（隐藏对话区），支持点击跳过，播完自动进入下一条；
- **功能（Function）**：文本/选项剧情触发函数（跳转/解锁/修改变量）。

### 5.3 存档 & 读档系统

- 多个存档槽位；
- 存档自动截图（保存当前画面作为存档预览）；
- 快速存档 QuickSave / 快速读档 QuickLoad；
- 回到标题界面、返回上一个选择点。

### 5.4 画廊（CG 回想）

- 通关后解锁 CG 插画（可在管理器端资产模块中管理），可自由浏览；
- 未解锁 CG 显示灰色锁，通关才开放。

### 5.5 音乐室 / 音频鉴赏

- 已解锁的 BGM、音效可以播放试听。

### 5.6 剧本回想（场景回想）

- 回看已经阅读过的剧情片段。

### 5.7 设置选项（Setting）

- 文本速度、自动阅读等待时长；
- BGM 音量、SE 音效音量、角色语音音量独立调节；
- 窗口 / 全屏切换；
- 重置游戏（清除全部存档进度）。

### 5.8 标题主菜单

- 新游戏、继续游戏、加载存档、设置、鉴赏模式、退出游戏。

### 5.9 结局统计（可选）

- 统计已达成的结局，显示结局列表，提示还有多少结局未收集。

## 6. 技术选型

GalGen 采用统一的 **pywebview + Web 前端** 技术栈：管理器端与游戏端均以 HTML/CSS/JS 编写界面，通过 Python 后端提供业务逻辑与文件访问能力。

| 模块 | 方案 | 说明 |
| --- | --- | --- |
| 界面框架 | pywebview | 以系统原生 WebView 承载 HTML/CSS/JS 界面，Python 后端通过 `js_api` 桥接（JS 调用 Python，Python 返回 JSON 可序列化结果），打包体积小、跨平台 |
| 前端实现 | 原生 HTML/CSS/JS | 无构建工具、零依赖；深色侧边栏 + 浅色内容区主题 |
| 数据解析 | 标准库 `json` | `.gg` 文件读写，无第三方依赖 |
| 文件对话框 | pywebview `create_file_dialog` | 打开/保存项目、上传资产、导出文本 |
| 打包工具 | PyInstaller | 生态成熟，支持单文件/目录两种形态；备选 Nuitka |
| 版本控制 | Git | 项目管理与版本回溯 |

## 7. 一键生成 .exe 实现方案

生成流程分为校验、收集、编译、组装、构建、输出六个阶段：

```
管理器项目（.gg + assets）
      │  ① 校验
      ▼
    项目校验（格式、资源引用、脚本跳转完整性）
      │  ② 收集
      ▼
    资源收集（按资产清单复制文件 → 发布目录）
      │  ③ 编译
      ▼
    脚本预编译（.gg → 游戏端紧凑格式，可选）
      │  ④ 组装
      ▼
    发布目录（runtime 模板 + 项目数据）
      │  ⑤ 构建
      ▼
    PyInstaller 打包（自动生成 .spec）
      │  ⑥ 输出
      ▼
  《游戏名》_v版本号.exe
```

各阶段说明：

1. **项目校验**：解析 `.gg` 并检查 `meta.format_version` 兼容性；遍历 `assets` 确认文件存在；校验对话 `jump_to` 跳转目标是否存在；校验章节与结局引用完整性。校验失败时在管理器中定位并高亮错误，阻止生成。
2. **资源收集**：根据 `assets` 清单及 `reference_count`，将引用的资产复制到发布目录 `data/assets/`；未被引用的资产默认不打包，可配置强制包含。
3. **脚本预编译**（可选）：将 `.gg` 解析为游戏端专用紧凑格式（紧凑 JSON 或自定义二进制），缩小体积并加快加载；未启用时直接打包原始 `.gg`。
4. **组装**：将游戏端运行时模板（pywebview + Web 前端）与 `data/` 合并为发布目录，并写入游戏元信息（名称、版本、窗口默认尺寸等）。
5. **构建**：管理器自动生成 PyInstaller `.spec`（含自定义 exe 图标——若设置了 ico 资产、版本信息、可选的 UPX 压缩），调用打包命令生成单文件或目录形态的 `.exe`。
6. **产物输出**：生成 `<游戏名>_v<版本号>.exe` 并放置于项目 `dist/` 目录；支持一键打开所在目录。**生成前自动递增大版本并清零小版本**（可在设置中开关）。

后续 `.apk` 导出可复用本流程的校验、收集、编译、组装阶段，仅替换构建环节（如基于 Kivy + Buildozer 或导出 Web 版后通过 PWA 封装）。

## 8. 建议目录结构

```
galgen/
├── project.md               # 本文档
├── requirements.txt         # 依赖（pywebview、pyinstaller、edge-tts）
├── manager/                 # 管理器端
│   ├── main.py              # pywebview 入口（启动自动最大化）
│   ├── web/                 # 前端静态资源与后端桥接
│   │   ├── index.html       # 单页应用骨架（SVG 图标按钮）
│   │   ├── css/             # 主题样式
│   │   ├── js/              # app.js（核心）/ pages.js（页面）/ plots.js（剧情编辑器）/ vendor/（第三方库）
│   │   └── api.py           # JS API 桥接层（项目/CRUD/资产/校验/导出/AI/字体/UI配置）
│   ├── core/                # 核心逻辑（.gg 读写、校验、导出、配置、资产文件、AI、字体、引用分析）
│   └── builder/             # 生成 / 打包流程（含 exe 图标）
├── runtime/                 # 游戏端运行时模板（pywebview + Web 前端）
│   ├── main.py              # pywebview 入口（参数或最近项目）
│   ├── stage.py             # 装配：.gg + 资产 → 可运行 Web 发布目录
│   ├── web/                 # 游戏前端（阅读 / 分支选项 / 音效 / 视频 / 函数）
│   │   ├── index.html       # 游戏主界面
│   │   ├── css/             # 游戏主题样式
│   │   └── js/game.js       # 引擎：打字机 / 翻页 / 自动 / 快进 / 选项 / 音效 / 视频 / 函数 / 顺序推进
│   └── assets/              # 内置默认 UI 资产
├── docs/                    # 其他文档
└── tests/                   # 自动化测试
```

## 9. 开发路线图

| 阶段 | 目标 | 状态 |
| --- | --- | --- |
| 阶段 1 | `.gg` 文件读写；角色、场景、资产、章节、设置模块 | ✅ 已完成（pywebview 管理器端） |
| 阶段 2 | 剧情编辑器、分支树状图、txt 导出 | ✅ 已完成 |
| 阶段 3 | 游戏端基础阅读系统、分支选项系统 | ✅ 已完成 |
| 阶段 4 | 游戏端存档读档、画廊、音乐室、剧本回想、设置、结局统计 | ✅ 已完成 |
| 阶段 5 | 一键生成 `.exe` | ✅ 已完成 |
| 阶段 6 | AI 配置页、语音生成 | ✅ 已完成（edge-tts，v2.0） |
| 阶段 7 | 一键生成 `.apk` | ⏳ 待开发 |

**v2.0**（2026-08-29）：AI 语音生成、拖拽排序、批量编辑、版本号系统、资产预览与引用分析、性能优化、快捷键。
**v2.1**（2026-08-29）：剧情模型重构（单条单元 + 顺序推进）、音效/视频/函数机制、剧情页两栏布局、exe 图标、功能区宽度持久化。
