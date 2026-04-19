$srcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backup = $PSScriptRoot

Copy-Item (Join-Path $backup 'Flashcards.jsx.bak') (Join-Path $srcRoot 'pages\Flashcards.jsx') -Force
Copy-Item (Join-Path $backup 'ExamplesToggleButton.jsx.bak') (Join-Path $srcRoot 'components\ExamplesToggleButton.jsx') -Force
Copy-Item (Join-Path $backup 'ExamplesPanel.jsx.bak') (Join-Path $srcRoot 'components\ExamplesPanel.jsx') -Force

Write-Output 'Restauração concluída.'
