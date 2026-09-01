# MTP 设备访问公共库
# 用法: . .\lib\mtp.ps1
# 依赖: Windows Shell.Application COM (PowerShell 5.1+)

# 按名称片段查找 MTP 设备，返回 ShellFolder item（设备根）
function Find-MtpDevice {
    param([string]$NameMatch = '')
    $shell = New-Object -ComObject Shell.Application
    $items = $shell.Namespace(17).Items()   # 17 = 我的电脑
    foreach ($d in $items) {
        if ($d.Name -match $NameMatch) { return $d }
    }
    return $null
}

# 进入设备的"内部存储"根目录（ShellFolder）
function Get-MtpRootFolder {
    param([object]$Device)
    $inner = $null
    foreach ($sub in $Device.GetFolder.Items()) { $inner = $sub; break }
    if (-not $inner) { return $null }
    return $inner.GetFolder
}

# 在根目录下按名称查找子目录，返回 ShellFolder item
function Find-MtpChildFolder {
    param([object]$RootFolder, [string]$Name)
    foreach ($sub in $RootFolder.Items()) {
        if ($sub.Name -eq $Name) { return $sub }
    }
    return $null
}

# 递归枚举：找到所有匹配扩展名的文件，返回 @( "路径\文件名" ) 列表
function Get-MtpAudioFiles {
    param(
        [object]$StartFolder,
        [int]$Depth = 6,
        [string[]]$Exts = @('.mp3','.m4a','.ogg','.flac','.wav','.opus','.aac','.amr','.ncm'),
        [string[]]$TargetDirs = @('Music','Ringtones','Notifications','Alarms','Download','DCIM','Recordings','Audiobooks','ColorOS','qqmusic','MIUI')
    )
    $results = New-Object System.Collections.Generic.List[string]
    $startIsItem = $false

    function Traverse([object]$item, [int]$level, [string]$label) {
        if ($level -gt $Depth) { return }
        $sf = $null
        try { $sf = $item.GetFolder } catch {}
        if ($sf) {
            $items = $null
            try { $items = $sf.Items() } catch {}
            if ($items) {
                foreach ($ch in $items) {
                    Traverse $ch ($level+1) ($label + '\' + $item.Name)
                }
            }
            return
        }
        $ext = [System.IO.Path]::GetExtension([string]$item.Name)
        if ($ext -and $Exts -contains $ext.ToLower()) {
            $results.Add(($label + '\' + $item.Name))
        }
    }

    # StartFolder 传 root：遍历其目标子目录
    $items = $StartFolder.Items()
    foreach ($sub in $items) {
        if ($TargetDirs -contains $sub.Name) {
            $sf = $null
            try { $sf = $sub.GetFolder } catch {}
            if ($sf) {
                Write-Host ("scanning: " + $sub.Name) -ForegroundColor DarkGray
                foreach ($ch in $sf.Items()) {
                    Traverse $ch 2 $sub.Name
                }
            }
        }
    }
    return $results
}

# 从手机复制文件到本地目录。$SrcItem 为 MTP 文件 item；$LocalDir 为本地 Shell folder 对象
function Copy-MtpItemToLocal {
    param([object]$SrcItem, [object]$LocalDir)
    try {
        $LocalDir.CopyHere($SrcItem, 0x814)   # 0x814 = 静默 + 无进度 + 允许撤销
        return $true
    } catch {
        Write-Host ("copy error: " + $_.Exception.Message) -ForegroundColor Yellow
        return $false
    }
}

# 将本地文件复制进手机文件夹。$DestFolder 为目标 ShellFolder item 的 .GetFolder()
function Push-LocalFile {
    param([string]$LocalPath, [object]$DestFolder)
    try {
        $DestFolder.CopyHere($LocalPath, 0x814)
        Start-Sleep -Seconds 4
        return $true
    } catch {
        Write-Host ("push error: " + $_.Exception.Message) -ForegroundColor Yellow
        return $false
    }
}
