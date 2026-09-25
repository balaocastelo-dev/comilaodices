# =====================================================================
#  WhatsApp Komilão — inicia o conector por QR code
#  Clique com o botão direito > "Executar com o PowerShell"
# =====================================================================
$ErrorActionPreference = 'Stop'
$Pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Pasta
$Host.UI.RawUI.WindowTitle = 'WhatsApp Komilão — NÃO FECHE esta janela'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js não encontrado. Instalando...' -ForegroundColor Yellow
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Write-Host 'Feche e abra de novo este atalho.' -ForegroundColor Yellow
    Read-Host 'Enter para sair'; exit
}
if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Preencha a senha do painel no arquivo .env e salve.' -ForegroundColor Yellow
    Start-Process notepad.exe '.env' -Wait
}
if (-not (Test-Path 'node_modules')) {
    Write-Host 'Instalando (só na primeira vez)...' -ForegroundColor Cyan
    npm install --no-audit --no-fund
}

# Atalho na Área de Trabalho (cria uma vez)
$atalho = Join-Path ([Environment]::GetFolderPath('Desktop')) 'WhatsApp Komilão.lnk'
if (-not (Test-Path $atalho)) {
    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut($atalho)
    $s.TargetPath = 'powershell.exe'
    $s.Arguments = "-ExecutionPolicy Bypass -File `"$Pasta\WhatsApp-Komilao.ps1`""
    $s.WorkingDirectory = $Pasta
    $s.IconLocation = "$env:SystemRoot\System32\shell32.dll,43"
    $s.Save()
}

while ($true) {
    node index.mjs
    Write-Host 'O conector parou. Reiniciando em 10 segundos (feche a janela para encerrar)...' -ForegroundColor Yellow
    Start-Sleep 10
}
