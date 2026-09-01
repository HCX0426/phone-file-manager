# 建立独立 Python venv 并安装 ncm 转换依赖
# 用法: .\setup_venv.ps1 [-VenvDir ".\venv"]
# 说明: 用独立 venv 安装，绝不污染任何已有 conda/项目环境 (本次经验教训)
param(
    [string]$VenvDir = ".\venv"
)
$ErrorActionPreference = "Stop"

$py = $null
foreach ($cand in @(
    "$env:USERPROFILE\AppData\Local\Microsoft\WindowsApps\python.exe",
    (Get-Command python -ErrorAction SilentlyContinue).Source
)) {
    if ($cand -and (Test-Path -LiteralPath $cand)) { $py = $cand; break }
}

# 找一台机器的 python（conda base 或已装解释器，仅作解释器基座）
if (-not $py) {
    $envs = Get-ChildItem "D:\code\environment\conda\envs" -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue
    if ($envs) { $py = $envs[0].FullName }
}
if (-not $py) {
    # 回退到 conda run 发现的任意 python
    $py = (Get-Command python -ErrorAction SilentlyContinue).Source
}
if (-not $py) { Write-Host "未找到可用 python" -ForegroundColor Red; exit 1 }

Write-Host "使用解释器: $py"
$venv = if ([System.IO.Path]::IsPathRooted($VenvDir)) { $VenvDir } else { Join-Path (Get-Location) $VenvDir }
if (-not (Test-Path -LiteralPath $venv)) {
    & $py -m venv --clear $venv
}
$pip = Join-Path $venv "Scripts\pip.exe"
& $pip install --quiet --upgrade pip
Write-Host "安装转换依赖..."
& $pip install --quiet ncmdump imageio-ffmpeg
Write-Host "完成。venv: $venv"
Write-Host "使用: $venv\Scripts\python.exe convert_to_mp3.py -i <dir> -o <dir>"
