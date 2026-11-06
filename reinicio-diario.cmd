@echo off
rem ============================================================
rem  Embaresa - reinicio diario do aparelho as 05:30 (tablets, terminais e PCs da fabrica)
rem  Descarrega-se do site do quiosque e abre-se com duplo clique, uma vez em cada aparelho.
rem  Se ja estiver instalado, pergunta se quer REMOVER. Nao precisa de administrador.
rem  Nunca no PC da Sonia (servidor) - o proprio ficheiro recusa.
rem ============================================================
setlocal
set "PS1=%TEMP%\embaresa-reinicio-diario.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText('%~f0'); $m='#PS'+'-INICIO'; $i=$t.LastIndexOf($m); [IO.File]::WriteAllText('%PS1%', $t.Substring($i))"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
del "%PS1%" >nul 2>&1
echo.
pause
exit /b

#PS-INICIO
# 06-11-2026. A Sonia: "deveria haver uma rotina de desligar completamente as maquinas" (a camara
# do tablet do embalamento ficou presa e so voltou depois de desligar) -> reiniciar todos os dias as
# 05:30, depois do fecho do quiosque (23:59) e antes do turno. "e nos pc e terminal" -> o mesmo ficheiro.
#  - shutdown /r /f /t 120: aviso no ecra e 2 min depois reinicia
#  - acorda o aparelho se estiver a dormir; corre tambem na bateria
#  - se estava DESLIGADO as 05:30 nao reinicia depois (nunca a meio do turno)
#  - hora local sem fuso (com +00:00 fixo, no verao seria as 06:30)
param([switch]$Remover, [switch]$Teste, [string]$Hora = '05:30')
$ErrorActionPreference = 'Stop'
$nome = 'Embaresa - Reiniciar de madrugada'
if ($Teste) { $nome += ' (TESTE)' }
Write-Host ""
Write-Host "  EMBARESA - reinicio diario deste aparelho ($env:COMPUTERNAME)" -ForegroundColor Cyan
Write-Host ""

if ($env:COMPUTERNAME -eq 'LAPTOP-RKVNASA4' -and -not $Teste) {
    Write-Host "  Este e o PC da Sonia (servidor). Aqui NAO se instala o reinicio diario." -ForegroundColor Red
    exit 3
}

$existe = Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
if ($existe -and -not $Remover) {
    $prox = ($existe | Get-ScheduledTaskInfo).NextRunTime
    Write-Host ("  Ja esta instalado (proximo reinicio: {0:dd/MM/yyyy HH:mm})." -f $prox) -ForegroundColor Green
    $r = Read-Host "  Quer REMOVER o reinicio diario deste aparelho? (S/N)"
    if ($r -notmatch '^[sS]') { Write-Host "  Fica como estava."; exit 0 }
    $Remover = $true
}
if ($Remover) {
    if ($existe) { Unregister-ScheduledTask -TaskName $nome -Confirm:$false; Write-Host "  Removido. Este aparelho ja nao reinicia sozinho." -ForegroundColor Yellow }
    else { Write-Host "  Nao havia reinicio diario neste aparelho." }
    exit 0
}

if ($Teste) {
    $acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c echo reinicio de teste %date% %time% > "' + $env:TEMP + '\embaresa-reinicio-teste.txt"')
} else {
    $acao = New-ScheduledTaskAction -Execute 'shutdown.exe' -Argument '/r /f /t 120 /c "Embaresa: reinicio diario do aparelho. Vai reiniciar daqui a 2 minutos."'
}
$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
$gatilho.StartBoundary = (Get-Date $Hora).ToString('yyyy-MM-ddTHH:mm:ss')
$definicoes = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$definicoes.StartWhenAvailable = $false
$quem = New-ScheduledTaskPrincipal -UserId ("$env:USERDOMAIN\$env:USERNAME") -LogonType Interactive -RunLevel Limited
$tarefa = New-ScheduledTask -Action $acao -Trigger $gatilho -Settings $definicoes -Principal $quem `
    -Description "Reinicia este aparelho todos os dias as $Hora. Pedido da Sonia a 06-11-2026. Para remover: abrir outra vez o reinicio-diario.cmd."
Register-ScheduledTask -TaskName $nome -InputObject $tarefa -Force | Out-Null

$t = Get-ScheduledTask -TaskName $nome
$prox = ($t | Get-ScheduledTaskInfo).NextRunTime
Write-Host "  OK - instalado para o utilizador $env:USERNAME." -ForegroundColor Green
Write-Host ("  Proximo reinicio: {0:dd/MM/yyyy HH:mm}" -f $prox) -ForegroundColor Green
Write-Host "  (se o aparelho estiver desligado a essa hora, nao faz nada)"
