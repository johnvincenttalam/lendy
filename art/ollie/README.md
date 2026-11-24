# Ollie artwork (originals)

Full-size 1254×1254 PNGs. They are **not** shipped with the app.

The app uses 384×384 WebP copies in `public/assets/ollie/` (about 30 KB each).
Ollie is never drawn wider than 116 px, so 384 px stays sharp on 3× screens.

To regenerate after changing a picture (needs Python with Pillow):

```python
from pathlib import Path
from PIL import Image

for png in Path('art/ollie').glob('ollie-*.png'):
    img = Image.open(png).convert('RGBA').resize((384, 384), Image.LANCZOS)
    img.save(Path('public/assets/ollie') / (png.stem + '.webp'), 'WEBP', quality=88, method=6, alpha_quality=100)
```
