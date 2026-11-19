"""Genera index.html (versión web en comanda.noblezabeauty.com) a partir de src/app.html.
Uso: python3 tools/build.py   — luego git add -A && git commit && git push."""
import pathlib,re
R=pathlib.Path(__file__).resolve().parent.parent
app=(R/'src/app.html').read_text()
app=re.sub(r'^<title>.*?</title>\s*','',app,count=1)
app=app.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
FB='https://www.gstatic.com/firebasejs/10.12.2/'
head=f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Comanda · Nobleza</title>
<meta name="theme-color" content="#0B0A08">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Comanda">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="robots" content="noindex,nofollow">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<style>:root{{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}html{{scroll-padding-top:env(safe-area-inset-top,0px)}}body{{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}}img{{max-width:100%}}[hidden]:not([hidden=until-found i]){{display:none!important}}</style>
<script src="{FB}firebase-app-compat.js"></script>
<script src="{FB}firebase-auth-compat.js"></script>
<script src="{FB}firebase-firestore-compat.js"></script>
<script src="web.js"></script>
</head>
<body>
'''
import hashlib
ver=hashlib.sha1((head+app+(R/'web.js').read_text()).encode()).hexdigest()[:12]
head=head.replace('<script src="web.js"></script>',f'<script>window.BUILD="{ver}"</script>\n<script src="web.js?v={ver}"></script>')
(R/'index.html').write_text(head+app+'\n</body>\n</html>\n')
(R/'version.txt').write_text(ver+'\n')
print('index.html listo', len(head+app), 'versión', ver)
