"""Balance + mechanics pass (v10.12): every fight must be winnable by a well-geared player.

1. Entity stats by tier (behaviour JSON): health / melee damage / speed caps, boss bars for bosses.
2. Script fixes: invalid particle and sound ids -> valid vanilla ids; boss HP constants follow the new caps;
   the Cyclops grab can be broken by hitting him and never kills a player outright.
3. scripts/fairness.js (loaded first): a runtime guard for everything scripted -
   per-hit and per-3-second caps on scripted damage to players, no scripted instant kills,
   duration/amplifier caps on harmful effects, a heal budget for bosses in combat, warnings before big blows.
4. BALANCE.md: before/after table and time-to-kill estimates.
"""
import os, re, json, glob

# ---- tiers -------------------------------------------------------------------------------------------------------
BOSSES = {"cb:ares", "cb:athena", "cb:hades", "cb:hephaestus", "cb:poseidon", "cb:zeus", "cb:fel_lord", "cb:guldan",
          "cb:cyclops", "cb:dreadlord", "cb:lich_king", "cb:lich_statue", "cb:ice_spirit", "cb:minotaur", "cb:hydra", "cb:circe",
          "warcraft:great_unclean_one", "warcraft:ember_colossus", "warcraft:abomination_lord"}
SKIP = {"cb:hydra_neck", "cb:hydra_head", "cb:hex_chicken", "cb:hex_goat", "cb:hex_horse", "cb:hex_pig", "cb:hex_sheep"}
CAPS = {  # tier: (hp min, hp max, melee damage max, movement max, knockback resistance max)
    "boss": (0, 360, 11, 0.30, 1.0),
    "elite": (0, 180, 9, 0.32, 0.9),
    "regular": (0, 80, 7, 0.34, 0.8),
}

# ---- invalid ids found by the audit (not in Mojang's particle / sound definitions) -------------------------------
PARTICLES = {"minecraft:bubble_particle": "minecraft:basic_bubble_particle", "minecraft:crit_emitter": "minecraft:critical_hit_emitter",
             "minecraft:crit_particle": "minecraft:basic_crit_particle", '"minecraft:crit"': '"minecraft:basic_crit_particle"',
             "minecraft:large_smoke": "minecraft:white_smoke_particle", "minecraft:sporeblossom_ambient_particle": "minecraft:spore_blossom_ambient_particle",
             "minecraft:sweep_particle": "minecraft:critical_hit_emitter"}
SOUNDS = {'"block.chain.place"': '"place.chain"', '"game.player.attack.crit"': '"game.player.attack.critical"',
          '"mob.guardian.attack"': '"mob.elderguardian.curse"'}

CYCLOPS_ESCAPE = r'''

// ---------- v10.12 fairness: a grabbed player can break free (2 hits on the Cyclops) ----------
world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const c = ev.hurtEntity;
    if (!c || c.typeId !== "cb:cyclops") return;
    const g = grabs.get(c.id);
    if (!g || g.eaten) return;
    const a = ev.damageSource?.damagingEntity;
    if (!a || a.id !== g.vId || !isPlayer(a)) return;
    g.escape = (g.escape ?? 0) + 1;
    if (g.escape < 2) { actionBar(a, "§eЕщё удар — и вы вырветесь!"); return; }
    release(c.id, g);
    try { c.triggerEvent(isBlind(c) ? "cb:end_grab_blind" : "cb:end_grab_sighted"); } catch {}
    cooldowns.set(c.id, system.currentTick + COOLDOWN);
    try { a.applyKnockback(-Math.sin(g.yaw * Math.PI / 180), Math.cos(g.yaw * Math.PI / 180), 1.2, 0.45); } catch {}
    try { a.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false }); } catch {}
    actionBar(a, "§aВы вырвались из лапы Циклопа!");
  } catch {}
});
'''


