# Linden

Versión actual del prototipo, lista para abrir en Cursor. Se conserva el código y los recursos visuales sin cambios.

## Abrir y probar

1. Descomprimí el ZIP y abrí la carpeta Linden en Cursor.
2. En la terminal de esa carpeta ejecutá:

```sh
python3 -m http.server 8000 --directory dist
```

3. Abrí http://localhost:8000 en el navegador. No abras el HTML directamente como archivo.

En Windows, si no tenés python3, probá `python -m http.server 8000 --directory dist`.

## Estructura

- `dist/`: aplicación y recursos. Es el código fuente de este proyecto; no borrar ni excluir de Git.
- `tests/`: pruebas de voz y dictado.
- `docs/`: notas de diseño.

No hay dependencias npm ni paso de compilación. Si tenés Node instalado, podés ejecutar las pruebas con `node --test tests/*.test.cjs`.

El micrófono requiere permisos del navegador y localhost o HTTPS. Las capacidades de voz dependen del navegador y del dispositivo. Este paquete conserva el comportamiento actual del prototipo; subirlo a GitHub no añade servicios de autenticación ni de IA.

## Mensaje para el agente de Cursor

Abrí este proyecto y subilo a https://github.com/Flambee-lab/Linden.git usando mi conexión de GitHub. Conservá exactamente el diseño, las animaciones, los textos y el comportamiento actual. No refactorices ni regeneres la aplicación. La carpeta dist contiene el código fuente y debe incluirse en Git. Revisá primero el estado del repositorio remoto: si está vacío, inicializá este proyecto y subilo a main. Si tiene contenido, preservalo e integrá el proyecto en una rama nueva para revisión. No uses force push ni borres archivos remotos sin consultarme. Excluí credenciales y archivos locales. Al terminar, confirmá la rama, el commit y el enlace al repositorio.

## Alcance

El ZIP no contiene credenciales, configuración del alojamiento anterior ni historial Git. Publicar el código en GitHub y publicar una web accesible por URL son pasos distintos.
