from .common import *
from .golems import golem


def frost_golem():
    return Spec(golem("geometry.frost_golem", "frost", target_h("warcraft:frost_golem") * 0.9), heavy=1.5, armed=False)

def lightning_golem():
    return Spec(golem("geometry.lightning_golem", "lightning", target_h("warcraft:lightning_golem") * 0.9), heavy=1.5, armed=False)

def warcraft_inferno_golem():
    return Spec(golem("geometry.inferno_golem", "inferno", target_h("warcraft:inferno_golem") * 0.9), heavy=1.5, armed=False)

def ember_colossus():
    return Spec(golem("geometry.ember_colossus", "ember", target_h("warcraft:ember_colossus") * 0.9, k=1.0), heavy=1.7, armed=False)

def cb_inferno_golem():
    return Spec(golem("geometry.cb_inferno_golem", "fel", target_h("cb:inferno_golem") * 0.9), heavy=1.5, armed=False)

def cb_hephaestus_golem():
    return Spec(golem("geometry.cb_hephaestus_golem", "forge", target_h("cb:hephaestus_golem") * 0.9), heavy=1.4, armed=False)

GOLEMS = dict(frost_golem=frost_golem, lightning_golem=lightning_golem, warcraft_inferno_golem=warcraft_inferno_golem,
              ember_colossus=ember_colossus, cb_inferno_golem=cb_inferno_golem, cb_hephaestus_golem=cb_hephaestus_golem)