CIRCE_TIMEOUT = r'''

// ---------- v10.12 fairness: a hexed player is never stuck - the spell wears off after 60 s ----------
system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, h] of hexed) {
    if (h.t0 === undefined || now - h.t0 < 1200) continue;
    let e; try { e = world.getEntity(id); } catch {}
    if (!e || !isPlayer(e)) continue;
    unhex(id, false);
    actionBar(e, "§aЧары Цирцеи развеялись — вы снова человек");
  }
}, 20);
'''


def _load(p):
    return json.loads(re.sub(r"(?m)^\s*//.*$", "", open(p, encoding="utf-8").read()))


def tier_of(ident, hp):
    if ident in BOSSES: return "boss"
    if hp >= 100: return "elite"
    return "regular"


def balance_entities(bp):
    rows = []
    for p in sorted(glob.glob(f"{bp}/entities/*.json")):
        d = _load(p)
        e = d["minecraft:entity"]; ident = e["description"]["identifier"]
        if ident in SKIP: continue
        comps = [e.get("components", {})] + list(e.get("component_groups", {}).values())
        hps = [c["minecraft:health"].get("max", c["minecraft:health"].get("value")) for c in comps if "minecraft:health" in c]
        hps = [h for h in hps if isinstance(h, (int, float))]
        if not hps: continue
        t = tier_of(ident, max(hps))
        hmin, hmax, dmax, smax, kbmax = CAPS[t]
        before = (max(hps), None, None)
        dm_b = []; dm_a = []
        for c in comps:
            h = c.get("minecraft:health")
            if h:
                for k in ("value", "max"):
                    if isinstance(h.get(k), (int, float)):
                        v = h[k]
                        if v > hmax: h[k] = hmax
                        if t == "boss" and v < hmin: h[k] = hmin
            a = c.get("minecraft:attack")
            if a and "damage" in a:
                dmg = a["damage"]
                dm_b.append(dmg)
                if isinstance(dmg, list): a["damage"] = [min(x, dmax) for x in dmg]
                elif isinstance(dmg, (int, float)): a["damage"] = min(dmg, dmax)
                dm_a.append(a["damage"])
            mv = c.get("minecraft:movement")
            if mv and isinstance(mv.get("value"), (int, float)) and mv["value"] > smax: mv["value"] = smax
            kb = c.get("minecraft:knockback_resistance")
            if kb and isinstance(kb.get("value"), (int, float)) and kb["value"] > kbmax: kb["value"] = kbmax
        if t == "boss" and not any("minecraft:boss" in c for c in comps):
            e.setdefault("components", {})["minecraft:boss"] = {"should_darken_sky": False, "hud_range": 40}
        hp_after = max(c["minecraft:health"].get("max", c["minecraft:health"].get("value")) for c in comps if "minecraft:health" in c)
        rows.append((ident, t, before[0], hp_after, dm_b, dm_a))
        json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    return rows


