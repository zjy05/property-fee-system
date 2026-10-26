# ============================================================
#  Windows 专用：GDI+ 打印实现
#  只在 Windows 上被 print-agent.ps1 点源加载。
#  （System.Drawing 在 macOS/Linux 上不存在，放在单独文件里可以避免
#    PowerShell 提前编译导致启动即报错。）
# ============================================================

Add-Type -AssemblyName System.Drawing | Out-Null

$script:JobOps = @()
$script:JobBlack = $null
$script:JobPen = $null

function Get-GdiPrinterNames {
  $names = @()
  foreach ($p in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) { $names += [string]$p }
  return $names
}

function Get-GdiDefaultPrinterName {
  $ps = New-Object System.Drawing.Printing.PrinterSettings
  return [string]$ps.PrinterName
}

function Invoke-GdiPrintJob($job) {
  $doc = New-Object System.Drawing.Printing.PrintDocument
  if ($job.printer -and $job.printer -ne '') { $doc.PrinterSettings.PrinterName = [string]$job.printer }
  if (-not $doc.PrinterSettings.IsValid) {
    throw ('找不到打印机：' + $job.printer + '（请确认打印机名称，或清空 printer 字段改用默认打印机）')
  }

  $w = [int]([double]$job.paper.widthMm / 25.4 * 100)
  $h = [int]([double]$job.paper.heightMm / 25.4 * 100)
  # 纸张尺寸：优先在驱动已定义的纸张里按尺寸匹配（针式打印机通常在驱动里预定义
  # 180x210 表单）。匹配不到才用自定义尺寸——注意部分驱动会忽略自定义尺寸并回退
  # 到默认纸（实测 Microsoft Print To PDF 就会回退 A4）。
  $matched = $null
  foreach ($p in $doc.PrinterSettings.PaperSizes) {
    if ([Math]::Abs([int]$p.Width - $w) -le 8 -and [Math]::Abs([int]$p.Height - $h) -le 8) { $matched = $p; break }
  }
  if ($matched) {
    $doc.DefaultPageSettings.PaperSize = $matched
  } else {
    $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Receipt', $w, $h)
  }
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.OriginAtMargins = $true
  # StandardPrintController = 静默打印，不弹系统打印进度框
  $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

  $script:JobOps = @($job.ops)
  $script:JobBlack = [System.Drawing.Brushes]::Black
  $script:JobPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 0.2)

  $doc.add_PrintPage({
      param($sender, $e)
      $g = $e.Graphics
      $g.PageUnit = [System.Drawing.GraphicsUnit]::Millimeter
      $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
      foreach ($op in $script:JobOps) {
        $t = [string]$op.t
        if ($t -eq 'line') {
          $g.DrawLine($script:JobPen, [float]$op.x1, [float]$op.y1, [float]$op.x2, [float]$op.y2)
        }
        elseif ($t -eq 'rect') {
          $g.DrawRectangle($script:JobPen, [float]$op.x, [float]$op.y, [float]$op.w, [float]$op.h)
        }
        elseif ($t -eq 'text') {
          $style = [System.Drawing.FontStyle]::Regular
          if ($op.bold) { $style = [System.Drawing.FontStyle]::Bold }
          $size = 9.0
          if ($op.size) { $size = [double]$op.size }
          $font = New-Object System.Drawing.Font('宋体', [float]$size, $style, [System.Drawing.GraphicsUnit]::Point)
          $sf = New-Object System.Drawing.StringFormat
          $align = [string]$op.align
          if ($align -eq 'center') { $sf.Alignment = [System.Drawing.StringAlignment]::Center }
          elseif ($align -eq 'right') { $sf.Alignment = [System.Drawing.StringAlignment]::Far }
          else { $sf.Alignment = [System.Drawing.StringAlignment]::Near }
          $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
          $sf.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
          $x = [float]$op.x; $y = [float]$op.y
          $w2 = 0.0; $h2 = 0.0
          if ($op.w) { $w2 = [float]$op.w }
          if ($op.h) { $h2 = [float]$op.h }
          if ($w2 -le 0) { $w2 = 200.0 }
          if ($h2 -le 0) { $h2 = 6.0 }
          $rect = New-Object System.Drawing.RectangleF($x, $y, $w2, $h2)
          $g.DrawString([string]$op.text, $font, $script:JobBlack, $rect, $sf)
          $font.Dispose()
          $sf.Dispose()
        }
      }
      $e.HasMorePages = $false
    })

  $copies = 1
  if ($job.copies) { $copies = [int]$job.copies }
  if ($copies -lt 1) { $copies = 1 }
  $printerName = [string]$doc.PrinterSettings.PrinterName
  for ($i = 0; $i -lt $copies; $i++) { $doc.Print() }
  $doc.Dispose()
  return @{ ok = $true; printer = $printerName; copies = $copies; ops = @($job.ops).Count }
}
