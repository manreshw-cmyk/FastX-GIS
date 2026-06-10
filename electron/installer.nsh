!macro customHeader
  ShowInstDetails show
  ShowUnInstDetails show
  AutoCloseWindow false
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Preparing FastX GIS desktop files..."
  DetailPrint "Installing Electron runtime..."
  DetailPrint "Installing Cesium static assets..."
  DetailPrint "Installing FastX GIS application resources..."
  DetailPrint "Installing API documentation..."
  DetailPrint "Creating desktop and start menu shortcuts..."
!macroend

!macro customUnInstall
  SetDetailsPrint both
  DetailPrint "Removing FastX GIS application files..."
  DetailPrint "Removing Cesium static assets..."
  DetailPrint "Removing API documentation..."
  DetailPrint "Removing desktop and start menu shortcuts..."
!macroend