def spawn_density(bp):
    n = 0
    for p in glob.glob(f"{bp}/spawn_rules/*.json"):
        d = _load(p); ch = False
        for c in d["minecraft:spawn_rules"].get("conditions", []):
            if "minecraft:density_limit" not in c:
                c["minecraft:density_limit"] = {"surface": 3, "underground": 3}; ch = True; n += 1
        if ch: json.dump(d, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    return n


def fix_scripts(bp, caps):
    sd = f"{bp}/scripts"; changed = 0
    for p in glob.glob(f"{sd}/*.js"):
        s0 = s = open(p, encoding="utf-8").read()
        for a, b in {**PARTICLES, **SOUNDS}.items(): s = s.replace(a, b)
        # boss HP constants follow the JSON caps (difficulty scaling is computed from these)
        s = re.sub(r"applyBossDifficultyHp\(c, 560\)", f"applyBossDifficultyHp(c, {caps['cb:cyclops']})", s)
        if os.path.basename(p) == "mythic_bosses.js":
            def fix_base(m):
                k, v = m.group(1), int(m.group(2))
                return f'"{k}": {min(v, caps.get(k, v))}'
            i = s.find("const BOSS_BASE_HP = {")
            if i >= 0:
                j = s.index("};", i)
                blk = re.sub(r'"(cb:[a-z_]+)": (\d+)', lambda m: fix_base(m) if m.group(1) in caps else m.group(0), s[i:j])
                s = s[:i] + blk + s[j:]
        if os.path.basename(p) == "mythic_bosses.js":     # dangling `if` swallowed the next statement for non-players
            s = re.sub(r"if \(isPlayer\(target\)\)\s*\n(\s*)return;",
                       r'if (isPlayer(target)) actionBar(target, "§cМинотавр поднял вас на рога! Через секунду бросит — готовьтесь к падению");\n\1return;', s)
        if os.path.basename(p) == "circe.js" and "v10.12 fairness" not in s:
            s = s.replace("return { formId, form, by, refresh:", "return { t0: now, formId, form, by, refresh:", 1)
            s += CIRCE_TIMEOUT
        if os.path.basename(p) == "cyclops.js" and "v10.12 fairness" not in s:
            s += CYCLOPS_ESCAPE
            s = s.replace('subtitle: T("cyc.grabbed_you")', 'subtitle: T("cyc.grabbed_you") + " §e(бейте Циклопа, чтобы вырваться)"')
        if s != s0:
            open(p, "w", encoding="utf-8").write(s); changed += 1
    # fairness guard first in the entry point
    src = os.path.join(os.path.dirname(__file__), "js", "fairness.js")
    t = open(src, encoding="utf-8").read().replace("/*BOSSES*/[]", json.dumps(sorted(BOSSES)))
    open(f"{sd}/fairness.js", "w", encoding="utf-8").write(t)
    mp = f"{sd}/main.js"; m = open(mp, encoding="utf-8").read()
    if './fairness.js' not in m:
        m = m.replace('import "./factions.js";', 'import "./fairness.js";\nimport "./factions.js";', 1)
        open(mp, "w", encoding="utf-8").write(m)
    return changed


def report(rows, out_md):
    L = ["# Баланс (v10.12)", "",
         "Расчёт для игрока 20 HP. Урон по игроку в броне: железо ×0.40, алмаз ×0.20 (броня 15/20 из 25). "
         "Урон игрока: алмазный меч 7 (≈12 урона/с при ~1,7 удара/с), незеритовый с Остротой V 11 (≈19/с).", "",
         "Скриптовые способности дополнительно ограничены `scripts/fairness.js`: не больше 40% здоровья игрока за удар босса "
         "(25% — обычного моба), не больше 60% за любые 3 секунды, без мгновенных смертей, вредные эффекты не дольше 5 с и не сильнее II, "
         "босс в бою лечится не больше чем на 8% здоровья за 10 с, перед сильными ударами — предупреждение.", "",
         "| Существо | Ранг | HP было | HP стало | Урон было | Урон стал | Убить алмазным мечом | Убить незеритовым V |", "|---|---|---|---|---|---|---|---|"]
    for ident, t, hb, ha, db, da in sorted(rows, key=lambda r: ({"boss": 0, "elite": 1, "regular": 2}[r[1]], -r[3])):
        f = lambda x: "/".join(str(v) for v in x) if x else "—"
        L.append(f"| `{ident}` | {t} | {hb} | {ha} | {f(db)} | {f(da)} | {ha / 12:.0f} с | {ha / 19:.0f} с |")
    open(out_md, "w", encoding="utf-8").write("\n".join(L) + "\n")


def run(out):
    bp = f"{out}/behavior_pack"
    rows = balance_entities(bp)
    caps = {r[0]: r[3] for r in rows}
    dens = spawn_density(bp)
    ch = fix_scripts(bp, caps)
    report(rows, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "BALANCE.md"))
    changed = sum(1 for r in rows if r[2] != r[3] or r[4] != r[5])
    return {"entities": len(rows), "rebalanced": changed, "density_added": dens, "scripts_fixed": ch}
