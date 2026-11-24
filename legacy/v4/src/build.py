from pathlib import Path
base=Path(__file__).parent
sources=['jszip.js','app.js','projects.js','mp4.js','webm.js','fast.js']
text=(base/'header.html').read_text()
text+='\n<script>\n'+(base/'jszip.js').read_text()+'\n</script>\n<script>\n\'use strict\';\n'
text+='\n'.join((base/name).read_text() for name in sources[1:])
text+='\nrenderLooks();\nrebuild();\nrenderClips();\nrenderQueue();\n</script>\n</body>\n</html>\n'
(base/'Emperador_Santiago.html').write_text(text)
