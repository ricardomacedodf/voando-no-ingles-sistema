$root = Split-Path -Parent $PSScriptRoot
$backup = Join-Path $root '__backup__\flashcard-update-2026-04-19'

Copy-Item (Join-Path $backup 'Flashcards.jsx.bak') (Join-Path $root 'pages\Flashcards.jsx') -Force
Copy-Item (Join-Path $backup 'Quiz.jsx.bak') (Join-Path $root 'pages\Quiz.jsx') -Force
Copy-Item (Join-Path $backup 'Combinations.jsx.bak') (Join-Path $root 'pages\Combinations.jsx') -Force
Copy-Item (Join-Path $backup 'Progress.jsx.bak') (Join-Path $root 'pages\Progress.jsx') -Force
Copy-Item (Join-Path $backup 'ExamplesPanel.jsx.bak') (Join-Path $root 'components\ExamplesPanel.jsx') -Force
Copy-Item (Join-Path $backup 'ModeSelector.jsx.bak') (Join-Path $root 'components\ModeSelector.jsx') -Force
Copy-Item (Join-Path $backup 'gameState.js.bak') (Join-Path $root 'lib\gameState.js') -Force

$newComponent = Join-Path $root 'components\ExamplesToggleButton.jsx'
if (Test-Path $newComponent) {
  Remove-Item $newComponent -Force
}

Write-Output 'Restauração concluída.'
