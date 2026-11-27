import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from v11.mobs12 import BUILDERS
from v11.preview11 import sheet
X = "/tmp/claude-0/-home-user/a9d267a4-5978-54c6-8039-c9f1893306be/scratchpad/v1062/x/resource_pack"
def L(p): return json.loads(re.sub(r'(?m)^\s*//.*$', '', open(p, encoding='utf-8').read()))
ids = sys.argv[2:] or list(BUILDERS)
ms = []
for i in ids:
    n = i.split(":")[1]
    base = L(f"{X}/models/entity/{n}.geo.json")["minecraft:geometry"][0]
    m = BUILDERS[i](base); m.finalize(); ms.append((i, m))
sheet(ms, sys.argv[1], cell=420)
