"""UNIQUENESS.md: every creature, its faction, abilities and trophies (generated from tools/forge/uniq.py)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from forge.uniq import E, ITEMS
from forge.factions import FACTIONS, FACTION_OF

def main(dst):
    by = {}
    for k, v in E.items(): by.setdefault(FACTION_OF.get(k, "other"), []).append(k)
    out = ["# Уникальности всех существ и предметов", "", "Создано `tools/gen_docs.py` из `tools/forge/uniq.py` (то же, что показывает игровой Бестиарий).", ""]
    for f, ids in sorted(by.items(), key=lambda t: FACTIONS.get(t[0], {}).get("title", "я")):
        out += [f"## {FACTIONS.get(f, {}).get('title', 'Прочие')}", "", "| Существо | Способности | Трофеи |", "|---|---|---|"]
        for i in sorted(ids, key=lambda x: E[x]["ru"]):
            v = E[i]
            ab = "<br>".join(f"**{a['name']}** — {a['d']}" for a in v["ab"] if a.get("name")) or (v["note"] or "—")
            if v["ab"] and v["note"]: ab += f"<br>_{v['note']}_"
            dr = "<br>".join(f"{d[4].replace('§a','').replace('§6','').replace('§f','').replace('§e','').replace('§b','').replace('§c','').replace('§d','').replace('§2','').replace('§3','').replace('§5','').replace('§7','').replace('§8','').replace('§9','')} ({int(d[3]*100)}%)" for d in v["drops"]) or "—"
            out.append(f"| `{i}` {v['ru']} | {ab} | {dr} |")
        out.append("")
    out += ["## Предметы", "", "| Предмет | Эффект |", "|---|---|"] + [f"| `{k}` {v['ru']} | {v['d']} |" for k, v in ITEMS.items()]
    open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")

if __name__ == "__main__":
    main(sys.argv[1])
