#requires -Version 5.1
param([switch]$SkipInstallerDownload)
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Windows required' }
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'build'
New-Item -ItemType Directory -Path $out -Force | Out-Null
foreach ($assembly in @('System.Windows.Forms','System.Drawing','UIAutomationClient','UIAutomationTypes','WindowsBase','System.Web.Extensions')) { Add-Type -AssemblyName $assembly }
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
# Compile the prior read-only discovery editor. It is intentionally not launched.
Add-Type -Path (Join-Path $root 'probe\NativeProbe.cs') -ReferencedAssemblies $references
Write-Output 'TASK9_P0_NATIVE_DIAGNOSTIC_COMPILE=passed'
Add-Type -Path (Join-Path $root 'probe\SessionProbe.cs') -ReferencedAssemblies $references
[Task9SessionProbe.Entry]::Run((Join-Path $out 'session-probe.json'))
# Only known runner metadata is logged. No environment/credentials dump.
$os = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
[ordered]@{ imageOS=$env:ImageOS; imageVersion=$env:ImageVersion; build=$os.CurrentBuild; ubr=$os.UBR; powershell=$PSVersionTable.PSVersion.ToString() } | ConvertTo-Json -Compress | ForEach-Object { Write-Output ('TASK9_RUNNER_JSON=' + $_) }

if ($SkipInstallerDownload) {
    Write-Output 'TASK9_INSTALLER_STATUS=skipped_for_source_lifecycle_regression'
    Write-Output 'TASK9_NATIVE_CANDIDATE_STATUS=not_tested_no_WeType_install_or_adapter'
    return
}

# Download and verify one official installer only. NEVER execute or accept terms here.
$url = 'https://download.z.weixin.qq.com/app/win/WeTypeSetup_3.0.0.17_3.exe'
$expected = '2C16D2BC39E4315817DE7CD6C10D30C1A9D3B5A57EA6373638C2FDEFB86F63AD'
$installer = Join-Path $out 'WeTypeSetup_3.0.0.17_3.exe'
$installReport = [ordered]@{ url=$url; manifestVersion='3.0.0.17'; expectedSha256=$expected; downloaded=$false; hashVerified=$false; executed=$false }
try {
    Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing -TimeoutSec 90
    $hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
    $installReport.downloaded = $true
    $installReport.actualSha256 = $hash
    $installReport.bytes = (Get-Item -LiteralPath $installer).Length
    $installReport.hashVerified = $hash -eq $expected
    if ($installReport.hashVerified) {
        $v = [Diagnostics.FileVersionInfo]::GetVersionInfo($installer)
        $installReport.fileVersion = $v.FileVersion
        $installReport.productVersion = $v.ProductVersion
        $signature = Get-AuthenticodeSignature -LiteralPath $installer
        $installReport.signatureStatus = $signature.Status.ToString()
        $installReport.signerSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    }
} catch { $installReport.errorType = $_.Exception.GetType().Name }
$installReport | ConvertTo-Json -Compress | ForEach-Object { Write-Output ('TASK9_INSTALLER_JSON=' + $_) }
Write-Output 'TASK9_NATIVE_CANDIDATE_STATUS=not_tested_no_WeType_install_or_adapter'
