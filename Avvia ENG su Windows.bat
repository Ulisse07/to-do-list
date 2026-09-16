@echo off
setlocal
cd /d "%~dp0"
title ENG Workspace

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non e installato o non e disponibile nel PATH.
  echo Installa Node.js 22.12 o successivo da https://nodejs.org/en/download
  echo Poi riavvia Windows e apri nuovamente questo file.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if errorlevel 1 (
  echo La versione di Node.js installata e troppo vecchia.
  echo Installa Node.js 22.12 o successivo da https://nodejs.org/en/download
  pause
  exit /b 1
)

if not exist "node_modules\vite\package.json" (
  echo Prima configurazione: installazione dei componenti necessari...
  call npm install
  if errorlevel 1 (
    echo Installazione non riuscita. Controlla la connessione Internet e riprova.
    pause
    exit /b 1
  )
)

if not exist ".env.local" if not exist ".env" (
  > ".env.local" echo VITE_DEMO_MODE=true
  echo Avvio in demo locale: i dati restano soltanto in Microsoft Edge su questo PC.
)

echo Apertura di ENG Workspace in Microsoft Edge...
node scripts\launch.mjs
if errorlevel 1 (
  echo ENG Workspace si e arrestato a causa di un errore.
  pause
  exit /b 1
)

endlocal
