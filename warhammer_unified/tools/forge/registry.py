from .mobs_order import ORDER
from .mobs_norsca import NORSCA
from .mobs_chaos import CHAOS
from .mobs_undead import FACELESS, SCOURGE
from .mobs_beasts import BEASTS, big_ent, ENT_VARIANTS
from .mobs_golems import GOLEMS

REG = {}
for grp in (ORDER, NORSCA, CHAOS, FACELESS, SCOURGE, BEASTS):
    for k, fn in grp.items():
        REG["warcraft:" + k] = fn
REG["warcraft:frost_golem"] = GOLEMS["frost_golem"]
REG["warcraft:lightning_golem"] = GOLEMS["lightning_golem"]
REG["warcraft:inferno_golem"] = GOLEMS["warcraft_inferno_golem"]
REG["warcraft:ember_colossus"] = GOLEMS["ember_colossus"]
REG["cb:inferno_golem"] = GOLEMS["cb_inferno_golem"]
REG["cb:hephaestus_golem"] = GOLEMS["cb_hephaestus_golem"]
