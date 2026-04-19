$srcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backup = $PSScriptRoot

Copy-Item (Join-Path $backup 'Flashcards.jsx.bak') (Join-Path $srcRoot 'pages\Flashcards.jsx') -Force
Copy-Item (Join-Path $backup 'index.css.bak') (Join-Path $srcRoot 'index.css') -Force

Write-Output 'Restauração concluída.'
