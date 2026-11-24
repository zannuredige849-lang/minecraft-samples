#!/usr/bin/env python3
"""Zip behavior_pack/ and resource_pack/ into dist/warcraft_arthas.mcaddon (a zip holding both packs)."""
import os, zipfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "dist"); os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, "warcraft_arthas.mcaddon")
n = 0
with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for pack, folder in (("behavior_pack", "warcraft_arthas_BP"), ("resource_pack", "warcraft_arthas_RP")):
        for d, _dirs, files in os.walk(os.path.join(ROOT, pack)):
            for f in sorted(files):
                full = os.path.join(d, f)
                z.write(full, os.path.join(folder, os.path.relpath(full, os.path.join(ROOT, pack))))
                n += 1
print(f"{path}: {n} files, {os.path.getsize(path)/1024:.0f} kB")
