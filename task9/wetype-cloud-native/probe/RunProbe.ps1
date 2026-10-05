#requires -Version 5.1
# Read-only WeType diagnostics. No target modification, networking or auto-start.
$ErrorActionPreference = 'Stop'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'This diagnostic requires Windows.'
    }
    if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) {
        throw 'Use 64-bit Windows PowerShell.'
    }
    $root = $PSScriptRoot
    $out = Join-Path $root ('reports\report-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $out -Force | Out-Null
    foreach ($assembly in @('System.Windows.Forms', 'System.Drawing', 'UIAutomationClient', 'UIAutomationTypes', 'WindowsBase', 'System.Web.Extensions')) {
        Add-Type -AssemblyName $assembly
    }
    $references = @(
        [System.Windows.Forms.Form].Assembly.Location,
        [System.Drawing.Point].Assembly.Location,
        [System.Windows.Automation.AutomationElement].Assembly.Location,
        [System.Windows.Automation.AutomationPattern].Assembly.Location,
        [System.Windows.Point].Assembly.Location,
        [System.Web.Script.Serialization.JavaScriptSerializer].Assembly.Location,
        [System.Linq.Enumerable].Assembly.Location,
        [System.Diagnostics.Process].Assembly.Location
    ) | Select-Object -Unique
    Add-Type -Path (Join-Path $root 'NativeProbe.cs') -ReferencedAssemblies $references
    [WeTypeNativeProbe.Entry]::Run($out)

    # OS registry is read, never changed. Names/paths of users are not saved.
    $os = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    [ordered]@{
        CurrentBuild = $os.CurrentBuild
        UBR = $os.UBR
        DisplayVersion = $os.DisplayVersion
        PowerShellVersion = $PSVersionTable.PSVersion.ToString()
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out 'environment.json') -Encoding UTF8

    # No Authenticode chain verification here: certificate validation can trigger network access.
    # Exact file hashes/versions in report.json identify the locally installed build.
    'Diagnostics only. No native candidate patch was applied. See ../先读_当前阶段.md.' |
        Set-Content -LiteralPath (Join-Path $out 'STATUS.txt') -Encoding UTF8
    if (-not (Test-Path -LiteralPath (Join-Path $out 'report.json'))) {
        throw 'No report.json was saved. A partial folder may exist.'
    }
    $zip = $out + '.zip'
    try {
        Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -Force
        Write-Host ('Report ZIP: ' + $zip)
        [System.Windows.Forms.MessageBox]::Show(
            "诊断已保存。它尚未修改候选框。`r`n`r`n结果压缩包：`r`n" + $zip,
            'WeType 原框适配诊断') | Out-Null
    } catch {
        Write-Warning ('ZIP creation failed; the JSON report is preserved in: ' + $out)
        [System.Windows.Forms.MessageBox]::Show('ZIP打包失败，JSON仍保存在：' + $out, '报告已保留') | Out-Null
    }
} catch {
    Write-Host ('Diagnostic failed: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Do not disable Defender or other security protections. Keep this error for review.'
    exit 1
}
