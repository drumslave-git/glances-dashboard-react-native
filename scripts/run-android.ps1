<#
    Builds, installs and launches the Android dev build on a running emulator.

    Why this script exists: the Android emulator images used here bring up both
    eth0 (10.0.2.15) and wlan0 (10.0.2.16) on the same 10.0.2.0/24 subnet with no
    default route. Android prefers wlan0, where the host alias 10.0.2.2 does not
    exist, so the app cannot reach Metro on its own — and Expo Go cannot download
    a bundle at all. The workaround is to tunnel Metro over adb and point React
    Native's dev server setting at 127.0.0.1.

    Usage:  npm run android:emulator                 (start `npx expo start` separately)
            npm run android:emulator -- -MetroPort 8681

    -MetroPort is for machines where Metro cannot bind 8081. Windows reserves TCP
    ranges for Hyper-V/WSL — here that included 8081-8580 — and Expo then reports
    the port "in use" while netstat shows nothing listening. Check with
    `netsh int ipv4 show excludedportrange protocol=tcp`; the ranges move on reboot.

    Only the *host* side moves: `adb reverse` maps the device's 8081 to whatever
    port Metro is really on, so the app's own dev-server setting stays 8081 and
    nothing on the device has to know.
#>

param(
    [int]$MetroPort = 8081
)

$ErrorActionPreference = 'Stop'

$pkg = 'com.glancesdashboard.app'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = Join-Path $sdk 'platform-tools\adb.exe'

if (-not (Test-Path $adb)) { throw "adb not found at $adb. Set ANDROID_HOME." }

# The Android Gradle Plugin's CMake step fails on JDK 24+ ("restricted method in
# java.lang.System"), so prefer a JDK 17 — Gradle provisions one under ~/.gradle/jdks.
$jdk17 = Get-ChildItem "$env:USERPROFILE\.gradle\jdks" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '-17-' -and (Test-Path (Join-Path $_.FullName 'bin\java.exe')) } |
    Select-Object -First 1
if ($jdk17) {
    $env:JAVA_HOME = $jdk17.FullName
} elseif (-not $env:JAVA_HOME) {
    throw 'No JDK 17 found. Install one, or set JAVA_HOME to a JDK 17 (JDK 24+ breaks the CMake step).'
}
Write-Host "JAVA_HOME = $env:JAVA_HOME"

$env:ANDROID_HOME = $sdk
$env:Path = "$env:JAVA_HOME\bin;$env:Path;$sdk\platform-tools"

$devices = (& $adb devices) -match 'device$'
if (-not $devices) { throw 'No device/emulator attached. Start one first (see AGENTS.md).' }

# Repair the emulator's networking. The images bring up a phantom wlan0 on the same
# subnet as eth0 and Android prefers it, leaving the device with no usable route to
# anything -- which also means the app cannot reach a Glances server. Disabling Wi-Fi
# hands the default network back to eth0, which has `default via 10.0.2.2`.
# Only possible on google_apis images; Play Store images refuse `adb root`.
$rootResult = (& $adb root 2>&1) -join ' '
if ($rootResult -notmatch 'cannot run as root') {
    Start-Sleep -Seconds 3
    & $adb wait-for-device
    & $adb shell svc wifi disable 2>$null
    Start-Sleep -Seconds 3
    $routes = (& $adb shell ip route show table eth0 2>$null) -join ' '
    if ($routes -match 'default via') {
        Write-Host 'Emulator networking OK (default route via eth0).'
    } else {
        Write-Warning 'No default route on eth0 -- the app may not reach a Glances server.'
    }
} else {
    Write-Warning 'Cannot adb root (Play Store image). If the app cannot reach the network, use a google_apis AVD.'
}

# x86_64 only: the emulator is x86_64, and building the arm ABIs roughly triples build time.
Push-Location (Join-Path $projectRoot 'android')
try {
    & .\gradlew.bat installDebug -PreactNativeArchitectures=x86_64 --console=plain
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed ($LASTEXITCODE)." }
} finally {
    Pop-Location
}

# Tunnel Metro over adb, bypassing the emulator's broken host routing. The device end is always
# 8081 so the app's dev-server setting never changes; only the host end follows -MetroPort.
& $adb reverse --remove-all 2>$null
& $adb reverse tcp:8081 "tcp:$MetroPort" | Out-Null

# Point React Native's dev-server setting at the tunnel. Persists until uninstall.
$prefs = Join-Path $env:TEMP 'rn-debug-host-prefs.xml'
Set-Content -Path $prefs -Encoding utf8 -Value @"
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="debug_http_host">127.0.0.1:8081</string>
</map>
"@
& $adb shell am force-stop $pkg
& $adb push $prefs /data/local/tmp/rn-prefs.xml | Out-Null
& $adb shell "run-as $pkg mkdir -p /data/data/$pkg/shared_prefs" | Out-Null
& $adb shell "run-as $pkg cp /data/local/tmp/rn-prefs.xml /data/data/$pkg/shared_prefs/${pkg}_preferences.xml"

& $adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Host "Launched $pkg. Make sure Metro is running on host port $MetroPort."
