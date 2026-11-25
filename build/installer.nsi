; Program de instalare Catedra pentru Windows.
; Se compilează cu makensis (funcționează și pe Linux, fără Wine):
;   npx electron-builder --win dir --x64 && makensis build/installer.nsi
Unicode true
SetCompressor /SOLID lzma

!define APPNAME "Catedra"
!define VERSION "1.0.0"
!define PUBLISHER "Catedra"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Catedra"

!include "MUI2.nsh"

Name "${APPNAME}"
OutFile "..\dist\Catedra-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Catedra"
InstallDirRegKey HKCU "Software\Catedra" "InstallDir"
RequestExecutionLevel user
BrandingText "Catedra ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1048 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1048 "FileDescription" "Instalare Catedra – asistentul profesorului"
VIAddVersionKey /LANG=1048 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1048 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1048 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=1048 "LegalCopyright" "MIT"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bun venit la instalarea Catedra"
!define MUI_WELCOMEPAGE_TEXT "Catedra este asistentul digital al profesorului: catalog cu medii calculate automat, absențe, orar, planificare, proiecte de lecție, teste și rapoarte pentru părinți.$\r$\n$\r$\nAplicația funcționează fără internet, iar datele rămân doar pe acest calculator.$\r$\n$\r$\nApăsați „Înainte” pentru a continua."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Catedra.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Pornește Catedra acum"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Romanian"

Section "Catedra" SecMain
  SetOutPath "$INSTDIR"
  ; Închide aplicația dacă rulează (pentru actualizare)
  nsExec::Exec 'taskkill /F /IM Catedra.exe'
  File /r "..\dist\win-unpacked\*.*"
  File "icon.ico"

  CreateDirectory "$SMPROGRAMS\Catedra"
  CreateShortcut "$SMPROGRAMS\Catedra\Catedra.lnk" "$INSTDIR\Catedra.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\Catedra\Dezinstalează Catedra.lnk" "$INSTDIR\Dezinstalare.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$DESKTOP\Catedra.lnk" "$INSTDIR\Catedra.exe" "" "$INSTDIR\icon.ico" 0

  WriteUninstaller "$INSTDIR\Dezinstalare.exe"
  WriteRegStr HKCU "Software\Catedra" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Dezinstalare.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
SectionEnd

; Datele profesorului (%APPDATA%\Catedra) NU se șterg la dezinstalare.
Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM Catedra.exe'
  Delete "$DESKTOP\Catedra.lnk"
  RMDir /r "$SMPROGRAMS\Catedra"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\Catedra"
SectionEnd
