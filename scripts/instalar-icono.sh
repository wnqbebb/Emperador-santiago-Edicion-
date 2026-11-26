#!/usr/bin/env bash
# Crea el ícono «Emperador Santiago» en Windows (Escritorio + menú Inicio) para abrir todo con un clic,
# sin escribir comandos. Ejecútalo UNA vez desde Ubuntu (WSL):   bash scripts/instalar-icono.sh
# Luego: clic derecho en el ícono del Escritorio → «Anclar a la barra de tareas».
set -e
cd "$(dirname "$(readlink -f "$0")")/.."
PROY="$(pwd)"
DISTRO="${WSL_DISTRO_NAME:-Ubuntu-24.04}"
command -v powershell.exe >/dev/null || { echo "Esto se ejecuta dentro de Ubuntu en Windows (WSL)."; exit 1; }
chmod +x scripts/iniciar.sh scripts/detener.sh

APPDATA_WIN="$(powershell.exe -NoProfile -Command '[Environment]::GetFolderPath("LocalApplicationData")' | tr -d '\r')"
DEST_WIN="$APPDATA_WIN\\EmperadorSantiago"
DEST="$(wslpath "$APPDATA_WIN")/EmperadorSantiago"
mkdir -p "$DEST"
cp scripts/windows/emperador.ico scripts/windows/cargando.html "$DEST/"

# Abrir: enciende el sistema (si no está encendido) y abre la app en su propia ventana
cat > "$DEST/Emperador.vbs" <<VBS
' Emperador Santiago · abre el sistema con un clic
Set sh = CreateObject("WScript.Shell")
If Not Arriba("http://localhost:4173/") Then
  sh.Run "wsl.exe -d $DISTRO -- bash -lc ""'$PROY/scripts/iniciar.sh'""", 0, False
End If
pagina = "file:///" & Replace("$DEST_WIN\\cargando.html", "\\", "/")
On Error Resume Next
sh.Run "msedge --app=""" & pagina & """ --window-size=1440,920", 1, False
If Err.Number <> 0 Then
  Err.Clear
  sh.Run "chrome --app=""" & pagina & """", 1, False
  If Err.Number <> 0 Then sh.Run """" & pagina & """", 1, False
End If

Function Arriba(u)
  On Error Resume Next
  Set x = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  x.setTimeouts 800, 800, 800, 800
  x.Open "GET", u, False
  x.Send
  Arriba = (Err.Number = 0 And x.Status = 200)
End Function
VBS

# Apagar: libera memoria cuando no lo uses
cat > "$DEST/Apagar.vbs" <<VBS
Set sh = CreateObject("WScript.Shell")
sh.Run "wsl.exe -d $DISTRO -- bash -lc ""'$PROY/scripts/detener.sh'""", 0, True
MsgBox "Emperador Santiago se apagó.", 64, "Emperador Santiago"
VBS

# Actualizar: abre una ventana que muestra el progreso
cat > "$DEST/Actualizar.vbs" <<VBS
Set sh = CreateObject("WScript.Shell")
sh.Run "wsl.exe -d $DISTRO -- bash -lc ""'$PROY/scripts/emperador' actualizar; echo; read -p 'Listo. Pulsa Enter para cerrar…' x""", 1, False
VBS

# Accesos directos con ícono (Escritorio y menú Inicio)
powershell.exe -NoProfile -Command "
\$sh = New-Object -ComObject WScript.Shell
\$dest = '$DEST_WIN'
foreach (\$dir in @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) ''))) {
  \$a = \$sh.CreateShortcut((Join-Path \$dir 'Emperador Santiago.lnk'))
  \$a.TargetPath = 'wscript.exe'; \$a.Arguments = '\"' + \$dest + '\\Emperador.vbs\"'
  \$a.IconLocation = \$dest + '\\emperador.ico'; \$a.Description = 'Emperador Santiago · Edición de Videos'; \$a.Save()
  \$c = \$sh.CreateShortcut((Join-Path \$dir 'Actualizar Emperador.lnk'))
  \$c.TargetPath = 'wscript.exe'; \$c.Arguments = '\"' + \$dest + '\\Actualizar.vbs\"'
  \$c.IconLocation = \$dest + '\\emperador.ico'; \$c.Description = 'Actualizar Emperador Santiago'; \$c.Save()
  \$b = \$sh.CreateShortcut((Join-Path \$dir 'Apagar Emperador.lnk'))
  \$b.TargetPath = 'wscript.exe'; \$b.Arguments = '\"' + \$dest + '\\Apagar.vbs\"'
  \$b.IconLocation = \$dest + '\\emperador.ico'; \$b.Description = 'Apagar Emperador Santiago'; \$b.Save()
}"

# Preparar la interfaz ya, para que el primer clic abra rápido
echo "Preparando la interfaz (un minuto, solo esta vez)…"
npm run build -w web >/dev/null 2>&1 && echo "✓ Interfaz lista"
echo
echo "✓ Listo. En tu Escritorio y en el menú Inicio tienes «Emperador Santiago», «Apagar Emperador» y «Actualizar Emperador»."
echo "  Para la barra de tareas: clic derecho en «Emperador Santiago» del menú Inicio → «Anclar a la barra de tareas»."
