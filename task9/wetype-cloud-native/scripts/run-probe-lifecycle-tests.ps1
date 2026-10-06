#requires -Version 5.1
# Fresh Windows PowerShell process, no policy bypass or installer invocation.
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'Windows required for NativeProbe framework references' }
$root = Split-Path $PSScriptRoot -Parent
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
Add-Type -Path @((Join-Path $root 'probe\NativeProbe.cs'), (Join-Path $root 'tests\CaptureScopeTests.cs'), (Join-Path $root 'tests\WinFormsLifecycleTests.cs')) -ReferencedAssemblies $references
Write-Output 'TASK9_LIFECYCLE_CSHARP_COMPILE=passed'
[WeTypeNativeProbe.CaptureScopeTests]::Run()
[WeTypeNativeProbe.WinFormsLifecycleTests]::Run((Join-Path $root 'build\lifecycle-owned-window'))
