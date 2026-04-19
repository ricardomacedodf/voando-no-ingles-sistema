$srcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backup = $PSScriptRoot

Copy-Item (Join-Path $backup 'Flashcards.jsx.bak') (Join-Path $srcRoot 'pages\Flashcards.jsx') -Force
Copy-Item (Join-Path $backup 'FlashcardModeSelector.jsx.bak') (Join-Path $srcRoot 'components\FlashcardModeSelector.jsx') -Force
Copy-Item (Join-Path $backup 'ExamplesToggleButton.jsx.bak') (Join-Path $srcRoot 'components\ExamplesToggleButton.jsx') -Force
Copy-Item (Join-Path $backup 'ExamplesPanel.jsx.bak') (Join-Path $srcRoot 'components\ExamplesPanel.jsx') -Force
Copy-Item (Join-Path $backup 'index.css.bak') (Join-Path $srcRoot 'index.css') -Force

Write-Output 'Restauração concluída.'
