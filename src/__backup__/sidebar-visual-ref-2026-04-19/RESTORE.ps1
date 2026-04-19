$srcRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backup = $PSScriptRoot

Copy-Item (Join-Path $backup 'Sidebar.jsx.bak') (Join-Path $srcRoot 'components\Sidebar.jsx') -Force
Copy-Item (Join-Path $backup 'AppLayout.jsx.bak') (Join-Path $srcRoot 'layouts\AppLayout.jsx') -Force
Copy-Item (Join-Path $backup 'Logo.jsx.bak') (Join-Path $srcRoot 'components\Logo.jsx') -Force

Write-Output 'Restauração concluída.'
