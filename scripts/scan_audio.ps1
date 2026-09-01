# 扫描手机上可见的音频文件（无需 adb，走 MTP）
# 用法: .\scan_audio.ps1 [-Device "Ace"] [-Dirs "Music,Ringtones"]
param(
    [string]$Device = "Ace",
    [string]$Exts = ".mp3,.m4a,.ogg,.flac,.wav,.opus,.aac,.amr,.ncm",
    [string]$Dirs = "Music,Ringtones,Notifications,Alarms,Download,DCIM,Recordings,Audiobooks,ColorOS,qqmusic,MIUI"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "lib\mtp.ps1")

$dev = Find-MtpDevice -NameMatch $Device
if (-not $dev) { Write-Host "NO_DEVICE: 未找到 $Device" -ForegroundColor Red; exit 1 }
$root = Get-MtpRootFolder -Device $dev
if (-not $root) { Write-Host "NO_ROOT: 无法访问内部存储" -ForegroundColor Red; exit 1 }

$extList = $Exts -split ',' | ForEach-Object { $_.Trim() }
$dirList = $Dirs -split ',' | ForEach-Object { $_.Trim() }

$files = Get-MtpAudioFiles -StartFolder $root -Exts $extList -TargetDirs $dirList
$files | Sort-Object
Write-Host ("TOTAL=" + $files.Count) -ForegroundColor Green
