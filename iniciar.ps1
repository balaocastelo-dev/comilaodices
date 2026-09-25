# =====================================================================
#  DOCES KOMILÃO — lançador único
#  Clique com o botão direito > "Executar com o PowerShell"
#  ou:  powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
# =====================================================================
$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Raiz
$Host.UI.RawUI.WindowTitle = 'Doces Komilão'

function Titulo {
    Clear-Host
    Write-Host ''
    Write-Host '   ==============================================' -ForegroundColor Yellow
    Write-Host '        DOCES KOMILÃO  -  painel de controle      ' -ForegroundColor Yellow
    Write-Host '   ==============================================' -ForegroundColor Yellow
    Write-Host ''
}

function Ok($m)   { Write-Host "   [OK] $m" -ForegroundColor Green }
function Info($m) { Write-Host "   [..] $m" -ForegroundColor Cyan }
function Erro($m) { Write-Host "   [X]  $m" -ForegroundColor Red }

function Achar-Python {
    foreach ($c in @('py', 'python', 'python3')) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if ($cmd) {
            try { $v = & $c --version 2>&1; if ($v -match 'Python 3') { return $c } } catch {}
        }
    }
    return $null
}

function Captar-Leads {
    $py = Achar-Python
    if (-not $py) {
        Erro 'Python 3 não encontrado.'
        Info 'Instalando pelo winget (Python 3.12)...'
        winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        Info 'Feche e abra este lançador de novo para continuar.'
        return
    }
    Info "Usando $py. Buscando padarias, lanchonetes, bares e mercearias em Campinas e região..."
    Info 'Isso leva de 3 a 10 minutos. Cidades já baixadas ficam em cache (use a opção 2 para atualizar tudo).'
    & $py (Join-Path $Raiz 'leads\captar_leads.py') @args
    $painel = Join-Path $Raiz 'leads\saida\painel_leads.html'
    if (Test-Path $painel) {
        $desk = [Environment]::GetFolderPath('Desktop')
        Copy-Item $painel (Join-Path $desk 'Leads Komilao.html') -Force
        Ok "Painel copiado para a Área de Trabalho: 'Leads Komilao.html'"
        Start-Process $painel
    }
}

function Abrir-Painel {
    $painel = Join-Path $Raiz 'leads\saida\painel_leads.html'
    if (Test-Path $painel) { Start-Process $painel; Ok 'Painel aberto.' }
    else { Erro 'Painel ainda não gerado. Use a opção 1.' }
}

function Rodar-App {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Erro 'Node.js não encontrado. Instalando o Node 22 LTS pelo winget...'
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Info 'Feche e abra este lançador de novo para continuar.'
        return
    }
    $app = Join-Path $Raiz 'app'
    Set-Location $app
    $envFile = Join-Path $app '.env.local'
    if (-not (Test-Path $envFile)) {
        Copy-Item (Join-Path $app '.env.example') $envFile
        Info 'Criei app\.env.local. Preencha a URL e as chaves do Supabase e salve.'
        Start-Process notepad.exe $envFile -Wait
    }
    if (-not (Test-Path (Join-Path $app 'node_modules'))) {
        Info 'Instalando dependências (primeira vez, alguns minutos)...'
        npm install --no-audit --no-fund
    }
    Ok 'Abrindo http://localhost:3000 (loja) e /admin (painel). Ctrl+C para parar.'
    Start-Job { Start-Sleep 8; Start-Process 'http://localhost:3000' } | Out-Null
    npm run dev
    Set-Location $Raiz
}

function Testar-Build {
    Set-Location (Join-Path $Raiz 'app')
    if (-not (Test-Path 'node_modules')) { npm install --no-audit --no-fund }
    Info 'Rodando build de produção (o mesmo que o Coolify vai fazer)...'
    npm run build
    if ($LASTEXITCODE -eq 0) { Ok 'Build OK — pronto para o deploy.' } else { Erro 'Build falhou. Veja as mensagens acima.' }
    Set-Location $Raiz
}

while ($true) {
    Titulo
    Write-Host '   1) Captar leads (Campinas e região) e abrir painel'
    Write-Host '   2) Captar leads do zero (ignora cache)'
    Write-Host '   3) Abrir painel de leads'
    Write-Host '   4) Rodar loja + painel admin no computador'
    Write-Host '   5) Testar build de produção'
    Write-Host '   6) Abrir guia de deploy no Coolify'
    Write-Host '   0) Sair'
    Write-Host ''
    $op = Read-Host '   Escolha'
    try {
        switch ($op) {
            '1' { Captar-Leads }
            '2' { Captar-Leads '--atualizar' }
            '3' { Abrir-Painel }
            '4' { Rodar-App }
            '5' { Testar-Build }
            '6' { Start-Process (Join-Path $Raiz 'deploy\GUIA_COOLIFY.md') }
            '0' { exit }
            default { Erro 'Opção inválida' }
        }
    } catch { Erro $_.Exception.Message }
    Write-Host ''
    Read-Host '   Enter para voltar ao menu'
}
