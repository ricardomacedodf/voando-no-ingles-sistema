$srcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backup = $PSScriptRoot

Copy-Item (Join-Path $backup 'Flashcards.jsx.bak') (Join-Path $srcRoot 'pages\Flashcards.jsx') -Force

$newComponent = Join-Path $srcRoot 'components\FlashcardModeSelector.jsx'
if (Test-Path $newComponent) {
  Remove-Item $newComponent -Force
}

Write-Output 'Restauração concluída.'
