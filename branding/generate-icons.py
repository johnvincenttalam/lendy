"""Regenerate the app icons in public/ from the Ollie icon artwork.

Usage: python branding/generate-icons.py branding/ollie-icon-source.png public
Requires Pillow.
"""
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
art = Image.open(src).convert('RGB')
BG = (3, 117, 116)
L = Image.LANCZOS

def full(size):
    return art.resize((size, size), L)

def maskable(size, scale=0.82):
    # Android masks to (at least) the centre 80% circle: shrink the art and
    # pad with its own background colour so ears/thumb survive any mask.
    canvas = Image.new('RGB', (size, size), BG)
    inner = round(size * scale)
    # Bottom-anchored: the artwork crops Ollie's body at its lower edge, so
    # letting it run off the bottom avoids a hard cut floating in the padding.
    canvas.paste(art.resize((inner, inner), L), ((size - inner) // 2, size - inner))
    return canvas

def face(size):
    # Tight crop on the face for tiny favicons: eyes + beak carry the identity.
    box = (150, 230, 1110, 1190)
    return art.crop(box).resize((size, size), L)

full(512).save(f'{out}/icon-512.png', optimize=True)
full(192).save(f'{out}/icon-192.png', optimize=True)
full(180).save(f'{out}/apple-touch-icon.png', optimize=True)
maskable(512).save(f'{out}/icon-maskable-512.png', optimize=True)
maskable(192).save(f'{out}/icon-maskable-192.png', optimize=True)
# ICO: Pillow writes each requested size from the largest image given.
face(256).save(f'{out}/favicon.ico', sizes=[(16,16),(32,32),(48,48)])
print('ok')
