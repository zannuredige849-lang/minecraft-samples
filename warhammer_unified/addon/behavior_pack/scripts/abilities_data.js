// Создаётся tools/patch_bp.py из tools/forge/uniq.py
export const ABILITIES = {
 "warcraft:royal_captain": [
  {
   "k": "aura",
   "name": "Боевое знамя",
   "d": "Союзники рядом получают Силу I и Скорость I",
   "to": "allies",
   "r": 10,
   "fx": [
    [
     "strength",
     6,
     0
    ],
    [
     "speed",
     6,
     0
    ]
   ],
   "every": 80,
   "p": "minecraft:totem_particle"
  },
  {
   "k": "hurt",
   "name": "Контрудар",
   "d": "Отбрасывает обидчика назад",
   "thorns": 0,
   "below": null,
   "self_fx": [],
   "kb": [
    1.3,
    0.35
   ],
   "fx": [],
   "cd": 120,
   "heal": 0
  }
 ],
 "warcraft:royal_knight": [
  {
   "k": "cast",
   "do": "charge",
   "name": "Кавалерийская атака",
   "d": "Рывок на врага с ударом по площади",
   "cd": 140,
   "rng": 14,
   "dmg": 9,
   "r": 3
  },
  {
   "k": "hit",
   "name": "Копейный удар",
   "d": "Сильно отбрасывает цель",
   "ch": 0.35,
   "fx": [],
   "fire": 0,
   "kb": [
    1.6,
    0.4
   ],
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:dark_plate_knight": [
  {
   "k": "hit",
   "name": "Чёрная сталь",
   "d": "Удар иссушает цель",
   "ch": 0.35,
   "fx": [
    [
     "wither",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Шипастые латы",
   "d": "Возвращает часть урона и получает Сопротивление при HP<40%",
   "thorns": 3,
   "below": 0.4,
   "self_fx": [
    [
     "resistance",
     8,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 400,
   "heal": 0
  }
 ],
 "warcraft:elector_knight": [
  {
   "k": "cast",
   "do": "rally",
   "name": "Имперский приказ",
   "d": "Союзники получают Сопротивление I и Скорость I",
   "cd": 300,
   "rng": 16,
   "r": 12,
   "fx": [
    [
     "resistance",
     10,
     0
    ],
    [
     "speed",
     10,
     0
    ]
   ]
  },
  {
   "k": "hit",
   "name": "Печать выборщика",
   "d": "Замедляет цель",
   "ch": 0.25,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:garithos_paladin": [
  {
   "k": "cast",
   "do": "heal",
   "name": "Свет паладина",
   "d": "Лечит союзников вокруг",
   "cd": 200,
   "rng": 16,
   "r": 8,
   "amt": 6
  },
  {
   "k": "hit",
   "name": "Священный молот",
   "d": "Против нежити: +6 урона и огонь",
   "ch": 0.6,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": {
    "undead": {
     "dmg": 6,
     "fire": 4
    }
   },
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:heide_knight": [
  {
   "k": "aura",
   "name": "Вересковая стойка",
   "d": "Медленно регенерирует",
   "to": "self",
   "r": 0,
   "fx": [
    [
     "regeneration",
     4,
     0
    ]
   ],
   "every": 120,
   "p": null
  },
  {
   "k": "hurt",
   "name": "Стойка щита",
   "d": "При HP<50% получает Сопротивление II",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "resistance",
     8,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 500,
   "heal": 0
  }
 ],
 "warcraft:heide_hood_knight": [
  {
   "k": "cast",
   "do": "mist",
   "name": "Туман вереска",
   "d": "Слепит врагов рядом, сам становится невидимым",
   "cd": 400,
   "rng": 10,
   "r": 6,
   "fx": [
    [
     "blindness",
     4,
     0
    ]
   ],
   "self_fx": [
    [
     "invisibility",
     4,
     0
    ]
   ]
  },
  {
   "k": "hit",
   "name": "Удар из тумана",
   "d": "Сильнее бьёт, если цель ослеплена",
   "ch": 0.3,
   "fx": [
    [
     "weakness",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:high_elf_spearman": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Бросок лунного копья",
   "d": "Метает копьё на расстоянии",
   "cd": 100,
   "rng": 16,
   "dmg": 6,
   "p": "minecraft:basic_crit_particle"
  },
  {
   "k": "hit",
   "name": "Лунный шаг",
   "d": "После удара получает Скорость II",
   "ch": 0.25,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [
    [
     "speed",
     4,
     1
    ]
   ],
   "p": null
  }
 ],
 "warcraft:imperial_guard": [
  {
   "k": "cast",
   "do": "slam",
   "name": "Удар алебарды",
   "d": "Круговой удар с отбрасыванием",
   "cd": 120,
   "rng": 4,
   "r": 3.5,
   "dmg": 5,
   "kb": [
    1.2,
    0.35
   ]
  },
  {
   "k": "hurt",
   "name": "Строй стражи",
   "d": "Зовёт союзников: Сила I",
   "thorns": 0,
   "below": 0.7,
   "self_fx": [
    [
     "strength",
     6,
     0
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 500,
   "heal": 0
  }
 ],
 "warcraft:paladin_swordsman": [
  {
   "k": "hit",
   "name": "Клинок света",
   "d": "Поджигает и крадёт часть урона в здоровье",
   "ch": 0.3,
   "fx": [],
   "fire": 3,
   "kb": null,
   "steal": 0.15,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "cast",
   "do": "heal",
   "name": "Молитва",
   "d": "Лечит себя при HP<50%",
   "cd": 400,
   "rng": 12,
   "r": 0,
   "amt": 8,
   "only_self": true
  }
 ],
 "warcraft:royal_queen": [
  {
   "k": "cast",
   "do": "summon",
   "name": "Королевская гвардия",
   "d": "Призывает до трёх капитанов",
   "cd": 600,
   "rng": 14,
   "id": "warcraft:royal_captain",
   "n": 1,
   "cap": 3
  },
  {
   "k": "aura",
   "name": "Благословение королевы",
   "d": "Союзники регенерируют",
   "to": "allies",
   "r": 10,
   "fx": [
    [
     "regeneration",
     4,
     0
    ]
   ],
   "every": 100,
   "p": "minecraft:heart_particle"
  }
 ],
 "warcraft:teutonic_cleric": [
  {
   "k": "cast",
   "do": "heal",
   "name": "Исцеляющая молитва",
   "d": "Сильное лечение союзников",
   "cd": 140,
   "rng": 14,
   "r": 10,
   "amt": 8
  },
  {
   "k": "aura",
   "name": "Кара нечестивым",
   "d": "Нежить рядом слабеет",
   "to": "foes",
   "r": 8,
   "fx": [
    [
     "weakness",
     4,
     0
    ]
   ],
   "every": 80,
   "p": null
  }
 ],
 "warcraft:chival_warrior": [
  {
   "k": "hit",
   "name": "Рыцарский удар",
   "d": "Мощно отбрасывает цель",
   "ch": 0.3,
   "fx": [],
   "fire": 0,
   "kb": [
    1.9,
    0.5
   ],
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "cast",
   "do": "leap",
   "name": "Рывок рыцаря",
   "d": "Прыжок на врага",
   "cd": 120,
   "rng": 10,
   "h": 0.9,
   "v": 0.5
  }
 ],
 "warcraft:bandit_raider": [
  {
   "k": "hit",
   "name": "Грабёж",
   "d": "Вызывает голод и замедляет цель",
   "ch": 0.3,
   "fx": [
    [
     "hunger",
     6,
     1
    ],
    [
     "slowness",
     2,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Кража удачи",
   "d": "При HP<40% быстро убегает",
   "thorns": 0,
   "below": 0.4,
   "self_fx": [
    [
     "speed",
     5,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 500,
   "heal": 0
  }
 ],
 "warcraft:bandit_dog": [
  {
   "k": "cast",
   "do": "leap",
   "name": "Прыжок гончей",
   "d": "Кидается на врага",
   "cd": 80,
   "rng": 9,
   "h": 0.95,
   "v": 0.45
  },
  {
   "k": "hit",
   "name": "Заражённый укус",
   "d": "Яд на 4 сек",
   "ch": 0.3,
   "fx": [
    [
     "poison",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:chaos_warrior": [
  {
   "k": "hit",
   "name": "Метка Хаоса",
   "d": "Иссушение на 3 сек",
   "ch": 0.3,
   "fx": [
    [
     "wither",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Дар Хаоса",
   "d": "При HP<50% получает Силу II",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "strength",
     10,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 600,
   "heal": 0
  }
 ],
 "warcraft:norse_berserker": [
  {
   "k": "hurt",
   "name": "Ярость берсерка",
   "d": "При HP<50% впадает в ярость: Сила II, Скорость I",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "strength",
     10,
     1
    ],
    [
     "speed",
     10,
     0
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 700,
   "heal": 0
  },
  {
   "k": "hit",
   "name": "Двойной замах",
   "d": "Бьёт по площади вокруг цели",
   "ch": 0.5,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": {
    "r": 2.5,
    "dmg": 3
   },
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:norse_marauder": [
  {
   "k": "hit",
   "name": "Абордажный крюк",
   "d": "Замедляет цель",
   "ch": 0.3,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "cast",
   "do": "leap",
   "name": "Прыжок с борта",
   "d": "Прыжок на врага",
   "cd": 150,
   "rng": 9,
   "h": 0.9,
   "v": 0.5
  }
 ],
 "warcraft:norse_shaman": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Руна льда",
   "d": "Ледяной снаряд с замедлением",
   "cd": 90,
   "rng": 14,
   "dmg": 5,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "p": "minecraft:snowflake_particle"
  },
  {
   "k": "cast",
   "do": "heal",
   "name": "Дух предков",
   "d": "Лечит союзников",
   "cd": 300,
   "rng": 12,
   "r": 8,
   "amt": 6
  }
 ],
 "warcraft:skaal_villager": [
  {
   "k": "hurt",
   "name": "Клич деревни",
   "d": "Зовёт соседей: Сила I",
   "thorns": 0,
   "below": 0.9,
   "self_fx": [
    [
     "strength",
     6,
     0
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 400,
   "heal": 0
  },
  {
   "k": "aura",
   "name": "Родная земля",
   "d": "Лёгкая регенерация",
   "to": "self",
   "r": 0,
   "fx": [
    [
     "regeneration",
     3,
     0
    ]
   ],
   "every": 160,
   "p": null
  }
 ],
 "warcraft:wulfrik_champion": [
  {
   "k": "cast",
   "do": "fear",
   "name": "Вой Странника",
   "d": "Враги слабеют и замедляются",
   "cd": 300,
   "rng": 10,
   "r": 8,
   "fx": [
    [
     "weakness",
     5,
     0
    ],
    [
     "slowness",
     4,
     1
    ]
   ]
  },
  {
   "k": "hit",
   "name": "Кровь волка",
   "d": "Крадёт часть урона в здоровье",
   "ch": 0.4,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0.2,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:sabertooth_rider": [
  {
   "k": "cast",
   "do": "charge",
   "name": "Прыжок саблезуба",
   "d": "Рывок и удар по площади",
   "cd": 120,
   "rng": 14,
   "dmg": 7,
   "r": 3
  },
  {
   "k": "hit",
   "name": "Кровавая рана",
   "d": "Яд (кровотечение) на 5 сек",
   "ch": 0.3,
   "fx": [
    [
     "poison",
     5,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:chaos_knight": [
  {
   "k": "cast",
   "do": "charge",
   "name": "Копьё Хаоса",
   "d": "Таранный удар копьём",
   "cd": 150,
   "rng": 15,
   "dmg": 10,
   "r": 3,
   "fx": [
    [
     "wither",
     3,
     0
    ]
   ]
  },
  {
   "k": "aura",
   "name": "Страх перед Хаосом",
   "d": "Враги рядом слабеют",
   "to": "foes",
   "r": 5,
   "fx": [
    [
     "weakness",
     3,
     0
    ]
   ],
   "every": 80,
   "p": null
  }
 ],
 "warcraft:void_knight": [
  {
   "k": "cast",
   "do": "blink",
   "name": "Шаг Пустоты",
   "d": "Телепортируется за спину врагу",
   "cd": 160,
   "rng": 14
  },
  {
   "k": "hit",
   "name": "Разрыв Пустоты",
   "d": "Подбрасывает цель левитацией",
   "ch": 0.25,
   "fx": [
    [
     "levitation",
     2,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:hornet_demon": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Ядовитое жало",
   "d": "Метает жало с ядом",
   "cd": 80,
   "rng": 12,
   "dmg": 3,
   "fx": [
    [
     "poison",
     6,
     0
    ]
   ],
   "p": "minecraft:villager_angry"
  },
  {
   "k": "hit",
   "name": "Укус роя",
   "d": "Яд при каждом втором ударе",
   "ch": 0.5,
   "fx": [
    [
     "poison",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:blood_angel": [
  {
   "k": "hit",
   "name": "Кровавое крыло",
   "d": "Крадёт часть урона в здоровье",
   "ch": 0.5,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0.25,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "cast",
   "do": "slam",
   "name": "Алый вихрь",
   "d": "Круговой удар крыльями",
   "cd": 140,
   "rng": 5,
   "r": 4,
   "dmg": 6,
   "kb": [
    1.0,
    0.4
   ]
  }
 ],
 "warcraft:black_blocker": [
  {
   "k": "cast",
   "do": "slam",
   "name": "Сокрушение",
   "d": "Мощный удар по земле",
   "cd": 140,
   "rng": 6,
   "r": 5,
   "dmg": 8,
   "kb": [
    1.6,
    0.6
   ]
  },
  {
   "k": "hurt",
   "name": "Каменная кожа",
   "d": "Отражает урон",
   "thorns": 2,
   "below": null,
   "self_fx": [],
   "kb": null,
   "fx": [],
   "cd": 100,
   "heal": 0
  }
 ],
 "warcraft:pink_horror": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Синее пламя",
   "d": "Огненный заряд Тзинча",
   "cd": 70,
   "rng": 12,
   "dmg": 4,
   "fire": 3,
   "p": "minecraft:blue_flame_particle"
  },
  {
   "k": "death",
   "name": "Расщепление",
   "d": "Умирая, делится на двух меньших ужасов",
   "burst": null,
   "spawn": [
    "warcraft:pink_horror",
    2
   ],
   "fx": [],
   "p": null
  }
 ],
 "warcraft:burning_chariot": [
  {
   "k": "cast",
   "do": "charge",
   "name": "Таран колесницы",
   "d": "Разгон и огненный удар",
   "cd": 100,
   "rng": 14,
   "dmg": 9,
   "r": 3,
   "fire": 4
  },
  {
   "k": "aura",
   "name": "Огненный след",
   "d": "Поджигает врагов вплотную",
   "to": "foes",
   "r": 3,
   "fx": [],
   "every": 20,
   "p": "minecraft:basic_flame_particle"
  },
  {
   "k": "death",
   "name": "Взрыв колесницы",
   "d": "При гибели взрывается огнём",
   "burst": {
    "r": 4,
    "dmg": 6,
    "fire": 4
   },
   "spawn": null,
   "fx": [],
   "p": null
  }
 ],
 "warcraft:great_unclean_one": [
  {
   "k": "aura",
   "name": "Зловоние Нургла",
   "d": "Яд и тошнота врагам вокруг",
   "to": "foes",
   "r": 8,
   "fx": [
    [
     "poison",
     3,
     0
    ],
    [
     "nausea",
     5,
     0
    ]
   ],
   "every": 60,
   "p": "minecraft:spore_blossom_ambient_particle"
  }
 ],
 "warcraft:abomination_lord": [
  {
   "k": "hit",
   "name": "Гниль",
   "d": "Голод и яд",
   "ch": 0.4,
   "fx": [
    [
     "hunger",
     8,
     1
    ],
    [
     "poison",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "death",
   "name": "Чумное облако",
   "d": "При гибели ядовитое облако",
   "burst": {
    "r": 4,
    "dmg": 2,
    "fx": [
     [
      "poison",
      8,
      1
     ]
    ]
   },
   "spawn": null,
   "fx": [],
   "p": null
  }
 ],
 "warcraft:faceless_warrior": [
  {
   "k": "hit",
   "name": "Пустой взгляд",
   "d": "Слабость на 4 сек",
   "ch": 0.3,
   "fx": [
    [
     "weakness",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Стойка безликого",
   "d": "При HP<50% Сопротивление I",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "resistance",
     8,
     0
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 500,
   "heal": 0
  }
 ],
 "warcraft:faceless_berserker": [
  {
   "k": "hit",
   "name": "Пустая ярость",
   "d": "Удар по площади",
   "ch": 0.5,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": {
    "r": 2.5,
    "dmg": 3
   },
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Бешенство безликого",
   "d": "При HP<40% Сила II",
   "thorns": 0,
   "below": 0.4,
   "self_fx": [
    [
     "strength",
     10,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 600,
   "heal": 0
  }
 ],
 "warcraft:faceless_general": [
  {
   "k": "aura",
   "name": "Приказ безликих",
   "d": "Союзники получают Силу и Сопротивление",
   "to": "allies",
   "r": 12,
   "fx": [
    [
     "strength",
     6,
     0
    ],
    [
     "resistance",
     6,
     0
    ]
   ],
   "every": 80,
   "p": "minecraft:totem_particle"
  },
  {
   "k": "cast",
   "do": "summon",
   "name": "Зов легиона",
   "d": "Призывает безликих воинов",
   "cd": 500,
   "rng": 16,
   "id": "warcraft:faceless_warrior",
   "n": 1,
   "cap": 3
  }
 ],
 "warcraft:faceless_sorcerer": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Бессловесное заклятие",
   "d": "Магический снаряд с тошнотой",
   "cd": 80,
   "rng": 16,
   "dmg": 6,
   "fx": [
    [
     "nausea",
     4,
     0
    ]
   ],
   "p": "minecraft:witchspell_emitter"
  },
  {
   "k": "cast",
   "do": "blink",
   "name": "Сдвиг",
   "d": "Телепортируется за врага",
   "cd": 200,
   "rng": 14
  }
 ],
 "warcraft:faceless_cultist": [
  {
   "k": "aura",
   "name": "Тьма культа",
   "d": "Окутывает врагов тьмой",
   "to": "foes",
   "r": 8,
   "fx": [
    [
     "darkness",
     4,
     0
    ]
   ],
   "every": 100,
   "p": null
  },
  {
   "k": "death",
   "name": "Жертвенный огонь",
   "d": "При гибели вспышка тьмы",
   "burst": {
    "r": 3,
    "dmg": 3,
    "fx": [
     [
      "blindness",
      3,
      0
     ]
    ]
   },
   "spawn": null,
   "fx": [],
   "p": null
  }
 ],
 "warcraft:faceless_nightmare": [
  {
   "k": "cast",
   "do": "mist",
   "name": "Пелена кошмара",
   "d": "Слепит врагов, сам невидим",
   "cd": 300,
   "rng": 10,
   "r": 7,
   "fx": [
    [
     "blindness",
     4,
     0
    ]
   ],
   "self_fx": [
    [
     "invisibility",
     5,
     0
    ]
   ]
  },
  {
   "k": "hit",
   "name": "Кошмар",
   "d": "Тошнота и замедление",
   "ch": 0.35,
   "fx": [
    [
     "nausea",
     5,
     0
    ],
    [
     "slowness",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:nazgul": [
  {
   "k": "aura",
   "name": "Дыхание Назгула",
   "d": "Слабость и голод у врагов",
   "to": "foes",
   "r": 8,
   "fx": [
    [
     "weakness",
     3,
     0
    ],
    [
     "hunger",
     3,
     1
    ]
   ],
   "every": 80,
   "p": "minecraft:soul_particle"
  },
  {
   "k": "hit",
   "name": "Клинок-призрак",
   "d": "Иссушение",
   "ch": 0.4,
   "fx": [
    [
     "wither",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:pirate_ghost": [
  {
   "k": "cast",
   "do": "blink",
   "name": "Призрачный шаг",
   "d": "Появляется рядом с врагом",
   "cd": 150,
   "rng": 12
  },
  {
   "k": "hit",
   "name": "Проклятие капитана",
   "d": "Замедление и слепота",
   "ch": 0.3,
   "fx": [
    [
     "slowness",
     3,
     1
    ],
    [
     "blindness",
     2,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:skeleton_bear": [
  {
   "k": "hit",
   "name": "Костяной удар",
   "d": "Замедляет цель",
   "ch": 0.35,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "fire": 0,
   "kb": [
    1.2,
    0.3
   ],
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "cast",
   "do": "leap",
   "name": "Прыжок мертвеца",
   "d": "Кидается на врага",
   "cd": 120,
   "rng": 9,
   "h": 0.9,
   "v": 0.5
  }
 ],
 "warcraft:undead_zombie": [
  {
   "k": "hit",
   "name": "Чумной укус",
   "d": "Голод и яд",
   "ch": 0.35,
   "fx": [
    [
     "hunger",
     6,
     0
    ],
    [
     "poison",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "aura",
   "name": "Смрад",
   "d": "Медленно замедляет врагов вплотную",
   "to": "foes",
   "r": 3,
   "fx": [
    [
     "slowness",
     2,
     0
    ]
   ],
   "every": 60,
   "p": null
  }
 ],
 "warcraft:santa_claus": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Снежок из мешка",
   "d": "Снежок с замедлением",
   "cd": 70,
   "rng": 12,
   "dmg": 3,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "p": "minecraft:snowflake_particle"
  },
  {
   "k": "aura",
   "name": "Праздничное тепло",
   "d": "Союзники регенерируют",
   "to": "allies",
   "r": 10,
   "fx": [
    [
     "regeneration",
     4,
     0
    ]
   ],
   "every": 100,
   "p": "minecraft:heart_particle"
  },
  {
   "k": "death",
   "name": "Мешок подарков",
   "d": "При гибели рассыпает подарки",
   "burst": {
    "r": 3,
    "dmg": 0,
    "fx": [
     [
      "slowness",
      3,
      1
     ]
    ]
   },
   "spawn": null,
   "fx": [],
   "p": null
  }
 ],
 "warcraft:ice_demon": [
  {
   "k": "aura",
   "name": "Стужа",
   "d": "Замедляет врагов рядом",
   "to": "foes",
   "r": 6,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "every": 60,
   "p": "minecraft:snowflake_particle"
  },
  {
   "k": "hit",
   "name": "Ледяное касание",
   "d": "Замораживает: замедление III и усталость",
   "ch": 0.4,
   "fx": [
    [
     "slowness",
     3,
     2
    ],
    [
     "mining_fatigue",
     3,
     1
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "warcraft:grizzly_bear": [
  {
   "k": "hit",
   "name": "Медвежий удар",
   "d": "Мощное отбрасывание",
   "ch": 0.3,
   "fx": [],
   "fire": 0,
   "kb": [
    1.6,
    0.45
   ],
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Ярость гризли",
   "d": "При HP<50% Сила I и Скорость I",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "strength",
     10,
     0
    ],
    [
     "speed",
     10,
     0
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 600,
   "heal": 0
  }
 ],
 "warcraft:big_ent": [
  {
   "k": "cast",
   "do": "heal",
   "name": "Сок древа",
   "d": "Лечит союзников и себя",
   "cd": 220,
   "rng": 14,
   "r": 10,
   "amt": 6,
   "self_too": true
  },
  {
   "k": "cast",
   "do": "pull",
   "name": "Корни",
   "d": "Притягивает врагов и замедляет",
   "cd": 260,
   "rng": 10,
   "r": 8,
   "str": 1.2,
   "fx": [
    [
     "slowness",
     4,
     2
    ]
   ]
  },
  {
   "k": "aura",
   "name": "Лесная аура",
   "d": "Регенерация союзникам",
   "to": "allies",
   "r": 10,
   "fx": [
    [
     "regeneration",
     3,
     0
    ]
   ],
   "every": 100,
   "p": "minecraft:villager_happy"
  }
 ],
 "warcraft:frost_golem": [
  {
   "k": "aura",
   "name": "Дыхание мороза",
   "d": "Замедляет врагов",
   "to": "foes",
   "r": 6,
   "fx": [
    [
     "slowness",
     3,
     1
    ]
   ],
   "every": 60,
   "p": "minecraft:snowflake_particle"
  }
 ],
 "warcraft:lightning_golem": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Цепная молния",
   "d": "Разряд, перескакивающий на ближних врагов",
   "cd": 90,
   "rng": 14,
   "dmg": 6,
   "chain": {
    "n": 2,
    "r": 5,
    "dmg": 4
   },
   "p": "minecraft:electric_spark_particle"
  }
 ],
 "warcraft:inferno_golem": [
  {
   "k": "aura",
   "name": "Жар горна",
   "d": "Поджигает врагов вплотную",
   "to": "foes",
   "r": 4,
   "fx": [],
   "every": 30,
   "p": "minecraft:basic_flame_particle"
  }
 ],
 "warcraft:ember_colossus": [
  {
   "k": "death",
   "name": "Взрыв углей",
   "d": "При гибели рассыпается огненным взрывом",
   "burst": {
    "r": 5,
    "dmg": 8,
    "fire": 5
   },
   "spawn": null,
   "fx": [],
   "p": null
  },
  {
   "k": "aura",
   "name": "Тлеющая земля",
   "d": "Поджигает врагов вплотную",
   "to": "foes",
   "r": 4,
   "fx": [],
   "every": 40,
   "p": "minecraft:basic_flame_particle"
  }
 ],
 "cb:inferno_golem": [
  {
   "k": "aura",
   "name": "Зелёное пламя",
   "d": "Иссушает врагов вплотную",
   "to": "foes",
   "r": 4,
   "fx": [
    [
     "wither",
     2,
     0
    ]
   ],
   "every": 40,
   "p": "minecraft:soul_particle"
  }
 ],
 "cb:hephaestus_golem": [
  {
   "k": "cast",
   "do": "heal",
   "name": "Починка",
   "d": "Лечит союзных големов и олимпийцев",
   "cd": 240,
   "rng": 14,
   "r": 10,
   "amt": 8
  },
  {
   "k": "hit",
   "name": "Удар молота",
   "d": "Огненный удар",
   "ch": 0.35,
   "fx": [],
   "fire": 3,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:goblin": [
  {
   "k": "hit",
   "name": "Воровская лапа",
   "d": "Быстро отскакивает после удара",
   "ch": 0.4,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [
    [
     "speed",
     4,
     2
    ]
   ],
   "p": null
  },
  {
   "k": "hurt",
   "name": "Трусость",
   "d": "При HP<50% убегает",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "speed",
     6,
     2
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 400,
   "heal": 0
  }
 ],
 "cb:orc": [
  {
   "k": "aura",
   "name": "Боевой клич",
   "d": "Орки рядом получают Силу I",
   "to": "allies",
   "r": 8,
   "fx": [
    [
     "strength",
     5,
     0
    ]
   ],
   "every": 120,
   "p": "minecraft:totem_particle"
  }
 ],
 "cb:green_orc": [
  {
   "k": "hit",
   "name": "Рваная рана",
   "d": "Яд на 3 сек",
   "ch": 0.25,
   "fx": [
    [
     "poison",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:hell_orc": [
  {
   "k": "hit",
   "name": "Адский удар",
   "d": "Поджигает цель",
   "ch": 0.35,
   "fx": [],
   "fire": 3,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:fel_minion": [
  {
   "k": "hit",
   "name": "Касание Скверны",
   "d": "Замедление и слабость",
   "ch": 0.3,
   "fx": [
    [
     "slowness",
     2,
     0
    ],
    [
     "weakness",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:smart_troll": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Метание копья",
   "d": "Бросает копьё",
   "cd": 100,
   "rng": 14,
   "dmg": 5,
   "p": "minecraft:basic_crit_particle"
  },
  {
   "k": "aura",
   "name": "Смекалка",
   "d": "Тролли рядом получают Скорость",
   "to": "allies",
   "r": 8,
   "fx": [
    [
     "speed",
     4,
     0
    ]
   ],
   "every": 120,
   "p": null
  }
 ],
 "cb:tribal_troll": [
  {
   "k": "cast",
   "do": "heal",
   "name": "Тотем исцеления",
   "d": "Лечит союзников",
   "cd": 220,
   "rng": 12,
   "r": 8,
   "amt": 5
  },
  {
   "k": "cast",
   "do": "rally",
   "name": "Зов племени",
   "d": "Силу и скорость соплеменникам",
   "cd": 400,
   "rng": 14,
   "r": 10,
   "fx": [
    [
     "strength",
     8,
     0
    ],
    [
     "speed",
     8,
     0
    ]
   ]
  }
 ],
 "cb:wild_troll": [
  {
   "k": "aura",
   "name": "Регенерация тролля",
   "d": "Быстро регенерирует",
   "to": "self",
   "r": 0,
   "fx": [
    [
     "regeneration",
     3,
     1
    ]
   ],
   "every": 80,
   "p": null
  },
  {
   "k": "hit",
   "name": "Дубина",
   "d": "Отбрасывает",
   "ch": 0.3,
   "fx": [],
   "fire": 0,
   "kb": [
    1.4,
    0.4
   ],
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:cannibal_troll": [
  {
   "k": "hit",
   "name": "Пожирание",
   "d": "Крадёт часть урона в здоровье, голод цели",
   "ch": 0.4,
   "fx": [
    [
     "hunger",
     5,
     1
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0.3,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "cast",
   "do": "slam",
   "name": "Удар в землю",
   "d": "Топот по площади",
   "cd": 160,
   "rng": 5,
   "r": 4,
   "dmg": 6,
   "kb": [
    1.2,
    0.5
   ]
  }
 ],
 "cb:ice_troll": [
  {
   "k": "aura",
   "name": "Иней",
   "d": "Замедляет врагов вплотную",
   "to": "foes",
   "r": 4,
   "fx": [
    [
     "slowness",
     2,
     0
    ]
   ],
   "every": 60,
   "p": "minecraft:snowflake_particle"
  },
  {
   "k": "hit",
   "name": "Ледяная дубина",
   "d": "Замораживает цель",
   "ch": 0.3,
   "fx": [
    [
     "slowness",
     3,
     2
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:troll_totem": [
  {
   "k": "aura",
   "name": "Дух племени",
   "d": "Тролли и орки рядом регенерируют",
   "to": "allies",
   "r": 10,
   "fx": [
    [
     "regeneration",
     3,
     0
    ],
    [
     "resistance",
     3,
     0
    ]
   ],
   "every": 80,
   "p": "minecraft:totem_particle"
  }
 ],
 "cb:warg": [
  {
   "k": "cast",
   "do": "leap",
   "name": "Прыжок варга",
   "d": "Кидается на врага",
   "cd": 100,
   "rng": 10,
   "h": 1.0,
   "v": 0.5
  },
  {
   "k": "hit",
   "name": "Волчий укус",
   "d": "Кровотечение (яд)",
   "ch": 0.3,
   "fx": [
    [
     "poison",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:thunder_lizard": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Раскат грома",
   "d": "Разряд молнии с цепным ударом",
   "cd": 140,
   "rng": 14,
   "dmg": 6,
   "chain": {
    "n": 2,
    "r": 5,
    "dmg": 3
   },
   "p": "minecraft:electric_spark_particle"
  },
  {
   "k": "cast",
   "do": "charge",
   "name": "Таран ящера",
   "d": "Рывок с ударом",
   "cd": 160,
   "rng": 14,
   "dmg": 8,
   "r": 3
  }
 ],
 "cb:mermaid": [
  {
   "k": "aura",
   "name": "Песнь течений",
   "d": "Игроки и союзники рядом дышат под водой",
   "to": "allies",
   "r": 8,
   "fx": [
    [
     "water_breathing",
     8,
     0
    ]
   ],
   "every": 120,
   "p": "minecraft:basic_bubble_particle"
  }
 ],
 "cb:siren": [
  {
   "k": "cast",
   "do": "fear",
   "name": "Зов сирены",
   "d": "Враги слабеют и замедляются",
   "cd": 260,
   "rng": 12,
   "r": 10,
   "fx": [
    [
     "slowness",
     4,
     1
    ],
    [
     "nausea",
     5,
     0
    ]
   ]
  },
  {
   "k": "hit",
   "name": "Ядовитая песнь",
   "d": "Яд",
   "ch": 0.3,
   "fx": [
    [
     "poison",
     4,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:poseidon_triton": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Трезубец",
   "d": "Бросок трезубца",
   "cd": 100,
   "rng": 14,
   "dmg": 6,
   "p": "minecraft:basic_bubble_particle"
  },
  {
   "k": "aura",
   "name": "Благословение моря",
   "d": "Дыхание под водой союзникам",
   "to": "allies",
   "r": 8,
   "fx": [
    [
     "water_breathing",
     8,
     0
    ],
    [
     "speed",
     4,
     0
    ]
   ],
   "every": 100,
   "p": null
  }
 ],
 "cb:zeus_archon": [
  {
   "k": "cast",
   "do": "bolt",
   "name": "Гнев Зевса",
   "d": "Молния с цепным ударом",
   "cd": 100,
   "rng": 16,
   "dmg": 7,
   "chain": {
    "n": 2,
    "r": 5,
    "dmg": 4
   },
   "p": "minecraft:electric_spark_particle"
  },
  {
   "k": "hit",
   "name": "Грозовой удар",
   "d": "Оглушает: слабость и замедление",
   "ch": 0.3,
   "fx": [
    [
     "slowness",
     2,
     1
    ],
    [
     "weakness",
     2,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:ares_berserker": [
  {
   "k": "hurt",
   "name": "Кровь Ареса",
   "d": "При HP<50% Сила II",
   "thorns": 0,
   "below": 0.5,
   "self_fx": [
    [
     "strength",
     10,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 500,
   "heal": 0
  },
  {
   "k": "hit",
   "name": "Боевой раж",
   "d": "Крадёт здоровье",
   "ch": 0.4,
   "fx": [],
   "fire": 0,
   "kb": null,
   "steal": 0.2,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:athena_hoplite": [
  {
   "k": "hurt",
   "name": "Щит фаланги",
   "d": "При HP<60% Сопротивление II",
   "thorns": 0,
   "below": 0.6,
   "self_fx": [
    [
     "resistance",
     8,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 400,
   "heal": 0
  },
  {
   "k": "aura",
   "name": "Фаланга",
   "d": "Союзники рядом получают Сопротивление I",
   "to": "allies",
   "r": 8,
   "fx": [
    [
     "resistance",
     4,
     0
    ]
   ],
   "every": 100,
   "p": null
  }
 ],
 "cb:hades_shade": [
  {
   "k": "cast",
   "do": "blink",
   "name": "Шаг теней",
   "d": "Появляется рядом с врагом",
   "cd": 140,
   "rng": 12
  },
  {
   "k": "hit",
   "name": "Касание Аида",
   "d": "Иссушение",
   "ch": 0.35,
   "fx": [
    [
     "wither",
     3,
     0
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  }
 ],
 "cb:death_knight": [
  {
   "k": "hit",
   "name": "Чумной клинок",
   "d": "Иссушение и замедление",
   "ch": 0.4,
   "fx": [
    [
     "wither",
     3,
     0
    ],
    [
     "slowness",
     2,
     1
    ]
   ],
   "fire": 0,
   "kb": null,
   "steal": 0,
   "chain": null,
   "cleave": null,
   "vs": null,
   "self_fx": [],
   "p": null
  },
  {
   "k": "aura",
   "name": "Холод могилы",
   "d": "Замедляет врагов рядом",
   "to": "foes",
   "r": 5,
   "fx": [
    [
     "slowness",
     2,
     0
    ]
   ],
   "every": 80,
   "p": "minecraft:soul_particle"
  }
 ],
 "cb:ice_spirit": [
  {
   "k": "aura",
   "name": "Морозный вихрь",
   "d": "Сильно замедляет врагов вплотную",
   "to": "foes",
   "r": 5,
   "fx": [
    [
     "slowness",
     3,
     2
    ]
   ],
   "every": 50,
   "p": "minecraft:snowflake_particle"
  },
  {
   "k": "death",
   "name": "Ледяной взрыв",
   "d": "При гибели замораживает всё рядом",
   "burst": {
    "r": 4,
    "dmg": 3,
    "fx": [
     [
      "slowness",
      5,
      2
     ]
    ]
   },
   "spawn": null,
   "fx": [],
   "p": null
  }
 ],
 "cb:human_villager": [
  {
   "k": "hurt",
   "name": "Тревога",
   "d": "Зовёт стражу: даёт Силу соседям",
   "thorns": 0,
   "below": 0.8,
   "self_fx": [
    [
     "speed",
     4,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 400,
   "heal": 0
  }
 ],
 "cb:human_civilian": [
  {
   "k": "hurt",
   "name": "Паника",
   "d": "Быстро убегает от опасности",
   "thorns": 0,
   "below": 0.9,
   "self_fx": [
    [
     "speed",
     5,
     1
    ]
   ],
   "kb": null,
   "fx": [],
   "cd": 300,
   "heal": 0
  }
 ],
 "cb:dragon_east": [
  {
   "k": "aura",
   "name": "Небесный жар",
   "d": "Поджигает врагов вплотную",
   "to": "foes",
   "r": 5,
   "fx": [],
   "every": 40,
   "p": "minecraft:basic_flame_particle"
  }
 ],
 "cb:dragon_west": [
  {
   "k": "aura",
   "name": "Огненное дыхание",
   "d": "Поджигает врагов вплотную",
   "to": "foes",
   "r": 5,
   "fx": [],
   "every": 40,
   "p": "minecraft:basic_flame_particle"
  }
 ]
};
export const DROPS = {
 "warcraft:royal_captain": [
  [
   "minecraft:gold_nugget",
   3,
   6,
   1.0,
   "§6Печать капитана",
   "Королевская гвардия"
  ],
  [
   "minecraft:emerald",
   1,
   1,
   0.25,
   "§aЖалование стражи",
   ""
  ]
 ],
 "warcraft:royal_knight": [
  [
   "minecraft:iron_ingot",
   2,
   4,
   1.0,
   "§fКоролевская сталь",
   ""
  ],
  [
   "minecraft:lead",
   1,
   1,
   0.3,
   "§fУздечка боевого коня",
   ""
  ]
 ],
 "warcraft:dark_plate_knight": [
  [
   "minecraft:netherite_scrap",
   1,
   1,
   0.08,
   "§8Осколок чёрных лат",
   ""
  ],
  [
   "minecraft:coal",
   3,
   6,
   1.0,
   "§8Закопчённая сталь",
   ""
  ]
 ],
 "warcraft:elector_knight": [
  [
   "minecraft:paper",
   1,
   2,
   1.0,
   "§eГрамота выборщика",
   "Голос на императорском совете"
  ],
  [
   "minecraft:gold_nugget",
   2,
   5,
   0.8,
   "§6Имперский талер",
   ""
  ]
 ],
 "warcraft:garithos_paladin": [
  [
   "minecraft:glowstone_dust",
   2,
   5,
   1.0,
   "§eСвятая пыль",
   ""
  ],
  [
   "minecraft:totem_of_undying",
   1,
   1,
   0.06,
   "§6Тотем Гаритоса",
   ""
  ]
 ],
 "warcraft:heide_knight": [
  [
   "minecraft:iron_nugget",
   4,
   8,
   1.0,
   "§7Кольчужная заклёпка",
   ""
  ],
  [
   "minecraft:sweet_berries",
   2,
   4,
   0.7,
   "§2Вересковые ягоды",
   ""
  ]
 ],
 "warcraft:heide_hood_knight": [
  [
   "minecraft:leather",
   2,
   4,
   1.0,
   "§2Плащ из вереска",
   ""
  ],
  [
   "minecraft:fermented_spider_eye",
   1,
   1,
   0.3,
   "§2Вересковый настой",
   ""
  ]
 ],
 "warcraft:high_elf_spearman": [
  [
   "minecraft:amethyst_shard",
   1,
   3,
   1.0,
   "§bЛунный осколок",
   ""
  ],
  [
   "minecraft:feather",
   2,
   4,
   0.8,
   "§fЭльфийское перо",
   ""
  ]
 ],
 "warcraft:imperial_guard": [
  [
   "minecraft:iron_ingot",
   1,
   3,
   1.0,
   "§cИмперский значок",
   ""
  ],
  [
   "minecraft:red_dye",
   1,
   3,
   0.6,
   "§cКраска мундира",
   ""
  ]
 ],
 "warcraft:paladin_swordsman": [
  [
   "minecraft:glowstone_dust",
   1,
   3,
   1.0,
   "§eСвет клинка",
   ""
  ],
  [
   "minecraft:golden_apple",
   1,
   1,
   0.1,
   "§6Освящённое яблоко",
   ""
  ]
 ],
 "warcraft:royal_queen": [
  [
   "minecraft:diamond",
   1,
   1,
   0.3,
   "§bСлеза королевы",
   ""
  ],
  [
   "minecraft:gold_ingot",
   2,
   4,
   1.0,
   "§6Корона регентши",
   ""
  ]
 ],
 "warcraft:teutonic_cleric": [
  [
   "minecraft:book",
   1,
   1,
   0.6,
   "§fМолитвенник",
   "Тевтонский орден"
  ],
  [
   "minecraft:glowstone_dust",
   1,
   3,
   0.8,
   "§eСвятой порошок",
   ""
  ]
 ],
 "warcraft:chival_warrior": [
  [
   "minecraft:copper_ingot",
   2,
   4,
   1.0,
   "§6Бронзовая бляха",
   ""
  ],
  [
   "minecraft:iron_nugget",
   3,
   6,
   0.8,
   "§7Гвоздь лат",
   ""
  ]
 ],
 "warcraft:bandit_raider": [
  [
   "minecraft:gold_nugget",
   4,
   9,
   1.0,
   "§6Награбленное",
   ""
  ],
  [
   "minecraft:emerald",
   1,
   2,
   0.35,
   "§aУкраденный изумруд",
   ""
  ]
 ],
 "warcraft:bandit_dog": [
  [
   "minecraft:bone",
   1,
   3,
   1.0,
   "§7Клык гончей",
   ""
  ],
  [
   "minecraft:rotten_flesh",
   1,
   2,
   0.6,
   "§7Падаль",
   ""
  ]
 ],
 "warcraft:chaos_warrior": [
  [
   "minecraft:blaze_powder",
   1,
   3,
   1.0,
   "§cОгонь Хаоса",
   ""
  ],
  [
   "minecraft:ender_pearl",
   1,
   1,
   0.2,
   "§5Жемчужина Хаоса",
   ""
  ]
 ],
 "warcraft:norse_berserker": [
  [
   "minecraft:red_dye",
   1,
   2,
   1.0,
   "§cБоевая краска",
   ""
  ],
  [
   "minecraft:iron_axe",
   1,
   1,
   0.08,
   "§7Топор берсерка",
   ""
  ]
 ],
 "warcraft:norse_marauder": [
  [
   "minecraft:string",
   2,
   5,
   1.0,
   "§fКанат драккара",
   ""
  ],
  [
   "minecraft:iron_nugget",
   3,
   6,
   0.8,
   "§7Серебро набега",
   ""
  ]
 ],
 "warcraft:norse_shaman": [
  [
   "minecraft:bone",
   2,
   4,
   1.0,
   "§fРунная кость",
   ""
  ],
  [
   "minecraft:lapis_lazuli",
   2,
   5,
   0.7,
   "§9Руническая синь",
   ""
  ]
 ],
 "warcraft:skaal_villager": [
  [
   "minecraft:wheat",
   2,
   4,
   1.0,
   "§eСкаальская пшеница",
   ""
  ],
  [
   "minecraft:bread",
   1,
   2,
   0.5,
   "§6Хлеб Скаала",
   ""
  ]
 ],
 "warcraft:wulfrik_champion": [
  [
   "minecraft:bone",
   3,
   6,
   1.0,
   "§fЧереп волка",
   ""
  ],
  [
   "minecraft:diamond",
   1,
   1,
   0.18,
   "§bКлык Странника",
   ""
  ]
 ],
 "warcraft:sabertooth_rider": [
  [
   "minecraft:leather",
   2,
   4,
   1.0,
   "§6Шкура саблезуба",
   ""
  ],
  [
   "minecraft:bone",
   1,
   3,
   0.8,
   "§fКлык саблезуба",
   ""
  ]
 ],
 "warcraft:chaos_knight": [
  [
   "minecraft:ender_pearl",
   1,
   2,
   0.5,
   "§5Жемчужина Хаоса",
   ""
  ],
  [
   "minecraft:obsidian",
   1,
   2,
   0.6,
   "§8Чёрный камень",
   ""
  ]
 ],
 "warcraft:void_knight": [
  [
   "minecraft:ender_eye",
   1,
   1,
   0.5,
   "§5Глаз Пустоты",
   ""
  ],
  [
   "minecraft:echo_shard",
   1,
   1,
   0.12,
   "§5Эхо Пустоты",
   ""
  ]
 ],
 "warcraft:hornet_demon": [
  [
   "minecraft:honeycomb",
   1,
   3,
   1.0,
   "§6Сот шершня",
   ""
  ],
  [
   "minecraft:spider_eye",
   1,
   2,
   0.6,
   "§2Жало шершня",
   ""
  ]
 ],
 "warcraft:blood_angel": [
  [
   "minecraft:feather",
   3,
   6,
   1.0,
   "§cКровавое перо",
   ""
  ],
  [
   "minecraft:ghast_tear",
   1,
   1,
   0.25,
   "§cСлеза ангела",
   ""
  ]
 ],
 "warcraft:black_blocker": [
  [
   "minecraft:coal",
   4,
   8,
   1.0,
   "§8Чёрный уголь",
   ""
  ],
  [
   "minecraft:iron_ingot",
   1,
   3,
   0.7,
   "§8Чёрная броня",
   ""
  ]
 ],
 "warcraft:pink_horror": [
  [
   "minecraft:amethyst_shard",
   1,
   2,
   1.0,
   "§dОсколок Тзинча",
   ""
  ],
  [
   "minecraft:glowstone_dust",
   2,
   4,
   0.7,
   "§dМагическая пыль",
   ""
  ]
 ],
 "warcraft:burning_chariot": [
  [
   "minecraft:blaze_rod",
   1,
   2,
   1.0,
   "§6Ось колесницы",
   ""
  ],
  [
   "minecraft:magma_cream",
   1,
   3,
   0.7,
   "§cЖар колёс",
   ""
  ]
 ],
 "warcraft:great_unclean_one": [
  [
   "minecraft:slime_ball",
   3,
   6,
   1.0,
   "§2Слизь Нургла",
   ""
  ],
  [
   "minecraft:fermented_spider_eye",
   1,
   2,
   0.6,
   "§2Чума",
   ""
  ],
  [
   "minecraft:totem_of_undying",
   1,
   1,
   0.1,
   "§2Дар Нургла",
   ""
  ]
 ],
 "warcraft:abomination_lord": [
  [
   "minecraft:rotten_flesh",
   3,
   6,
   1.0,
   "§2Гнилая плоть",
   ""
  ],
  [
   "minecraft:spider_eye",
   1,
   3,
   0.6,
   "§2Желчь",
   ""
  ]
 ],
 "warcraft:faceless_warrior": [
  [
   "minecraft:prismarine_shard",
   1,
   3,
   1.0,
   "§3Осколок безликого",
   ""
  ],
  [
   "minecraft:ender_pearl",
   1,
   1,
   0.1,
   "§5Бессловесная жемчужина",
   ""
  ]
 ],
 "warcraft:faceless_berserker": [
  [
   "minecraft:prismarine_crystals",
   1,
   3,
   1.0,
   "§3Кристалл ярости",
   ""
  ],
  [
   "minecraft:amethyst_shard",
   1,
   2,
   0.5,
   "§5Осколок",
   ""
  ]
 ],
 "warcraft:faceless_general": [
  [
   "minecraft:prismarine_crystals",
   2,
   4,
   1.0,
   "§3Кристалл генерала",
   ""
  ],
  [
   "minecraft:diamond",
   1,
   1,
   0.25,
   "§bСердце безликих",
   ""
  ]
 ],
 "warcraft:faceless_sorcerer": [
  [
   "minecraft:lapis_lazuli",
   2,
   5,
   1.0,
   "§9Лазурь безликих",
   ""
  ],
  [
   "minecraft:amethyst_shard",
   1,
   3,
   0.8,
   "§5Осколок чародея",
   ""
  ]
 ],
 "warcraft:faceless_cultist": [
  [
   "minecraft:ink_sac",
   2,
   4,
   1.0,
   "§8Чёрные чернила культа",
   ""
  ],
  [
   "minecraft:bone_meal",
   2,
   4,
   0.7,
   "§7Прах культиста",
   ""
  ]
 ],
 "warcraft:faceless_nightmare": [
  [
   "minecraft:phantom_membrane",
   1,
   2,
   1.0,
   "§5Плёнка кошмара",
   ""
  ],
  [
   "minecraft:ender_pearl",
   1,
   1,
   0.2,
   "§5Сон безликого",
   ""
  ]
 ],
 "warcraft:nazgul": [
  [
   "minecraft:soul_sand",
   2,
   4,
   1.0,
   "§8Пепел назгула",
   ""
  ],
  [
   "minecraft:netherite_scrap",
   1,
   1,
   0.1,
   "§8Осколок кольца",
   ""
  ]
 ],
 "warcraft:pirate_ghost": [
  [
   "minecraft:gold_nugget",
   3,
   7,
   1.0,
   "§6Золото Мёртвого моря",
   ""
  ],
  [
   "minecraft:nautilus_shell",
   1,
   1,
   0.1,
   "§3Ракушка капитана",
   ""
  ]
 ],
 "warcraft:skeleton_bear": [
  [
   "minecraft:bone",
   3,
   6,
   1.0,
   "§fРебро медведя",
   ""
  ],
  [
   "minecraft:bone_block",
   1,
   1,
   0.2,
   "§fКостяной блок",
   ""
  ]
 ],
 "warcraft:undead_zombie": [
  [
   "minecraft:rotten_flesh",
   2,
   4,
   1.0,
   "§2Чумная плоть",
   ""
  ],
  [
   "minecraft:iron_nugget",
   1,
   2,
   0.4,
   "§7Ржавая монета",
   ""
  ]
 ],
 "warcraft:santa_claus": [
  [
   "minecraft:cake",
   1,
   1,
   0.5,
   "§cПраздничный торт",
   ""
  ],
  [
   "minecraft:emerald",
   2,
   5,
   1.0,
   "§aПодарок деда",
   ""
  ],
  [
   "minecraft:snowball",
   4,
   12,
   1.0,
   "§fСнежок",
   ""
  ]
 ],
 "warcraft:ice_demon": [
  [
   "minecraft:packed_ice",
   1,
   3,
   1.0,
   "§bЛёд демона",
   ""
  ],
  [
   "minecraft:prismarine_crystals",
   1,
   2,
   0.5,
   "§bКристалл мороза",
   ""
  ]
 ],
 "warcraft:grizzly_bear": [
  [
   "minecraft:leather",
   2,
   5,
   1.0,
   "§6Шкура гризли",
   ""
  ],
  [
   "minecraft:porkchop",
   2,
   4,
   0.8,
   "§cМедвежатина",
   ""
  ],
  [
   "minecraft:honey_bottle",
   1,
   1,
   0.2,
   "§6Мёд гризли",
   ""
  ]
 ],
 "warcraft:big_ent": [
  [
   "minecraft:oak_sapling",
   2,
   4,
   1.0,
   "§2Росток энта",
   ""
  ],
  [
   "minecraft:stick",
   4,
   10,
   1.0,
   "§6Ветка энта",
   ""
  ],
  [
   "minecraft:golden_apple",
   1,
   1,
   0.08,
   "§6Плод энта",
   ""
  ]
 ],
 "warcraft:frost_golem": [
  [
   "minecraft:packed_ice",
   2,
   5,
   1.0,
   "§bЛедяное ядро",
   ""
  ],
  [
   "minecraft:diamond",
   1,
   1,
   0.1,
   "§bСердце мороза",
   ""
  ]
 ],
 "warcraft:lightning_golem": [
  [
   "minecraft:lightning_rod",
   1,
   2,
   1.0,
   "§eГромоотвод голема",
   ""
  ],
  [
   "minecraft:copper_ingot",
   2,
   5,
   0.8,
   "§6Заряженная медь",
   ""
  ]
 ],
 "warcraft:inferno_golem": [
  [
   "minecraft:blaze_rod",
   1,
   2,
   1.0,
   "§6Стержень инферно",
   ""
  ],
  [
   "minecraft:magma_cream",
   2,
   4,
   0.8,
   "§cЛава голема",
   ""
  ]
 ],
 "warcraft:ember_colossus": [
  [
   "minecraft:coal_block",
   1,
   2,
   1.0,
   "§8Уголь колосса",
   ""
  ],
  [
   "minecraft:netherite_scrap",
   1,
   1,
   0.1,
   "§6Ядро колосса",
   ""
  ]
 ],
 "cb:inferno_golem": [
  [
   "minecraft:emerald",
   1,
   3,
   1.0,
   "§aЯдро Скверны",
   ""
  ],
  [
   "minecraft:slime_ball",
   2,
   4,
   0.6,
   "§aЗелёная смола",
   ""
  ]
 ],
 "cb:hephaestus_golem": [
  [
   "minecraft:copper_ingot",
   2,
   4,
   1.0,
   "§6Бронза Гефеста",
   ""
  ],
  [
   "minecraft:iron_ingot",
   1,
   3,
   0.8,
   "§7Кованое железо",
   ""
  ]
 ],
 "cb:goblin": [
  [
   "minecraft:gold_nugget",
   1,
   4,
   1.0,
   "§6Гоблинская монета",
   ""
  ],
  [
   "minecraft:emerald",
   1,
   1,
   0.1,
   "§aКраденый изумруд",
   ""
  ]
 ],
 "cb:orc": [
  [
   "minecraft:iron_nugget",
   2,
   5,
   0.7,
   "§7Орочья заклёпка",
   ""
  ]
 ],
 "cb:green_orc": [
  [
   "minecraft:rotten_flesh",
   1,
   3,
   0.8,
   "§aЗелёная плоть",
   ""
  ]
 ],
 "cb:hell_orc": [
  [
   "minecraft:blaze_powder",
   1,
   2,
   0.7,
   "§cАдский порошок",
   ""
  ]
 ],
 "cb:fel_minion": [
  [
   "minecraft:slime_ball",
   1,
   2,
   0.8,
   "§aСлизь Скверны",
   ""
  ]
 ],
 "cb:smart_troll": [
  [
   "minecraft:bone",
   1,
   3,
   0.8,
   "§fТролльская кость",
   ""
  ]
 ],
 "cb:tribal_troll": [
  [
   "minecraft:lapis_lazuli",
   1,
   3,
   0.8,
   "§9Синий камень племени",
   ""
  ]
 ],
 "cb:wild_troll": [
  [
   "minecraft:bone",
   1,
   3,
   0.8,
   "§fДикая кость",
   ""
  ],
  [
   "minecraft:leather",
   1,
   2,
   0.5,
   "§6Шкура тролля",
   ""
  ]
 ],
 "cb:cannibal_troll": [
  [
   "minecraft:rotten_flesh",
   2,
   5,
   1.0,
   "§cМясо каннибала",
   ""
  ],
  [
   "minecraft:bone",
   2,
   4,
   0.8,
   "§fКость жертвы",
   ""
  ]
 ],
 "cb:ice_troll": [
  [
   "minecraft:packed_ice",
   1,
   3,
   0.9,
   "§bЛёд тролля",
   ""
  ]
 ],
 "cb:warg": [
  [
   "minecraft:bone",
   1,
   2,
   0.7,
   "§7Клык варга",
   ""
  ],
  [
   "minecraft:leather",
   1,
   2,
   0.6,
   "§8Шкура варга",
   ""
  ]
 ],
 "cb:thunder_lizard": [
  [
   "minecraft:lightning_rod",
   1,
   1,
   0.5,
   "§eЗуб ящера",
   ""
  ],
  [
   "minecraft:leather",
   2,
   3,
   0.8,
   "§6Чешуя ящера",
   ""
  ]
 ],
 "cb:mermaid": [
  [
   "minecraft:prismarine_shard",
   1,
   2,
   0.7,
   "§3Чешуя русалки",
   ""
  ],
  [
   "minecraft:pufferfish",
   1,
   1,
   0.2,
   "§3Дар глубин",
   ""
  ]
 ],
 "cb:siren": [
  [
   "minecraft:nautilus_shell",
   1,
   1,
   0.25,
   "§3Ракушка сирены",
   ""
  ],
  [
   "minecraft:prismarine_crystals",
   1,
   2,
   0.8,
   "§3Слеза сирены",
   ""
  ]
 ],
 "cb:poseidon_triton": [
  [
   "minecraft:prismarine_shard",
   1,
   3,
   1.0,
   "§3Осколок тритона",
   ""
  ]
 ],
 "cb:zeus_archon": [
  [
   "minecraft:gold_ingot",
   1,
   2,
   1.0,
   "§eЗолото Олимпа",
   ""
  ],
  [
   "minecraft:lightning_rod",
   1,
   1,
   0.3,
   "§eИскра архонта",
   ""
  ]
 ],
 "cb:ares_berserker": [
  [
   "minecraft:iron_ingot",
   1,
   3,
   1.0,
   "§cЖелезо Ареса",
   ""
  ],
  [
   "minecraft:red_dye",
   1,
   3,
   0.7,
   "§cКровь войны",
   ""
  ]
 ],
 "cb:athena_hoplite": [
  [
   "minecraft:copper_ingot",
   1,
   3,
   1.0,
   "§6Бронза Афины",
   ""
  ],
  [
   "minecraft:emerald",
   1,
   1,
   0.15,
   "§aДар мудрости",
   ""
  ]
 ],
 "cb:hades_shade": [
  [
   "minecraft:soul_sand",
   1,
   3,
   1.0,
   "§8Пепел души",
   ""
  ],
  [
   "minecraft:bone",
   1,
   3,
   0.7,
   "§7Кость тени",
   ""
  ]
 ],
 "cb:death_knight": [
  [
   "minecraft:iron_ingot",
   1,
   3,
   1.0,
   "§bРуническая сталь",
   ""
  ],
  [
   "minecraft:diamond",
   1,
   1,
   0.15,
   "§bРуна смерти",
   ""
  ]
 ],
 "cb:ice_spirit": [
  [
   "minecraft:packed_ice",
   2,
   4,
   1.0,
   "§bЛёд духа",
   ""
  ],
  [
   "minecraft:prismarine_crystals",
   1,
   2,
   0.6,
   "§bСлеза зимы",
   ""
  ]
 ],
 "cb:human_villager": [
  [
   "minecraft:bread",
   1,
   2,
   0.5,
   "§6Хлеб жителя",
   ""
  ]
 ],
 "cb:human_civilian": [
  [
   "minecraft:wheat",
   1,
   3,
   0.5,
   "§eЗерно горожанина",
   ""
  ]
 ],
 "cb:dragon_east": [
  [
   "minecraft:dragon_breath",
   1,
   1,
   0.2,
   "§dДыхание дракона",
   ""
  ],
  [
   "minecraft:leather",
   2,
   4,
   0.8,
   "§6Чешуя дракона",
   ""
  ]
 ],
 "cb:dragon_west": [
  [
   "minecraft:dragon_breath",
   1,
   1,
   0.2,
   "§dДыхание дракона",
   ""
  ],
  [
   "minecraft:leather",
   2,
   4,
   0.8,
   "§6Чешуя дракона",
   ""
  ]
 ],
 "cb:coal_beetle": [
  [
   "minecraft:coal",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:copper_beetle": [
  [
   "minecraft:copper_ingot",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:iron_beetle": [
  [
   "minecraft:iron_ingot",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:gold_beetle": [
  [
   "minecraft:gold_ingot",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:diamond_beetle": [
  [
   "minecraft:diamond",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:emerald_beetle": [
  [
   "minecraft:emerald",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:lapis_beetle": [
  [
   "minecraft:lapis_lazuli",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:quartz_beetle": [
  [
   "minecraft:quartz",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:redstone_beetle": [
  [
   "minecraft:redstone",
   1,
   1,
   0.35,
   "§7Жила жука",
   ""
  ]
 ],
 "cb:zeus": [
  [
   "minecraft:lightning_rod",
   2,
   4,
   1.0,
   "§eМолния Зевса",
   ""
  ],
  [
   "minecraft:totem_of_undying",
   1,
   1,
   0.4,
   "§6Благословение Громовержца",
   ""
  ]
 ],
 "cb:poseidon": [
  [
   "minecraft:nautilus_shell",
   1,
   2,
   1.0,
   "§3Раковина Посейдона",
   ""
  ],
  [
   "minecraft:trident",
   1,
   1,
   0.25,
   "§3Трезубец морей",
   ""
  ]
 ],
 "cb:hades": [
  [
   "minecraft:soul_sand",
   4,
   8,
   1.0,
   "§8Пепел Аида",
   ""
  ],
  [
   "minecraft:netherite_scrap",
   1,
   2,
   0.35,
   "§8Слиток подземного мира",
   ""
  ]
 ],
 "cb:ares": [
  [
   "minecraft:iron_ingot",
   3,
   6,
   1.0,
   "§cЖелезо Ареса",
   ""
  ],
  [
   "minecraft:netherite_scrap",
   1,
   1,
   0.3,
   "§cОсколок щита Ареса",
   ""
  ]
 ],
 "cb:athena": [
  [
   "minecraft:book",
   1,
   2,
   1.0,
   "§fСвиток Афины",
   ""
  ],
  [
   "minecraft:totem_of_undying",
   1,
   1,
   0.35,
   "§bМудрость Афины",
   ""
  ]
 ],
 "cb:hephaestus": [
  [
   "minecraft:netherite_scrap",
   1,
   2,
   0.6,
   "§6Слиток Гефеста",
   ""
  ],
  [
   "minecraft:anvil",
   1,
   1,
   0.3,
   "§6Наковальня богов",
   ""
  ]
 ],
 "cb:minotaur": [
  [
   "minecraft:iron_axe",
   1,
   1,
   0.3,
   "§6Секира Минотавра",
   ""
  ],
  [
   "minecraft:leather",
   3,
   6,
   1.0,
   "§6Шкура Минотавра",
   ""
  ]
 ],
 "cb:fel_lord": [
  [
   "minecraft:emerald",
   3,
   6,
   1.0,
   "§aСердце Скверны",
   ""
  ],
  [
   "minecraft:nether_star",
   1,
   1,
   0.12,
   "§aЗвезда Скверны",
   ""
  ]
 ],
 "cb:lich_king": [
  [
   "minecraft:packed_ice",
   4,
   8,
   1.0,
   "§bОсколок Трона",
   ""
  ],
  [
   "minecraft:nether_star",
   1,
   1,
   0.15,
   "§bЗвезда Короля-лича",
   ""
  ]
 ],
 "cb:dreadlord": [
  [
   "minecraft:phantom_membrane",
   2,
   4,
   1.0,
   "§5Крыло ужаса",
   ""
  ],
  [
   "minecraft:echo_shard",
   1,
   1,
   0.25,
   "§5Эхо кошмара",
   ""
  ]
 ],
 "cb:cyclops": [
  [
   "minecraft:iron_ingot",
   4,
   8,
   1.0,
   "§6Обломок Циклопа",
   ""
  ],
  [
   "minecraft:diamond",
   1,
   2,
   0.4,
   "§bГлаз Циклопа",
   ""
  ]
 ],
 "cb:hydra": [
  [
   "minecraft:slime_ball",
   4,
   8,
   1.0,
   "§2Яд Гидры",
   ""
  ],
  [
   "minecraft:totem_of_undying",
   1,
   1,
   0.3,
   "§2Бессмертная голова",
   ""
  ]
 ],
 "cb:circe": [
  [
   "minecraft:amethyst_shard",
   2,
   5,
   1.0,
   "§dКристалл Цирцеи",
   ""
  ],
  [
   "minecraft:ender_pearl",
   1,
   2,
   0.5,
   "§dЖемчужина чар",
   ""
  ]
 ],
 "cb:guldan": [
  [
   "minecraft:emerald",
   2,
   5,
   1.0,
   "§aЖертва Скверны",
   ""
  ],
  [
   "minecraft:nether_star",
   1,
   1,
   0.1,
   "§aГлаз Гул'дана",
   ""
  ]
 ],
 "cb:laestrygonian": [
  [
   "minecraft:iron_ingot",
   2,
   4,
   1.0,
   "§6Обломок дубины",
   ""
  ],
  [
   "minecraft:leather",
   2,
   4,
   0.8,
   "§6Шкура великана",
   ""
  ]
 ]
};
export const NAMES = {
 "warcraft:royal_captain": "Королевский капитан",
 "warcraft:royal_knight": "Королевский рыцарь",
 "warcraft:dark_plate_knight": "Рыцарь тёмных лат",
 "warcraft:elector_knight": "Рыцарь-выборщик",
 "warcraft:garithos_paladin": "Паладин Гаритос",
 "warcraft:heide_knight": "Рыцарь вереска",
 "warcraft:heide_hood_knight": "Рыцарь в капюшоне",
 "warcraft:high_elf_spearman": "Высокий эльф-копейщик",
 "warcraft:imperial_guard": "Имперский страж",
 "warcraft:paladin_swordsman": "Паладин-мечник",
 "warcraft:royal_queen": "Королева",
 "warcraft:teutonic_cleric": "Тевтонский клирик",
 "warcraft:chival_warrior": "Рыцарь-воин",
 "warcraft:bandit_raider": "Бандит-налётчик",
 "warcraft:bandit_dog": "Бандитская гончая",
 "warcraft:chaos_warrior": "Воин Хаоса",
 "warcraft:norse_berserker": "Берсерк норски",
 "warcraft:norse_marauder": "Норманнский разоритель",
 "warcraft:norse_shaman": "Шаман норски",
 "warcraft:skaal_villager": "Житель Скаала",
 "warcraft:wulfrik_champion": "Вулфрик-чемпион",
 "warcraft:sabertooth_rider": "Всадник на саблезубе",
 "warcraft:chaos_knight": "Рыцарь Хаоса",
 "warcraft:void_knight": "Рыцарь Пустоты",
 "warcraft:hornet_demon": "Демон-шершень",
 "warcraft:blood_angel": "Кровавый ангел",
 "warcraft:black_blocker": "Чёрный блокировщик",
 "warcraft:pink_horror": "Розовый ужас",
 "warcraft:burning_chariot": "Пылающая колесница",
 "warcraft:great_unclean_one": "Великий осквернитель",
 "warcraft:abomination_lord": "Лорд-мерзость",
 "warcraft:faceless_warrior": "Безликий воин",
 "warcraft:faceless_berserker": "Безликий берсерк",
 "warcraft:faceless_general": "Безликий генерал",
 "warcraft:faceless_sorcerer": "Безликий чародей",
 "warcraft:faceless_cultist": "Безликий культист",
 "warcraft:faceless_nightmare": "Безликий кошмар",
 "warcraft:nazgul": "Назгул",
 "warcraft:pirate_ghost": "Призрак пирата",
 "warcraft:skeleton_bear": "Медведь-скелет",
 "warcraft:undead_zombie": "Мертвец",
 "warcraft:santa_claus": "Зимний дед",
 "warcraft:ice_demon": "Ледяной демон",
 "warcraft:grizzly_bear": "Гризли",
 "warcraft:big_ent": "Большой энт",
 "warcraft:frost_golem": "Ледяной голем",
 "warcraft:lightning_golem": "Голем-молния",
 "warcraft:inferno_golem": "Инферно-голем",
 "warcraft:ember_colossus": "Колосс углей",
 "cb:inferno_golem": "Голем Скверны",
 "cb:hephaestus_golem": "Голем Гефеста",
 "cb:goblin": "Гоблин",
 "cb:orc": "Орк",
 "cb:green_orc": "Зелёный орк",
 "cb:hell_orc": "Адский орк",
 "cb:fel_minion": "Миньон Скверны",
 "cb:smart_troll": "Умный тролль",
 "cb:tribal_troll": "Тролль-шаман",
 "cb:wild_troll": "Дикий тролль",
 "cb:cannibal_troll": "Тролль-каннибал",
 "cb:ice_troll": "Ледяной тролль",
 "cb:troll_totem": "Тотем тролля",
 "cb:warg": "Варг",
 "cb:thunder_lizard": "Громовой ящер",
 "cb:mermaid": "Русалка",
 "cb:siren": "Сирена",
 "cb:poseidon_triton": "Тритон Посейдона",
 "cb:zeus_archon": "Архонт Зевса",
 "cb:ares_berserker": "Берсерк Ареса",
 "cb:athena_hoplite": "Гоплит Афины",
 "cb:hades_shade": "Тень Аида",
 "cb:death_knight": "Рыцарь смерти",
 "cb:ice_spirit": "Ледяной дух",
 "cb:human_villager": "Житель",
 "cb:human_civilian": "Горожанин",
 "cb:dragon_east": "Восточный дракон",
 "cb:dragon_west": "Западный дракон",
 "cb:ore_beetle": "Рудный жук",
 "cb:coal_beetle": "Угольный жук",
 "cb:copper_beetle": "Медный жук",
 "cb:iron_beetle": "Железный жук",
 "cb:gold_beetle": "Золотой жук",
 "cb:diamond_beetle": "Алмазный жук",
 "cb:emerald_beetle": "Изумрудный жук",
 "cb:lapis_beetle": "Лазуритовый жук",
 "cb:quartz_beetle": "Кварцевый жук",
 "cb:redstone_beetle": "Редстоуновый жук",
 "cb:zeus": "Зевс",
 "cb:poseidon": "Посейдон",
 "cb:hades": "Аид",
 "cb:ares": "Арес",
 "cb:athena": "Афина",
 "cb:hephaestus": "Гефест",
 "cb:minotaur": "Минотавр",
 "cb:fel_lord": "Повелитель Скверны",
 "cb:lich_king": "Король-лич",
 "cb:dreadlord": "Повелитель ужаса",
 "cb:cyclops": "Циклоп",
 "cb:hydra": "Гидра",
 "cb:circe": "Цирцея",
 "cb:guldan": "Гул'дан",
 "cb:laestrygonian": "Лестригон",
 "cb:circe_orb": "Магический шар Цирцеи",
 "cb:dragon_fire": "Огненное дыхание",
 "cb:dragon_frost": "Ледяное дыхание",
 "cb:dragon_spark": "Грозовое дыхание",
 "cb:fel_orb": "Шар Скверны",
 "cb:fel_rain": "Дождь Скверны",
 "cb:hex_chicken": "Курица-превращение",
 "cb:hex_goat": "Коза-превращение",
 "cb:hex_horse": "Лошадь-превращение",
 "cb:hex_pig": "Свинья-превращение",
 "cb:hex_sheep": "Овца-превращение",
 "cb:hydra_head": "Голова гидры",
 "cb:hydra_neck": "Шея гидры",
 "cb:hydra_spit": "Яд гидры",
 "cb:lich_statue": "Ледяная статуя",
 "cb:sargeras_prompt": "Алтарь Саргераса"
};
export const NOTES = {
 "warcraft:great_unclean_one": "Есть собственные механики (ярость, призыв, исцеление от убийств)",
 "warcraft:frost_golem": "Есть собственные механики",
 "warcraft:lightning_golem": "Есть собственные механики",
 "warcraft:inferno_golem": "Есть собственные механики",
 "cb:inferno_golem": "Призывается Гул'даном; есть механики в guldan.js",
 "cb:goblin": "Есть дроп и логика в goblin.json",
 "cb:orc": "Есть механики в orcs.js/mob_ai.js",
 "cb:green_orc": "Есть механики в orcs.js",
 "cb:hell_orc": "Есть механики в orcs.js",
 "cb:thunder_lizard": "Верховой зверь; есть механики в thunder_lizard.js",
 "cb:mermaid": "Есть механики в merfolk.js",
 "cb:siren": "Есть механики в merfolk.js",
 "cb:human_villager": "Есть логика поселений в settlements.js",
 "cb:human_civilian": "Есть логика поселений в settlements.js",
 "cb:dragon_east": "Есть механики в dragons.js",
 "cb:dragon_west": "Есть механики в dragons.js",
 "cb:ore_beetle": "Есть механики в beetles.js (руда по виду жука)",
 "cb:coal_beetle": "Есть механики в beetles.js",
 "cb:copper_beetle": "Есть механики в beetles.js",
 "cb:iron_beetle": "Есть механики в beetles.js",
 "cb:gold_beetle": "Есть механики в beetles.js",
 "cb:diamond_beetle": "Есть механики в beetles.js",
 "cb:emerald_beetle": "Есть механики в beetles.js",
 "cb:lapis_beetle": "Есть механики в beetles.js",
 "cb:quartz_beetle": "Есть механики в beetles.js",
 "cb:redstone_beetle": "Есть механики в beetles.js",
 "cb:zeus": "Уникальные механики в скриптах: Гнев Зевса, грозовой шторм, божественный щит",
 "cb:poseidon": "Уникальные механики в скриптах: Цунами, водоворот, призыв тритонов",
 "cb:hades": "Уникальные механики в скриптах: Цепи подземного мира, призыв душ, пламя Аида",
 "cb:ares": "Уникальные механики в скриптах: Боевая ярость, кровавый рывок, воинственный клич",
 "cb:athena": "Уникальные механики в скриптах: Божественный щит, копьё мудрости, призыв гоплитов",
 "cb:hephaestus": "Уникальные механики в скриптах: Огненная кузница, стражи-големы, божественное ремесло",
 "cb:minotaur": "Уникальные механики в скриптах: Таран, топот лабиринта, ярость быка",
 "cb:fel_lord": "Уникальные механики в скриптах: Призыв легиона, зелёное пламя, проклятие Скверны",
 "cb:lich_king": "Уникальные механики в скриптах: Поднятие мёртвых, ледяная гробница, ледяные шипы",
 "cb:dreadlord": "Уникальные механики в скриптах: Гипноз, летучие мыши, туман",
 "cb:cyclops": "Уникальные механики в скриптах: Удары рук и ног, захват, глотание, слепота",
 "cb:hydra": "Уникальные механики в скриптах: Пять голов, отрастание голов, ядовитые плевки",
 "cb:circe": "Уникальные механики в скриптах: Превращение в животных, магические шары, зелья",
 "cb:guldan": "Уникальные механики в скриптах: Шары Скверны, поглощение жизни, голем Скверны",
 "cb:laestrygonian": "Уникальные механики в скриптах: Удары дубиной, рёв, топот",
 "cb:circe_orb": "Снаряд Цирцеи: магический урон и превращающая метка (circe.js)",
 "cb:dragon_fire": "Снаряд дракона: поджигает цель и землю (dragons.js)",
 "cb:dragon_frost": "Снаряд дракона: замораживает и замедляет (dragons.js)",
 "cb:dragon_spark": "Снаряд дракона: цепная молния (dragons.js)",
 "cb:fel_orb": "Снаряд Гул'дана: урон магией и иссушение (guldan.js)",
 "cb:fel_rain": "Падающий снаряд Гул'дана: поражает область (guldan.js)",
 "cb:hex_chicken": "Форма Цирцеи: жертва превращается в курицу",
 "cb:hex_goat": "Форма Цирцеи: жертва превращается в козу",
 "cb:hex_horse": "Форма Цирцеи: жертва превращается в лошадь",
 "cb:hex_pig": "Форма Цирцеи: жертва превращается в свинью",
 "cb:hex_sheep": "Форма Цирцеи: жертва превращается в овцу",
 "cb:hydra_head": "Отдельная живая голова: кусает, отрастает заново (hydra.js)",
 "cb:hydra_neck": "Часть тела гидры: держит голову и принимает урон (hydra.js)",
 "cb:hydra_spit": "Снаряд гидры: ядовитая лужа (hydra.js)",
 "cb:lich_statue": "Вторая стадия Короля-лича: 8 секунд, затем Ледяной дух (mythic_bosses.js)",
 "cb:sargeras_prompt": "Меню призыва голема Скверны (guldan.js)"
};
export const FACTION_TITLES = {
 "order": "Орден Королевства",
 "norsca": "Норска",
 "chaos": "Легион Хаоса",
 "nurgle": "Нургл",
 "faceless": "Безликие",
 "scourge": "Плеть",
 "golems": "Стихийные големы",
 "nature": "Дикая природа",
 "fel": "Орда Скверны",
 "tribes": "Племена орков и троллей",
 "wild_trolls": "Дикие тролли",
 "olympus": "Олимп",
 "giants": "Великаны",
 "sea": "Морской народ",
 "dragons": "Драконы",
 "hydra": "Гидра",
 "witches": "Ведьмы",
 "beetles": "Рудные жуки",
 "humans": "Люди",
 "goblins": "Гоблины",
 "labyrinth": "Лабиринт",
 "santa": "Зимний дед",
 "beasts": "Ездовые звери"
};
export const ITEM_INFO = {
 "cb:hell_scimitar": {
  "ru": "Адский ятаган",
  "d": "Поджигает цель на 4 сек; 15% — вспышка Скверны (урон по площади)"
 },
 "cb:laestrygonian_sword": {
  "ru": "Меч лестригона",
  "d": "Размашистый удар: урон и отбрасывание всем врагам рядом с целью"
 },
 "cb:dragon_scale": {
  "ru": "Чешуя дракона",
  "d": "ПКМ: Огнеупорность на 40 сек (перезарядка 45 сек, не расходуется)"
 },
 "cb:bronze_ingot": {
  "ru": "Бронзовый слиток",
  "d": "Материал для ковки; ПКМ: Поглощение на 20 сек (перезарядка 60 сек, не расходуется)"
 },
 "cb:bestiary": {
  "ru": "Бестиарий уникальностей",
  "d": "ПКМ: список фракций, способностей и трофеев всех существ"
 }
};
