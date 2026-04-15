@echo off
cd /d "%~dp0"

mkdir src 2>nul
mkdir src\api 2>nul
mkdir src\components 2>nul
mkdir src\components\ui 2>nul
mkdir src\contexts 2>nul
mkdir src\hooks 2>nul
mkdir src\layouts 2>nul
mkdir src\lib 2>nul
mkdir src\pages 2>nul

if exist "base44Client.js" move /Y "base44Client.js" "src\api\base44Client.js" >nul

if exist "ActivityCards.jsx" move /Y "ActivityCards.jsx" "src\components\ActivityCards.jsx" >nul
if exist "StatsGrid.jsx" move /Y "StatsGrid.jsx" "src\components\StatsGrid.jsx" >nul
if exist "WelcomeCard.jsx" move /Y "WelcomeCard.jsx" "src\components\WelcomeCard.jsx" >nul
if exist "Logo.jsx" move /Y "Logo.jsx" "src\components\Logo.jsx" >nul
if exist "Sidebar.jsx" move /Y "Sidebar.jsx" "src\components\Sidebar.jsx" >nul
if exist "ManagerForm.jsx" move /Y "ManagerForm.jsx" "src\components\ManagerForm.jsx" >nul
if exist "ManagerImport.jsx" move /Y "ManagerImport.jsx" "src\components\ManagerImport.jsx" >nul
if exist "ExamplesPanel.jsx" move /Y "ExamplesPanel.jsx" "src\components\ExamplesPanel.jsx" >nul
if exist "ModeSelector.jsx" move /Y "ModeSelector.jsx" "src\components\ModeSelector.jsx" >nul
if exist "ProgressBar.jsx" move /Y "ProgressBar.jsx" "src\components\ProgressBar.jsx" >nul

if exist "accordion.jsx" move /Y "accordion.jsx" "src\components\ui\accordion.jsx" >nul
if exist "alert-dialog.jsx" move /Y "alert-dialog.jsx" "src\components\ui\alert-dialog.jsx" >nul
if exist "alert.jsx" move /Y "alert.jsx" "src\components\ui\alert.jsx" >nul
if exist "aspect-ratio.jsx" move /Y "aspect-ratio.jsx" "src\components\ui\aspect-ratio.jsx" >nul
if exist "avatar.jsx" move /Y "avatar.jsx" "src\components\ui\avatar.jsx" >nul
if exist "badge.jsx" move /Y "badge.jsx" "src\components\ui\badge.jsx" >nul
if exist "breadcrumb.jsx" move /Y "breadcrumb.jsx" "src\components\ui\breadcrumb.jsx" >nul
if exist "button.jsx" move /Y "button.jsx" "src\components\ui\button.jsx" >nul
if exist "calendar.jsx" move /Y "calendar.jsx" "src\components\ui\calendar.jsx" >nul
if exist "card.jsx" move /Y "card.jsx" "src\components\ui\card.jsx" >nul
if exist "carousel.jsx" move /Y "carousel.jsx" "src\components\ui\carousel.jsx" >nul
if exist "chart.jsx" move /Y "chart.jsx" "src\components\ui\chart.jsx" >nul
if exist "checkbox.jsx" move /Y "checkbox.jsx" "src\components\ui\checkbox.jsx" >nul
if exist "collapsible.jsx" move /Y "collapsible.jsx" "src\components\ui\collapsible.jsx" >nul
if exist "command.jsx" move /Y "command.jsx" "src\components\ui\command.jsx" >nul
if exist "context-menu.jsx" move /Y "context-menu.jsx" "src\components\ui\context-menu.jsx" >nul
if exist "dialog.jsx" move /Y "dialog.jsx" "src\components\ui\dialog.jsx" >nul
if exist "drawer.jsx" move /Y "drawer.jsx" "src\components\ui\drawer.jsx" >nul
if exist "dropdown-menu.jsx" move /Y "dropdown-menu.jsx" "src\components\ui\dropdown-menu.jsx" >nul
if exist "form.jsx" move /Y "form.jsx" "src\components\ui\form.jsx" >nul
if exist "hover-card.jsx" move /Y "hover-card.jsx" "src\components\ui\hover-card.jsx" >nul
if exist "input-otp.jsx" move /Y "input-otp.jsx" "src\components\ui\input-otp.jsx" >nul
if exist "input.jsx" move /Y "input.jsx" "src\components\ui\input.jsx" >nul
if exist "label.jsx" move /Y "label.jsx" "src\components\ui\label.jsx" >nul
if exist "menubar.jsx" move /Y "menubar.jsx" "src\components\ui\menubar.jsx" >nul
if exist "navigation-menu.jsx" move /Y "navigation-menu.jsx" "src\components\ui\navigation-menu.jsx" >nul
if exist "pagination.jsx" move /Y "pagination.jsx" "src\components\ui\pagination.jsx" >nul
if exist "popover.jsx" move /Y "popover.jsx" "src\components\ui\popover.jsx" >nul
if exist "progress.jsx" move /Y "progress.jsx" "src\components\ui\progress.jsx" >nul
if exist "Progress__1.jsx" move /Y "Progress__1.jsx" "src\components\ui\progress.jsx" >nul
if exist "radio-group.jsx" move /Y "radio-group.jsx" "src\components\ui\radio-group.jsx" >nul
if exist "resizable.jsx" move /Y "resizable.jsx" "src\components\ui\resizable.jsx" >nul
if exist "scroll-area.jsx" move /Y "scroll-area.jsx" "src\components\ui\scroll-area.jsx" >nul
if exist "select.jsx" move /Y "select.jsx" "src\components\ui\select.jsx" >nul
if exist "separator.jsx" move /Y "separator.jsx" "src\components\ui\separator.jsx" >nul
if exist "sheet.jsx" move /Y "sheet.jsx" "src\components\ui\sheet.jsx" >nul
if exist "sidebar__1.jsx" move /Y "sidebar__1.jsx" "src\components\ui\sidebar.jsx" >nul
if exist "skeleton.jsx" move /Y "skeleton.jsx" "src\components\ui\skeleton.jsx" >nul
if exist "slider.jsx" move /Y "slider.jsx" "src\components\ui\slider.jsx" >nul
if exist "sonner.jsx" move /Y "sonner.jsx" "src\components\ui\sonner.jsx" >nul
if exist "switch.jsx" move /Y "switch.jsx" "src\components\ui\switch.jsx" >nul
if exist "table.jsx" move /Y "table.jsx" "src\components\ui\table.jsx" >nul
if exist "tabs.jsx" move /Y "tabs.jsx" "src\components\ui\tabs.jsx" >nul
if exist "textarea.jsx" move /Y "textarea.jsx" "src\components\ui\textarea.jsx" >nul
if exist "toast.jsx" move /Y "toast.jsx" "src\components\ui\toast.jsx" >nul
if exist "toaster.jsx" move /Y "toaster.jsx" "src\components\ui\toaster.jsx" >nul
if exist "toggle-group.jsx" move /Y "toggle-group.jsx" "src\components\ui\toggle-group.jsx" >nul
if exist "toggle.jsx" move /Y "toggle.jsx" "src\components\ui\toggle.jsx" >nul
if exist "tooltip.jsx" move /Y "tooltip.jsx" "src\components\ui\tooltip.jsx" >nul

