# Phone File Manager Skill

通过 USB (MTP) 访问安卓手机，实现**扫描音频 / 导出文件 / 推送铃声 / 格式转换**。

## 适用场景
- 手机已用 USB 连接电脑，并在手机端选择「文件传输 / MTP」模式
- 需要把手机里的音乐/铃声导出、或把电脑 mp3 推送为手机铃声
- 需要把网易云 `.ncm` 解密为 mp3

## 使用前提
- Windows 10/11 + PowerShell 5.1+（自带 Shell.Application COM）
- Python 3.11+（用于 ncm/flac 转换，脚本会自动建独立 venv 不污染环境）

## 快速开始

```powershell
# 1. 进入项目目录
cd C:\Users\hcx\Desktop\phone-file-manager

# 2. 扫描手机音频（默认匹配设备名含 "Ace"）
.\scripts\scan_audio.ps1

# 3. 导出手机文件到电脑（例：下载目录的 .ncm 和 .mp3）
.\scripts\export_files.ps1 -OutDir .\export -Exts ".ncm,.mp3" -Dirs "Download"

# 4. 首次转换前：建独立 venv 安装依赖（一次即可）
.\scripts\setup_venv.ps1

# 5. ncm/flac 批量转 mp3
.\venv\Scripts\python.exe .\scripts\convert_to_mp3.py -i .\export -o .\mp3_out

# 6. 推送 mp3 到手机铃声目录
.\scripts\push_ringtones.ps1 -LocalFolder .\mp3_out
```

手机端到 **设置 → 声音与振动 → 手机铃声** 即可看到新推送的铃声。

## 脚本说明

| 脚本 | 功能 | 关键参数 |
|------|------|----------|
| `scan_audio.ps1` | 扫描手机可见存储里的音频文件 | `-Device "设备名片段" -Exts ".mp3,.flac" -Dirs "Music,Ringtones"` |
| `export_files.ps1` | 从手机导出指定目录/扩展名文件到本地 | `-OutDir "输出目录" -Exts ".ncm,.mp3" -Dirs "Download"` |
| `push_ringtones.ps1` | 把本地 mp3 推送到手机 Ringtones | `-LocalPath "单文件" 或 -LocalFolder "整目录" -TargetDir "Ringtones"` |
| `convert_to_mp3.py` | ncm 解密 + flac→mp3 统一输出 mp3 | `-i 输入目录 -o 输出目录` |
| `setup_venv.ps1` | 创建隔离 venv 并装 ncmdump + imageio-ffmpeg | `-VenvDir ".\venv"` |

## 目录结构
```
phone-file-manager/
├── scripts/
│   ├── lib/mtp.ps1          # MTP 公共库
│   ├── scan_audio.ps1
│   ├── export_files.ps1
│   ├── push_ringtones.ps1
│   ├── convert_to_mp3.py
│   └── setup_venv.ps1
├── docs/
│   ├── 技术总结.md          # MTP/adb/ncm/铃声机制详细记录
│   └── 未来方向.md          # 形态取舍思考
├── examples/                # 实战原始脚本样本
└── README.md
```

## 核心技术要点
- **MTP 读写**：`Shell.Application` COM，`Namespace(17)` 枚举设备 → `GetFolder()` 进内部存储 → `CopyHere(..., 0x814)` 读写文件
- **铃声机制**：把 mp3 放进 `Ringtones` 目录即可自动进系统铃声列表（无需重启，偶需重进设置刷新）
- **.ncm 解密**：`ncmdump` 库解密 → 原始格式可能是 mp3 或 flac，flac 再用 `ffmpeg` 转 mp3
- **环境隔离**：转换依赖装独立 venv，绝不碰已有 conda/项目 env（避免污染）

## 常见问题
- **PowerShell 控制台中文乱码**：文件实际是 UTF-8，手机文件管理器显示正常；用 python 处理中文名最稳
- **MTP 删除文件弹确认框**：`InvokeVerb('delete')` 会在手机端弹确认，需用户手动点确认
- **设备名匹配**：脚本默认匹配 `Ace`，换手机用 `-Device "片段"`
- **标准铃声目录常是空的**：自定义铃声可能存 app 私有/系统分区（MTP 看不到），需开 USB 调试用 adb

## 版本记录
- v0.1 (2026-08) —— 首个可用原型，含 MTP 库、扫描/导出/推送/转换脚本、文档

## 后续演进方向
见 `docs/未来方向.md`：桌面 GUI App (Tauri/WPF/Electron) vs 手机 App (免电脑) 的取舍。