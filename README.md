# Phone File Manager（手机文件管理工具）

> 通过 USB（MTP）访问安卓手机，实现**查音乐 / 导出文件 / 推送铃声 / 格式转换**的一体化工具。
> 有 **脚本原型**（PowerShell + Python）与 **桌面 App**（Electron）两套实现。

## 一、这个项目解决什么

用户经常需要给手机"找音乐、设铃声"。本工具把整条链路脚本化、可复用：

1. **发现手机** —— Windows 通过 MTP（无需 adb / 无需 root 手机）识别已连接的安卓手机
2. **扫描音频** —— 遍历手机可见存储里的音乐（Music/Ringtones/Downloads…）
3. **导出文件** —— 把手机里的音乐（含网易云 `.ncm` 加密文件）拷到电脑
4. **格式转换** —— `.ncm` → 原始格式，`.flac` → `.mp3`
5. **推送铃声** —— 把 mp3 写进手机的 `Ringtones`（铃声）目录，铃声列表立即可见

## 二、为什么用 MTP 而不是 adb

| 维度 | MTP（本工具） | adb |
|------|--------------|-----|
| 前置条件 | USB 连上即可（Windows 原生支持） | 手机需开「USB 调试」并在弹窗授权 |
| root | 不需要 | shell 级读写需要部分权限/root |
| 写文件 | 可写（验证可行） | 可写 |
| 访问深度 | 仅用户可见存储（内部存储），**看不到 app 私有目录** | 可访问整个文件系统（含 data 分区） |
| 本机依赖 | Windows Shell COM | 需装 platform-tools / 驱动 |

**结论**：凡是要"用户自己的音乐/铃声"，MTP 足够且零配置；只有当需要访问 **app 私有目录或系统 data 分区**（如从网易云/QQ 音乐缓存里挖已删除的歌、"阳光下的星星"这类自定义铃声存到系统分区）时，才需要 adb。

## 三、目录结构

```
phone-file-manager/
├── docs/
│   └── 技术总结.md            # MTP/adb/ncm/铃声机制 研发记录
├── scripts/                   # 脚本原型（PowerShell + Python）
│   ├── lib/
│   │   └── mtp.ps1            # MTP 公共函数库
│   ├── scan_audio.ps1         # 扫描手机音频文件
│   ├── export_files.ps1       # 从手机导出文件到电脑
│   ├── push_ringtones.ps1     # 推送 mp3 到手机铃声目录
│   ├── convert_to_mp3.py      # ncm / flac → mp3 批量转换
│   └── setup_venv.ps1         # 建独立 venv（隔离依赖，不碰项目环境）
├── electron-app/              # 桌面 App（Electron + React + Antd）
│   ├── src/                   # 主进程/预加载/渲染进程
│   ├── python/                # 转换引擎（libtakiyasha + ffmpeg）
│   └── release/               # 打包产物（绿色版目录 / zip）
└── README.md
```

## 四、快速上手

### 0. 前置：USB 连接 + 手机选择文件传输模式
- 用数据线连手机和电脑，手机上选择 **「文件传输 / MTP」**（不是仅充电）
- 本工具自动读取设备名（默认匹配 `Ace`，可用 `-Device` 覆盖）

### 1. 扫描手机音频
```powershell
.\scripts\scan_audio.ps1
```

### 2. 导出文件（例如网易云 .ncm / .mp3）
```powershell
.\scripts\export_files.ps1 -OutDir .\export -Exts ".ncm,.mp3" -Dirs "Download"
```

### 3. 转成 mp3（ncm/flac → mp3）
```powershell
# 首次：建独立 venv（隔离，不污染任何项目环境）
.\scripts\setup_venv.ps1

# 转换
.\venv\Scripts\python.exe .\scripts\convert_to_mp3.py -i .\export -o .\mp3_out
```

### 4. 推送铃声到手机
```powershell
# 推单个文件
.\scripts\push_ringtones.ps1 -LocalPath ".\mp3_out\我的铃声.mp3"
# 或推整个目录
.\scripts\push_ringtones.ps1 -LocalFolder ".\mp3_out"
```
手机端到 **「设置 → 声音与振动 → 手机铃声」** 选择即可。若没立刻出现，重进设置或重启手机刷新媒体库。

## 五、本次实战关键经验

1. **不要污染已有 conda/项目环境**：ncm 转换依赖装到 `临时独立 venv`，与 GAF 等项目的 python 环境完全隔离（本工具 `setup_venv.ps1` 固化此做法）。
2. **MTP 写文件可行**：`ShellFolder.CopyHere(文件, 0x814)` 可把本地 mp3 写进手机目录（0x814 = 静默 + 无进度 + 允许撤销）。
3. **文件名中文编码**：PowerShell 5.1 控制台 GBK 显示中文会乱码，但**文件实际是正确 UTF-8**，手机文件管理器里显示正常；用 python 处理中文文件名最稳。
4. **标准铃声目录经常是空的**：自定义/下载铃声可能存 app 私有或系统分区（MTP 看不到）；标准 `Ringtones` 目录里没有才是要额外查 adb 的信号。
5. **`.ncm` 解密**：要么是 mp3 要么是 flac，需按原始格式处理（flac 再转 mp3）。

## 六、状态标记

### 脚本原型（PowerShell + Python）

- ✅ MTP 扫描 / 导出 / 推送铃声 —— 已验证可用
- ✅ ncm→mp3 / flac→mp3 转换 —— 已验证可用
- 🔧 重复文件清理 / 删除 —— 脚本有但删除偶发需交互，待完善
- 🔧 adb 深度访问（app 私有目录）—— 方案可行但需开启 USB 调试，未在本机打通

### 桌面 App（Electron）— 新版

- ✅ Electron 项目脚手架（electron-vite + React + Antd）
- ✅ MTP 设备检测 / 音频扫描 / 导出 / 推送 集成
- ✅ 格式转换引擎（ncm / mflac / mgg / kgm / kwm → mp3/flac，基于 libtakiyasha）
- ✅ GUI：设备面板 / 文件列表 / 转换设置 / 进度条
- ✅ 打包：绿色版目录 `release/win-unpacked` + zip 压缩包
- 🔧 portable 单 exe / NSIS 安装包 —— 本机缺管理员权限（符号链接）导致 winCodeSign 解压失败，需在有权限环境打包

> 详细技术细节见 `docs/技术总结.md`；桌面 App 开发说明见 `electron-app/README.md`。

## 七、Git 注意事项

- 项目根有 `.gitignore`：已排除 `node_modules/`、`out/`、`release/`、`*.log`、以及 Python venv（`electron-app/python/venv/`，内含数千包文件）。
- 用 `git init` 前请确认 `.gitignore` 生效，避免把构建产物与 venv 提交进去。
