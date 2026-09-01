# 将手机指定目录的音频/指定扩展名文件导出到本地文件夹
# 用法: .\export_files.ps1 -OutDir "C:\out" -Exts ".ncm,.mp3" -Dirs "Download"
param(
    [string]$Device = "Ace",
    [string]$OutDir = "",
    [string]$Exts = ".ncm,.mp3",
    [string]$Dirs = "Download",
    [int]$Depth = 6
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "lib\mtp.ps1")

if (-not $OutDir) { Write-Host "请指定 -OutDir 输出目录" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

$shell = New-Object -ComObject Shell.Application
$localDir = $shell.Namespace($OutDir)

$dev = Find-MtpDevice -NameMatch $Device
if (-not $dev) { Write-Host "NO_DEVICE" -ForegroundColor Red; exit 1 }
$root = Get-MtpRootFolder -Device $dev
if (-not $root) { Write-Host "NO_ROOT" -ForegroundColor Red; exit 1 }

$extList = $Exts -split ',' | ForEach-Object { $_.Trim() }
$dirList = $Dirs -split ',' | ForEach-Object { $_.Trim() }

$files = Get-MtpAudioFiles -StartFolder $root -Depth $Depth -Exts $extList -TargetDirs $dirList
Write-Host ("需导出 " + $files.Count + " 个文件") -ForegroundColor Cyan

# 二次枚举拿到 item 对象并复制（Get-MtpAudioFiles 只返回路径字符串）
$items = $root.Items()
$copied = 0
foreach ($sub in $items) {
    if ($dirList -contains $sub.Name) {
        $sf = $null
        try { $sf = $sub.GetFolder } catch {}
        if ($sf) {
            # 递归收集 item 对象
            $collected = New-Object System.Collections.Generic.List[object]
            function Collect([object]$item, [int]$level) {
                if ($level -gt $Depth) { return }
                $s2 = $null
                try { $s2 = $item.GetFolder } catch {}
                if ($s2) {
                    foreach ($c in $s2.Items()) { Collect $c ($level+1) }
                    return
                }
                $ext = [System.IO.Path]::GetExtension([string]$item.Name)
                if ($ext -and $extList -contains $ext.ToLower()) { $collected.Add($item) }
            }
            foreach ($c in $sf.Items()) { Collect $c 2 }
            foreach ($it in $collected) {
                Write-Host ("exporting: " + $it.Name)
                if (Copy-MtpItemToLocal -SrcItem $it -LocalDir $localDir) { $copied++ }
                Start-Sleep -Milliseconds 1500
            }
        }
    }
}
Write-Host ("导出了 " + $copied + " 个文件到 " + $OutDir) -ForegroundColor Green
