; Kurulum bitince uygulamanın kısayolunu kurulum dosyasının bulunduğu klasöre de koy.
!macro customInstall
  CreateShortCut "$EXEDIR\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend
