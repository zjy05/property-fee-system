#requires -Version 5.1
<#
  物业收费系统 —— 本地打印助手（针式打印机直打）

  跑在「打印机插着的那台电脑」上，与服务器（Docker / Mac）无关：
  网页点「针式直打」→ 浏览器把票据指令 POST 到本机 127.0.0.1:18181 →
  助手用 Windows 打印接口(GDI+)把票据直接送针式打印机，全程无浏览器打印对话框。

  用法：
    powershell -ExecutionPolicy Bypass -File print-agent.ps1
    powershell -ExecutionPolicy Bypass -File print-agent.ps1 -SelfTest    # 打一张测试页
    powershell -ExecutionPolicy Bypass -File print-agent.ps1 -Port 18181

  说明：指令坐标一律用毫米(mm)，原点在纸的左上角。
  实现分两个文件：本文件是跨平台的 HTTP 服务，print-gdi.ps1 是 Windows 专用绘制。
#>
param(
  [int]$Port = 18181,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$AgentVersion = '1.0.0'

# Windows PowerShell 5.1 没有 $IsWindows 变量；有就按它判断，没有说明本机就是 Windows
$onWindows = $true
if (Get-Variable -Name IsWindows -ErrorAction SilentlyContinue) { $onWindows = $IsWindows }

$LogFile = Join-Path $PSScriptRoot 'print-agent.log'
$CRLF = [string][char]13 + [string][char]10

# 只在 Windows 上加载绘制模块；非 Windows 根本不加载，避免提前编译报错
$hasGdi = $false
$gdiError = ''
if ($onWindows) {
  $gdiPath = Join-Path $PSScriptRoot 'print-gdi.ps1'
  if (Test-Path $gdiPath) {
    try {
      . $gdiPath
      $hasGdi = $true
    } catch {
      $gdiError = $_.Exception.Message
      Write-Host ('[警告] 加载打印模块失败：' + $gdiError)
    }
  } else {
    $gdiError = '缺少 print-gdi.ps1'
  }
}

function Write-Log([string]$msg) {
  $line = '[' + (Get-Date).ToString('HH:mm:ss') + '] ' + $msg
  Write-Host $line
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch { }
}

function Get-PrinterNames {
  if (-not $hasGdi) { return @() }
  try { return (Get-GdiPrinterNames) } catch { return @() }
}

function Get-DefaultPrinterName {
  if (-not $hasGdi) { return '' }
  try { return (Get-GdiDefaultPrinterName) } catch { return '' }
}

function Invoke-PrintJob($job) {
  if (-not $hasGdi) {
    $n = 0
    if ($job.ops) { $n = @($job.ops).Count }
    return @{ ok = $true; dryRun = $true; ops = $n; note = '当前不是 Windows，仅解析指令未打印' }
  }
  return (Invoke-GdiPrintJob $job)
}

# ============================================================
# 极简 HTTP 服务（TcpListener，免管理员、免 URL 授权）
# ============================================================
function Send-Response($stream, [int]$status, [string]$text, [string]$json) {
  $body = [System.Text.Encoding]::UTF8.GetBytes($json)
  $head = 'HTTP/1.1 ' + $status + ' ' + $text + $CRLF +
  'Content-Type: application/json; charset=utf-8' + $CRLF +
  'Content-Length: ' + $body.Length + $CRLF +
  'Access-Control-Allow-Origin: *' + $CRLF +
  'Access-Control-Allow-Headers: *' + $CRLF +
  'Access-Control-Allow-Methods: GET,POST,OPTIONS' + $CRLF +
  'Connection: close' + $CRLF + $CRLF
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

function Read-HttpRequest($stream) {
  $ms = New-Object System.IO.MemoryStream
  $buf = New-Object byte[] 4096
  $latin = [System.Text.Encoding]::GetEncoding(28591)
  $headerText = ''
  $headerEnd = -1
  $contentLength = 0
  $sep = $CRLF + $CRLF
  while ($true) {
    $need = $buf.Length
    if ($headerEnd -ge 0) {
      $need = ($headerEnd + 4 + $contentLength) - [int]$ms.Length
      if ($need -le 0) { break }
      if ($need -gt $buf.Length) { $need = $buf.Length }
    }
    $n = $stream.Read($buf, 0, $need)
    if ($n -le 0) { break }
    $ms.Write($buf, 0, $n)
    if ($headerEnd -lt 0) {
      $headerText = $latin.GetString($ms.ToArray())
      $i = $headerText.IndexOf($sep)
      if ($i -ge 0) {
        $headerEnd = $i
        foreach ($line in ($headerText.Substring(0, $i) -split $CRLF)) {
          if ($line -match '^(?i)Content-Length:\s*(\d+)') { $contentLength = [int]$Matches[1] }
        }
      }
    }
  }
  $all = $ms.ToArray()
  $bodyText = ''
  if ($headerEnd -ge 0 -and $all.Length -gt ($headerEnd + 4)) {
    $bodyText = [System.Text.Encoding]::UTF8.GetString($all, $headerEnd + 4, $all.Length - $headerEnd - 4)
  }
  return @{ header = $headerText; body = $bodyText }
}

function Esc-Json([string]$s) {
  return $s.Replace('\', '\\').Replace('"', '\"')
}

function Handle-Client($client) {
  $stream = $client.GetStream()
  $stream.ReadTimeout = 15000
  $req = Read-HttpRequest $stream
  $header = $req.header
  if ($header -eq '') { return }
  $firstLine = ($header -split $CRLF)[0]
  $parts = $firstLine -split ' '
  $method = 'GET'; $path = '/'
  if ($parts.Length -ge 2) { $method = $parts[0].ToUpper(); $path = $parts[1] }
  $path = ($path -split '\?')[0]

  # CORS 预检（网页以 text/plain 提交可避免预检，这里兜底）
  if ($method -eq 'OPTIONS') { Send-Response $stream 204 'No Content' '{}'; return }

  if ($path -eq '/health') {
    $win = 'false'; if ($onWindows) { $win = 'true' }
    $json = '{"ok":true,"agent":"property-fee-print-agent","version":"' + $AgentVersion +
    '","windows":' + $win + ',"canPrint":' + $(if ($hasGdi) { 'true' } else { 'false' }) +
    ',"defaultPrinter":"' + (Esc-Json (Get-DefaultPrinterName)) +
    '","error":"' + (Esc-Json $gdiError) + '"}'
    Send-Response $stream 200 'OK' $json
    return
  }

  if ($path -eq '/printers') {
    $items = @()
    foreach ($n in (Get-PrinterNames)) { $items += ('"' + (Esc-Json $n) + '"') }
    $json = '{"printers":[' + ($items -join ',') + '],"default":"' + (Esc-Json (Get-DefaultPrinterName)) + '"}'
    Send-Response $stream 200 'OK' $json
    return
  }

  if ($path -eq '/print' -and $method -eq 'POST') {
    try {
      $job = $req.body | ConvertFrom-Json
      if (-not $job.ops) { throw '指令为空' }
      $r = Invoke-PrintJob $job
      $ops = 0
      if ($r.ops) { $ops = $r.ops }
      $dry = 'false'; if ($r.dryRun) { $dry = 'true' }
      $json = '{"ok":true,"ops":' + $ops + ',"dryRun":' + $dry + '}'
      Write-Log ('已受理打印任务：' + $ops + ' 条指令')
      Send-Response $stream 200 'OK' $json
    } catch {
      Write-Log ('打印失败：' + $_.Exception.Message)
      Send-Response $stream 500 'Error' ('{"ok":false,"error":"' + (Esc-Json $_.Exception.Message) + '"}')
    }
    return
  }

  Send-Response $stream 404 'Not Found' '{"ok":false,"error":"未知路径"}'
}

# ============================================================
# 入口
# ============================================================
if ($SelfTest) {
  Write-Log '自检：打印一张测试页…'
  $test = @{
    paper = @{ widthMm = 180; heightMm = 210 }
    ops   = @(
      @{ t = 'rect'; x = 20; y = 20; w = 140; h = 44 },
      @{ t = 'text'; x = 20; y = 24; w = 140; h = 9; text = '打印助手自检'; size = 14; bold = $true; align = 'center' },
      @{ t = 'text'; x = 20; y = 35; w = 140; h = 6; text = ('端口 ' + $Port + ' · ' + (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')); size = 9; align = 'center' },
      @{ t = 'text'; x = 20; y = 43; w = 140; h = 6; text = '看到这张纸说明助手和打印机都通了'; size = 9; align = 'center' },
      @{ t = 'line'; x1 = 20; y1 = 80; x2 = 160; y2 = 80 }
    )
  }
  $res = Invoke-PrintJob $test
  Write-Log ('自检结果：' + ($res | ConvertTo-Json -Compress))
  exit 0
}

Write-Log ('打印助手 v' + $AgentVersion + ' 启动中… Windows=' + $onWindows + ' 可打印=' + $hasGdi)
if ($onWindows) {
  $dp = Get-DefaultPrinterName
  if ($dp -eq '') { Write-Log '默认打印机：(未检测到，请先在系统里把针式打印机设为默认)' } else { Write-Log ('默认打印机：' + $dp) }
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Log ('已就绪：http://127.0.0.1:' + $Port + '   （保持本窗口开着，关掉即停止打印服务）')

while ($true) {
  $client = $listener.AcceptTcpClient()
  try { Handle-Client $client }
  catch { Write-Log ('请求异常：' + $_.Exception.Message) }
  finally { try { $client.Close() } catch { } }
}