if exist "AuthContext.jsx" move /Y "AuthContext.jsx" "src\contexts\AuthContext.jsx" >nul

if exist "use-toast.jsx" move /Y "use-toast.jsx" "src\hooks\use-toast.jsx" >nul
if exist "use-mobile.jsx" move /Y "use-mobile.jsx" "src\hooks\use-mobile.jsx" >nul

if exist "AppLayout.jsx" move /Y "AppLayout.jsx" "src\layouts\AppLayout.jsx" >nul

if exist "app-params.js" move /Y "app-params.js" "src\lib\app-params.js" >nul
if exist "gameState.js" move /Y "gameState.js" "src\lib\gameState.js" >nul
if exist "query-client.js" move /Y "query-client.js" "src\lib\query-client.js" >nul
if exist "utils.js" move /Y "utils.js" "src\lib\utils.js" >nul

if exist "Combinations.jsx" move /Y "Combinations.jsx" "src\pages\Combinations.jsx" >nul
if exist "Customize.jsx" move /Y "Customize.jsx" "src\pages\Customize.jsx" >nul
if exist "Flashcards.jsx" move /Y "Flashcards.jsx" "src\pages\Flashcards.jsx" >nul
if exist "Home.jsx" move /Y "Home.jsx" "src\pages\Home.jsx" >nul
if exist "Manager.jsx" move /Y "Manager.jsx" "src\pages\Manager.jsx" >nul
if exist "Progress.jsx" move /Y "Progress.jsx" "src\pages\Progress.jsx" >nul
if exist "Quiz.jsx" move /Y "Quiz.jsx" "src\pages\Quiz.jsx" >nul
if exist "PageNotFound.jsx" move /Y "PageNotFound.jsx" "src\pages\PageNotFound.jsx" >nul

if exist "App.jsx" move /Y "App.jsx" "src\App.jsx" >nul
if exist "index.css" move /Y "index.css" "src\index.css" >nul
if exist "main.jsx" move /Y "main.jsx" "src\main.jsx" >nul
if exist "index.ts" move /Y "index.ts" "src\index.ts" >nul

echo.
echo Organização concluída.
echo.
pause