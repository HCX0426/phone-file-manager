# 将本地 mp3 推送到手机 Ringtones（铃声）目录
# 用法: .\push_ringtones.ps1 -LocalPath "C:\m\ring.mp3"  (支持 -LocalFolder 整目录)
param(
    [string]$Device = "Ace",
    [string]$LocalPath = "",
    [string]$LocalFolder = "",
    [string]$TargetDir = "Ringtones"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "lib\mtp.ps1")

$dev = Find-MtpDevice -NameMatch $Device
if (-not $dev) { Write-Host "NO_DEVICE" -ForegroundColor Red; exit 1 }
$root = Get-MtpRootFolder -Device $dev
if (-not $root) { Write-Host "NO_ROOT" -ForegroundColor Red; exit 1 }
$targetItem = Find-MtpChildFolder -RootFolder $root -Name $TargetDir
if (-not $targetItem) { Write-Host "NO_TARGET: 手机无 $TargetDir 目录" -ForegroundColor Red; exit 1 }
$targetFolder = $targetItem.GetFolder

# 收集要推送的文件
$files = @()
if ($LocalPath) {
    if (Test-Path -LiteralPath $LocalPath) { $files += Get-Item -LiteralPath $LocalPath }
    else { Write-Host "文件不存在: $LocalPath" -ForegroundColor Red; exit 1 }
}
if ($LocalFolder) {
    if (Test-Path -LiteralPath $LocalFolder) { $files += Get-ChildItem -LiteralPath $LocalFolder -File }
    else { Write-Host "目录不存在: $LocalFolder" -ForegroundColor Red; exit 1 }
}
if ($files.Count -eq 0) { Write-Host "未指定要推送的文件" -ForegroundColor Yellow; exit 1 }

foreach ($f in $files) {
    Write-Host ("pushing: " + $f.Name)
    Push-LocalFile -LocalPath $f.FullName -DestFolder $targetFolder
}

Write-Host "--- 手机 $TargetDir 目录当前文件 ---"
foreach ($x in $targetFolder.Items()) {
    Write-Host ("  [" + $x.Name + "]")
}
