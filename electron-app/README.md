# Phone File Manager (Desktop)

基于 Electron 的手机文件管理桌面应用。通过 USB（MTP）访问安卓手机，实现查音乐、导出文件、推送铃声、格式转换。

## 功能

- **设备检测**：USB MTP 自动识别安卓手机（无需 adb，无需 root）
- **音频扫描**：遍历手机 Music/Ringtones/Download 等目录的音频文件
- **格式转换**：`ncm` / `mflac` / `mgg` / `kgm` / `kwm` → `mp3` / `flac`（基于 libtakiyasha + ffmpeg）
- **导出文件**：手机 → 电脑
- **推送铃声**：电脑 → 手机 Ringtones 目录

## 开发

```bash
npm install            # 安装依赖（含 electron 二进制下载）
python/venv            # 转换引擎依赖（libtakiyasha + imageio-ffmpeg）
npm run dev            # 启动开发模式
npm run build          # 构建产物到 out/
```

### Python 转换引擎

转换依赖 Python，需准备独立 venv：

```bash
python -m venv python\venv
python\venv\Scripts\pip install libtakiyasha imageio-ffmpeg pillow
```

主进程 `src/main/converter/convert.ts` 会从 `process.resourcesPath/python`（打包后）或项目根 `python/decode.py`（开发）查找并调用。

## 打包

```bash
npm run make-icon     # 生成应用图标 resources/icon.ico
npm run package       # 构建绿色版目录 release/win-unpacked
npm run package:zip   # 构建并压缩为 release/phone-file-manager-1.0.0-win64.zip
npm run package:setup # 构建 NSIS 安装包（需签名权限环境）
```

> 注：本机因无管理员权限（无法创建符号链接）导致 `portable`/`nsis` 目标触发 winCodeSign 解压失败。
> 已改用 `signAndEditExecutable=false` 的 `dir` 目标产出绿色目录，再压缩为 zip 分发。

## 目录结构

```
electron-app/
├── electron.vite.config.ts
├── package.json
├── src/
│   ├── main/               # Electron 主进程
│   │   ├── index.ts        # 入口
│   │   ├── ipc-handlers.ts # IPC 注册
│   │   ├── mtp/device.ts   # MTP 设备通信（PowerShell Shell COM）
│   │   └── converter/      # 格式转换（调用 python decode.py）
│   ├── preload/            # 预加载桥接
│   └── renderer/           # React UI
│       └── src/components/ # 设备面板/文件列表/转换设置/进度
├── python/
│   ├── decode.py           # 通用解密/转码脚本（libtakiyasha + ffmpeg）
│   └── venv/               # Python 独立环境（不提交）
├── resources/              # 应用图标
├── scripts/make_icon.py    # 图标生成脚本
└── release/                # 打包产物
```

## 常见问题

- **PowerShell 中文乱码**：主进程已强制 `[Console]::OutputEncoding = UTF8`，文件名为真实 UTF-8，无需处理。
- **未检测到手机**：确认 USB 连接 + 手机端选择「文件传输 / MTP」模式。
- **转换失败**：确认 venv 已装 `libtakiyasha imageio-ffmpeg`；QQ 音乐新版 `musicex` 格式需额外 ekey，暂不支持。

## License

MIT