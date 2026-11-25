"""Unique abilities + trophies for every creature. Compiled to scripts/abilities_data.js by patch_bp.py.
fx entries are [effect, seconds, amplifier]. Every mob gets a different combination, a signature name and its own trophy."""

def fx(*a): return [list(x) for x in a]

def aura(name, d, to, r, effects, every=60, p=None):
    return dict(k="aura", name=name, d=d, to=to, r=r, fx=effects, every=every, p=p)

def hit(name, d, ch=0.3, effects=None, fire=0, kb=None, steal=0, chain=None, cleave=None, vs=None, self_fx=None, p=None):
    return dict(k="hit", name=name, d=d, ch=ch, fx=effects or [], fire=fire, kb=kb, steal=steal, chain=chain, cleave=cleave, vs=vs, self_fx=self_fx or [], p=p)

def hurt(name, d, thorns=0, below=None, self_fx=None, kb=None, effects=None, cd=300, heal=0):
    return dict(k="hurt", name=name, d=d, thorns=thorns, below=below, self_fx=self_fx or [], kb=kb, fx=effects or [], cd=cd, heal=heal)

def cast(do, name, d, cd=200, rng=12, **kw):
    return dict(k="cast", do=do, name=name, d=d, cd=cd, rng=rng, **kw)

def death(name, d, burst=None, spawn=None, fx_=None, p=None):
    return dict(k="death", name=name, d=d, burst=burst, spawn=spawn, fx=fx_ or [], p=p)

def D(item, lo, hi, ch, name, lore=""):
    return [item, lo, hi, ch, name, lore]

E = {}
def mob(ident, ru, abilities=(), drops=(), note=None):
    E[ident] = dict(ru=ru, ab=list(abilities), drops=[list(x) for x in drops], note=note)

W = lambda n: "warcraft:" + n
C = lambda n: "cb:" + n

# ======================================================================= ORDER
mob(W("royal_captain"), "Королевский капитан", [
    aura("Боевое знамя", "Союзники рядом получают Силу I и Скорость I", "allies", 10, fx(("strength", 6, 0), ("speed", 6, 0)), 80, "minecraft:totem_particle"),
    hurt("Контрудар", "Отбрасывает обидчика назад", kb=[1.3, 0.35], cd=120)],
    [D("minecraft:gold_nugget", 3, 6, 1.0, "§6Печать капитана", "Королевская гвардия"), D("minecraft:emerald", 1, 1, 0.25, "§aЖалование стражи")])
mob(W("royal_knight"), "Королевский рыцарь", [
    cast("charge", "Кавалерийская атака", "Рывок на врага с ударом по площади", 140, 14, dmg=9, r=3),
    hit("Копейный удар", "Сильно отбрасывает цель", 0.35, kb=[1.6, 0.4])],
    [D("minecraft:iron_ingot", 2, 4, 1.0, "§fКоролевская сталь"), D("minecraft:lead", 1, 1, 0.3, "§fУздечка боевого коня")])
mob(W("dark_plate_knight"), "Рыцарь тёмных лат", [
    hit("Чёрная сталь", "Удар иссушает цель", 0.35, effects=fx(("wither", 4, 0))),
    hurt("Шипастые латы", "Возвращает часть урона и получает Сопротивление при HP<40%", thorns=3, below=0.4, self_fx=fx(("resistance", 8, 1)), cd=400)],
    [D("minecraft:netherite_scrap", 1, 1, 0.08, "§8Осколок чёрных лат"), D("minecraft:coal", 3, 6, 1.0, "§8Закопчённая сталь")])
mob(W("elector_knight"), "Рыцарь-выборщик", [
    cast("rally", "Имперский приказ", "Союзники получают Сопротивление I и Скорость I", 300, 16, r=12, fx=fx(("resistance", 10, 0), ("speed", 10, 0))),
    hit("Печать выборщика", "Замедляет цель", 0.25, effects=fx(("slowness", 3, 1)))],
    [D("minecraft:paper", 1, 2, 1.0, "§eГрамота выборщика", "Голос на императорском совете"), D("minecraft:gold_nugget", 2, 5, 0.8, "§6Имперский талер")])
mob(W("garithos_paladin"), "Паладин Гаритос", [
    cast("heal", "Свет паладина", "Лечит союзников вокруг", 200, 16, r=8, amt=6),
    hit("Священный молот", "Против нежити: +6 урона и огонь", 0.6, vs={"undead": {"dmg": 6, "fire": 4}})],
    [D("minecraft:glowstone_dust", 2, 5, 1.0, "§eСвятая пыль"), D("minecraft:totem_of_undying", 1, 1, 0.06, "§6Тотем Гаритоса")])
mob(W("heide_knight"), "Рыцарь вереска", [
    aura("Вересковая стойка", "Медленно регенерирует", "self", 0, fx(("regeneration", 4, 0)), 120),
    hurt("Стойка щита", "При HP<50% получает Сопротивление II", below=0.5, self_fx=fx(("resistance", 8, 1)), cd=500)],
    [D("minecraft:iron_nugget", 4, 8, 1.0, "§7Кольчужная заклёпка"), D("minecraft:sweet_berries", 2, 4, 0.7, "§2Вересковые ягоды")])
mob(W("heide_hood_knight"), "Рыцарь в капюшоне", [
    cast("mist", "Туман вереска", "Слепит врагов рядом, сам становится невидимым", 400, 10, r=6, fx=fx(("blindness", 4, 0)), self_fx=fx(("invisibility", 4, 0))),
    hit("Удар из тумана", "Сильнее бьёт, если цель ослеплена", 0.3, effects=fx(("weakness", 3, 0)))],
    [D("minecraft:leather", 2, 4, 1.0, "§2Плащ из вереска"), D("minecraft:fermented_spider_eye", 1, 1, 0.3, "§2Вересковый настой")])
mob(W("high_elf_spearman"), "Высокий эльф-копейщик", [
    cast("bolt", "Бросок лунного копья", "Метает копьё на расстоянии", 100, 16, dmg=6, p="minecraft:crit_particle"),
    hit("Лунный шаг", "После удара получает Скорость II", 0.25, self_fx=fx(("speed", 4, 1)))],
    [D("minecraft:amethyst_shard", 1, 3, 1.0, "§bЛунный осколок"), D("minecraft:feather", 2, 4, 0.8, "§fЭльфийское перо")])
mob(W("imperial_guard"), "Имперский страж", [
    cast("slam", "Удар алебарды", "Круговой удар с отбрасыванием", 120, 4, r=3.5, dmg=5, kb=[1.2, 0.35]),
    hurt("Строй стражи", "Зовёт союзников: Сила I", cd=500, self_fx=fx(("strength", 6, 0)), below=0.7)],
    [D("minecraft:iron_ingot", 1, 3, 1.0, "§cИмперский значок"), D("minecraft:red_dye", 1, 3, 0.6, "§cКраска мундира")])
mob(W("paladin_swordsman"), "Паладин-мечник", [
    hit("Клинок света", "Поджигает и крадёт часть урона в здоровье", 0.3, fire=3, steal=0.15),
    cast("heal", "Молитва", "Лечит себя при HP<50%", 400, 12, r=0, amt=8, only_self=True)],
    [D("minecraft:glowstone_dust", 1, 3, 1.0, "§eСвет клинка"), D("minecraft:golden_apple", 1, 1, 0.1, "§6Освящённое яблоко")])
mob(W("royal_queen"), "Королева", [
    cast("summon", "Королевская гвардия", "Призывает до трёх капитанов", 600, 14, id=W("royal_captain"), n=1, cap=3),
    aura("Благословение королевы", "Союзники регенерируют", "allies", 10, fx(("regeneration", 4, 0)), 100, "minecraft:heart_particle")],
    [D("minecraft:diamond", 1, 1, 0.3, "§bСлеза королевы"), D("minecraft:gold_ingot", 2, 4, 1.0, "§6Корона регентши")])
mob(W("teutonic_cleric"), "Тевтонский клирик", [
    cast("heal", "Исцеляющая молитва", "Сильное лечение союзников", 140, 14, r=10, amt=8),
    aura("Кара нечестивым", "Нежить рядом слабеет", "foes", 8, fx(("weakness", 4, 0)), 80)],
    [D("minecraft:book", 1, 1, 0.6, "§fМолитвенник", "Тевтонский орден"), D("minecraft:glowstone_dust", 1, 3, 0.8, "§eСвятой порошок")])
mob(W("chival_warrior"), "Рыцарь-воин", [
    hit("Рыцарский удар", "Мощно отбрасывает цель", 0.3, kb=[1.9, 0.5]),
    cast("leap", "Рывок рыцаря", "Прыжок на врага", 120, 10, h=0.9, v=0.5)],
    [D("minecraft:copper_ingot", 2, 4, 1.0, "§6Бронзовая бляха"), D("minecraft:iron_nugget", 3, 6, 0.8, "§7Гвоздь лат")])

# ======================================================================= NORSCA
mob(W("bandit_raider"), "Бандит-налётчик", [
    hit("Грабёж", "Вызывает голод и замедляет цель", 0.3, effects=fx(("hunger", 6, 1), ("slowness", 2, 0))),
    hurt("Кража удачи", "При HP<40% быстро убегает", below=0.4, self_fx=fx(("speed", 5, 1)), cd=500)],
    [D("minecraft:gold_nugget", 4, 9, 1.0, "§6Награбленное"), D("minecraft:emerald", 1, 2, 0.35, "§aУкраденный изумруд")])
mob(W("bandit_dog"), "Бандитская гончая", [
    cast("leap", "Прыжок гончей", "Кидается на врага", 80, 9, h=0.95, v=0.45),
    hit("Заражённый укус", "Яд на 4 сек", 0.3, effects=fx(("poison", 4, 0)))],
    [D("minecraft:bone", 1, 3, 1.0, "§7Клык гончей"), D("minecraft:rotten_flesh", 1, 2, 0.6, "§7Падаль")])
mob(W("chaos_warrior"), "Воин Хаоса", [
    hit("Метка Хаоса", "Иссушение на 3 сек", 0.3, effects=fx(("wither", 3, 0))),
    hurt("Дар Хаоса", "При HP<50% получает Силу II", below=0.5, self_fx=fx(("strength", 10, 1)), cd=600)],
    [D("minecraft:blaze_powder", 1, 3, 1.0, "§cОгонь Хаоса"), D("minecraft:ender_pearl", 1, 1, 0.2, "§5Жемчужина Хаоса")])
mob(W("norse_berserker"), "Берсерк норски", [
    hurt("Ярость берсерка", "При HP<50% впадает в ярость: Сила II, Скорость I", below=0.5, self_fx=fx(("strength", 10, 1), ("speed", 10, 0)), cd=700),
    hit("Двойной замах", "Бьёт по площади вокруг цели", 0.5, cleave=dict(r=2.5, dmg=3))],
    [D("minecraft:red_dye", 1, 2, 1.0, "§cБоевая краска"), D("minecraft:iron_axe", 1, 1, 0.08, "§7Топор берсерка")])
mob(W("norse_marauder"), "Норманнский разоритель", [
    hit("Абордажный крюк", "Замедляет цель", 0.3, effects=fx(("slowness", 3, 1))),
    cast("leap", "Прыжок с борта", "Прыжок на врага", 150, 9, h=0.9, v=0.5)],
    [D("minecraft:string", 2, 5, 1.0, "§fКанат драккара"), D("minecraft:iron_nugget", 3, 6, 0.8, "§7Серебро набега")])
mob(W("norse_shaman"), "Шаман норски", [
    cast("bolt", "Руна льда", "Ледяной снаряд с замедлением", 90, 14, dmg=5, fx=fx(("slowness", 3, 1)), p="minecraft:snowflake_particle"),
    cast("heal", "Дух предков", "Лечит союзников", 300, 12, r=8, amt=6)],
    [D("minecraft:bone", 2, 4, 1.0, "§fРунная кость"), D("minecraft:lapis_lazuli", 2, 5, 0.7, "§9Руническая синь")])
mob(W("skaal_villager"), "Житель Скаала", [
    hurt("Клич деревни", "Зовёт соседей: Сила I", below=0.9, self_fx=fx(("strength", 6, 0)), cd=400),
    aura("Родная земля", "Лёгкая регенерация", "self", 0, fx(("regeneration", 3, 0)), 160)],
    [D("minecraft:wheat", 2, 4, 1.0, "§eСкаальская пшеница"), D("minecraft:bread", 1, 2, 0.5, "§6Хлеб Скаала")])
mob(W("wulfrik_champion"), "Вулфрик-чемпион", [
    cast("fear", "Вой Странника", "Враги слабеют и замедляются", 300, 10, r=8, fx=fx(("weakness", 5, 0), ("slowness", 4, 1))),
    hit("Кровь волка", "Крадёт часть урона в здоровье", 0.4, steal=0.2)],
    [D("minecraft:bone", 3, 6, 1.0, "§fЧереп волка"), D("minecraft:diamond", 1, 1, 0.18, "§bКлык Странника")])
mob(W("sabertooth_rider"), "Всадник на саблезубе", [
    cast("charge", "Прыжок саблезуба", "Рывок и удар по площади", 120, 14, dmg=7, r=3),
    hit("Кровавая рана", "Яд (кровотечение) на 5 сек", 0.3, effects=fx(("poison", 5, 0)))],
    [D("minecraft:leather", 2, 4, 1.0, "§6Шкура саблезуба"), D("minecraft:bone", 1, 3, 0.8, "§fКлык саблезуба")])

# ======================================================================= CHAOS
mob(W("chaos_knight"), "Рыцарь Хаоса", [
    cast("charge", "Копьё Хаоса", "Таранный удар копьём", 150, 15, dmg=10, r=3, fx=fx(("wither", 3, 0))),
    aura("Страх перед Хаосом", "Враги рядом слабеют", "foes", 5, fx(("weakness", 3, 0)), 80)],
    [D("minecraft:ender_pearl", 1, 2, 0.5, "§5Жемчужина Хаоса"), D("minecraft:obsidian", 1, 2, 0.6, "§8Чёрный камень")])
mob(W("void_knight"), "Рыцарь Пустоты", [
    cast("blink", "Шаг Пустоты", "Телепортируется за спину врагу", 160, 14),
    hit("Разрыв Пустоты", "Подбрасывает цель левитацией", 0.25, effects=fx(("levitation", 2, 0)))],
    [D("minecraft:ender_eye", 1, 1, 0.5, "§5Глаз Пустоты"), D("minecraft:echo_shard", 1, 1, 0.12, "§5Эхо Пустоты")])
mob(W("hornet_demon"), "Демон-шершень", [
    cast("bolt", "Ядовитое жало", "Метает жало с ядом", 80, 12, dmg=3, fx=fx(("poison", 6, 0)), p="minecraft:villager_angry"),
    hit("Укус роя", "Яд при каждом втором ударе", 0.5, effects=fx(("poison", 4, 0)))],
    [D("minecraft:honeycomb", 1, 3, 1.0, "§6Сот шершня"), D("minecraft:spider_eye", 1, 2, 0.6, "§2Жало шершня")])
mob(W("blood_angel"), "Кровавый ангел", [
    hit("Кровавое крыло", "Крадёт часть урона в здоровье", 0.5, steal=0.25),
    cast("slam", "Алый вихрь", "Круговой удар крыльями", 140, 5, r=4, dmg=6, kb=[1.0, 0.4])],
    [D("minecraft:feather", 3, 6, 1.0, "§cКровавое перо"), D("minecraft:ghast_tear", 1, 1, 0.25, "§cСлеза ангела")])
mob(W("black_blocker"), "Чёрный блокировщик", [
    cast("slam", "Сокрушение", "Мощный удар по земле", 140, 6, r=5, dmg=8, kb=[1.6, 0.6]),
    hurt("Каменная кожа", "Отражает урон", thorns=2, cd=100)],
    [D("minecraft:coal", 4, 8, 1.0, "§8Чёрный уголь"), D("minecraft:iron_ingot", 1, 3, 0.7, "§8Чёрная броня")])
mob(W("pink_horror"), "Розовый ужас", [
    cast("bolt", "Синее пламя", "Огненный заряд Тзинча", 70, 12, dmg=4, fire=3, p="minecraft:blue_flame_particle"),
    death("Расщепление", "Умирая, делится на двух меньших ужасов", spawn=[W("pink_horror"), 2])],
    [D("minecraft:amethyst_shard", 1, 2, 1.0, "§dОсколок Тзинча"), D("minecraft:glowstone_dust", 2, 4, 0.7, "§dМагическая пыль")])
mob(W("burning_chariot"), "Пылающая колесница", [
    cast("charge", "Таран колесницы", "Разгон и огненный удар", 100, 14, dmg=9, r=3, fire=4),
    aura("Огненный след", "Поджигает врагов вплотную", "foes", 3, fx(), 20, "minecraft:basic_flame_particle"),
    death("Взрыв колесницы", "При гибели взрывается огнём", burst=dict(r=4, dmg=6, fire=4))],
    [D("minecraft:blaze_rod", 1, 2, 1.0, "§6Ось колесницы"), D("minecraft:magma_cream", 1, 3, 0.7, "§cЖар колёс")])
mob(W("great_unclean_one"), "Великий осквернитель", [
    aura("Зловоние Нургла", "Яд и тошнота врагам вокруг", "foes", 8, fx(("poison", 3, 0), ("nausea", 5, 0)), 60, "minecraft:sporeblossom_ambient_particle")],
    [D("minecraft:slime_ball", 3, 6, 1.0, "§2Слизь Нургла"), D("minecraft:fermented_spider_eye", 1, 2, 0.6, "§2Чума"), D("minecraft:totem_of_undying", 1, 1, 0.1, "§2Дар Нургла")],
    note="Есть собственные механики (ярость, призыв, исцеление от убийств)")
mob(W("abomination_lord"), "Лорд-мерзость", [
    hit("Гниль", "Голод и яд", 0.4, effects=fx(("hunger", 8, 1), ("poison", 4, 0))),
    death("Чумное облако", "При гибели ядовитое облако", burst=dict(r=4, dmg=2, fx=fx(("poison", 8, 1))))],
    [D("minecraft:rotten_flesh", 3, 6, 1.0, "§2Гнилая плоть"), D("minecraft:spider_eye", 1, 3, 0.6, "§2Желчь")])

# ======================================================================= FACELESS
mob(W("faceless_warrior"), "Безликий воин", [
    hit("Пустой взгляд", "Слабость на 4 сек", 0.3, effects=fx(("weakness", 4, 0))),
    hurt("Стойка безликого", "При HP<50% Сопротивление I", below=0.5, self_fx=fx(("resistance", 8, 0)), cd=500)],
    [D("minecraft:prismarine_shard", 1, 3, 1.0, "§3Осколок безликого"), D("minecraft:ender_pearl", 1, 1, 0.1, "§5Бессловесная жемчужина")])
mob(W("faceless_berserker"), "Безликий берсерк", [
    hit("Пустая ярость", "Удар по площади", 0.5, cleave=dict(r=2.5, dmg=3)),
    hurt("Бешенство безликого", "При HP<40% Сила II", below=0.4, self_fx=fx(("strength", 10, 1)), cd=600)],
    [D("minecraft:prismarine_crystals", 1, 3, 1.0, "§3Кристалл ярости"), D("minecraft:amethyst_shard", 1, 2, 0.5, "§5Осколок")])
mob(W("faceless_general"), "Безликий генерал", [
    aura("Приказ безликих", "Союзники получают Силу и Сопротивление", "allies", 12, fx(("strength", 6, 0), ("resistance", 6, 0)), 80, "minecraft:totem_particle"),
    cast("summon", "Зов легиона", "Призывает безликих воинов", 500, 16, id=W("faceless_warrior"), n=1, cap=3)],
    [D("minecraft:prismarine_crystals", 2, 4, 1.0, "§3Кристалл генерала"), D("minecraft:diamond", 1, 1, 0.25, "§bСердце безликих")])
mob(W("faceless_sorcerer"), "Безликий чародей", [
    cast("bolt", "Бессловесное заклятие", "Магический снаряд с тошнотой", 80, 16, dmg=6, fx=fx(("nausea", 4, 0)), p="minecraft:witchspell_emitter"),
    cast("blink", "Сдвиг", "Телепортируется за врага", 200, 14)],
    [D("minecraft:lapis_lazuli", 2, 5, 1.0, "§9Лазурь безликих"), D("minecraft:amethyst_shard", 1, 3, 0.8, "§5Осколок чародея")])
mob(W("faceless_cultist"), "Безликий культист", [
    aura("Тьма культа", "Окутывает врагов тьмой", "foes", 8, fx(("darkness", 4, 0)), 100),
    death("Жертвенный огонь", "При гибели вспышка тьмы", burst=dict(r=3, dmg=3, fx=fx(("blindness", 3, 0))))],
    [D("minecraft:ink_sac", 2, 4, 1.0, "§8Чёрные чернила культа"), D("minecraft:bone_meal", 2, 4, 0.7, "§7Прах культиста")])
mob(W("faceless_nightmare"), "Безликий кошмар", [
    cast("mist", "Пелена кошмара", "Слепит врагов, сам невидим", 300, 10, r=7, fx=fx(("blindness", 4, 0)), self_fx=fx(("invisibility", 5, 0))),
    hit("Кошмар", "Тошнота и замедление", 0.35, effects=fx(("nausea", 5, 0), ("slowness", 3, 0)))],
    [D("minecraft:phantom_membrane", 1, 2, 1.0, "§5Плёнка кошмара"), D("minecraft:ender_pearl", 1, 1, 0.2, "§5Сон безликого")])

# ======================================================================= SCOURGE & others
mob(W("nazgul"), "Назгул", [
    aura("Дыхание Назгула", "Слабость и голод у врагов", "foes", 8, fx(("weakness", 3, 0), ("hunger", 3, 1)), 80, "minecraft:soul_particle"),
    hit("Клинок-призрак", "Иссушение", 0.4, effects=fx(("wither", 4, 0)))],
    [D("minecraft:soul_sand", 2, 4, 1.0, "§8Пепел назгула"), D("minecraft:netherite_scrap", 1, 1, 0.1, "§8Осколок кольца")])
mob(W("pirate_ghost"), "Призрак пирата", [
    cast("blink", "Призрачный шаг", "Появляется рядом с врагом", 150, 12),
    hit("Проклятие капитана", "Замедление и слепота", 0.3, effects=fx(("slowness", 3, 1), ("blindness", 2, 0)))],
    [D("minecraft:gold_nugget", 3, 7, 1.0, "§6Золото Мёртвого моря"), D("minecraft:nautilus_shell", 1, 1, 0.1, "§3Ракушка капитана")])
mob(W("skeleton_bear"), "Медведь-скелет", [
    hit("Костяной удар", "Замедляет цель", 0.35, effects=fx(("slowness", 3, 1)), kb=[1.2, 0.3]),
    cast("leap", "Прыжок мертвеца", "Кидается на врага", 120, 9, h=0.9, v=0.5)],
    [D("minecraft:bone", 3, 6, 1.0, "§fРебро медведя"), D("minecraft:bone_block", 1, 1, 0.2, "§fКостяной блок")])
mob(W("undead_zombie"), "Мертвец", [
    hit("Чумной укус", "Голод и яд", 0.35, effects=fx(("hunger", 6, 0), ("poison", 3, 0))),
    aura("Смрад", "Медленно замедляет врагов вплотную", "foes", 3, fx(("slowness", 2, 0)), 60)],
    [D("minecraft:rotten_flesh", 2, 4, 1.0, "§2Чумная плоть"), D("minecraft:iron_nugget", 1, 2, 0.4, "§7Ржавая монета")])
mob(W("santa_claus"), "Зимний дед", [
    cast("bolt", "Снежок из мешка", "Снежок с замедлением", 70, 12, dmg=3, fx=fx(("slowness", 3, 1)), p="minecraft:snowflake_particle"),
    aura("Праздничное тепло", "Союзники регенерируют", "allies", 10, fx(("regeneration", 4, 0)), 100, "minecraft:heart_particle"),
    death("Мешок подарков", "При гибели рассыпает подарки", burst=dict(r=3, dmg=0, fx=fx(("slowness", 3, 1))))],
    [D("minecraft:cake", 1, 1, 0.5, "§cПраздничный торт"), D("minecraft:emerald", 2, 5, 1.0, "§aПодарок деда"), D("minecraft:snowball", 4, 12, 1.0, "§fСнежок")])
mob(W("ice_demon"), "Ледяной демон", [
    aura("Стужа", "Замедляет врагов рядом", "foes", 6, fx(("slowness", 3, 1)), 60, "minecraft:snowflake_particle"),
    hit("Ледяное касание", "Замораживает: замедление III и усталость", 0.4, effects=fx(("slowness", 3, 2), ("mining_fatigue", 3, 1)))],
    [D("minecraft:packed_ice", 1, 3, 1.0, "§bЛёд демона"), D("minecraft:prismarine_crystals", 1, 2, 0.5, "§bКристалл мороза")])
mob(W("grizzly_bear"), "Гризли", [
    hit("Медвежий удар", "Мощное отбрасывание", 0.3, kb=[1.6, 0.45]),
    hurt("Ярость гризли", "При HP<50% Сила I и Скорость I", below=0.5, self_fx=fx(("strength", 10, 0), ("speed", 10, 0)), cd=600)],
    [D("minecraft:leather", 2, 5, 1.0, "§6Шкура гризли"), D("minecraft:porkchop", 2, 4, 0.8, "§cМедвежатина"), D("minecraft:honey_bottle", 1, 1, 0.2, "§6Мёд гризли")])
mob(W("big_ent"), "Большой энт", [
    cast("heal", "Сок древа", "Лечит союзников и себя", 220, 14, r=10, amt=6, self_too=True),
    cast("pull", "Корни", "Притягивает врагов и замедляет", 260, 10, r=8, str=1.2, fx=fx(("slowness", 4, 2))),
    aura("Лесная аура", "Регенерация союзникам", "allies", 10, fx(("regeneration", 3, 0)), 100, "minecraft:villager_happy")],
    [D("minecraft:oak_sapling", 2, 4, 1.0, "§2Росток энта"), D("minecraft:stick", 4, 10, 1.0, "§6Ветка энта"), D("minecraft:golden_apple", 1, 1, 0.08, "§6Плод энта")])
mob(W("frost_golem"), "Ледяной голем", [
    aura("Дыхание мороза", "Замедляет врагов", "foes", 6, fx(("slowness", 3, 1)), 60, "minecraft:snowflake_particle")],
    [D("minecraft:packed_ice", 2, 5, 1.0, "§bЛедяное ядро"), D("minecraft:diamond", 1, 1, 0.1, "§bСердце мороза")], note="Есть собственные механики")
mob(W("lightning_golem"), "Голем-молния", [
    cast("bolt", "Цепная молния", "Разряд, перескакивающий на ближних врагов", 90, 14, dmg=6, chain=dict(n=2, r=5, dmg=4), p="minecraft:electric_spark_particle")],
    [D("minecraft:lightning_rod", 1, 2, 1.0, "§eГромоотвод голема"), D("minecraft:copper_ingot", 2, 5, 0.8, "§6Заряженная медь")], note="Есть собственные механики")
mob(W("inferno_golem"), "Инферно-голем", [
    aura("Жар горна", "Поджигает врагов вплотную", "foes", 4, fx(), 30, "minecraft:basic_flame_particle")],
    [D("minecraft:blaze_rod", 1, 2, 1.0, "§6Стержень инферно"), D("minecraft:magma_cream", 2, 4, 0.8, "§cЛава голема")], note="Есть собственные механики")
mob(W("ember_colossus"), "Колосс углей", [
    death("Взрыв углей", "При гибели рассыпается огненным взрывом", burst=dict(r=5, dmg=8, fire=5)),
    aura("Тлеющая земля", "Поджигает врагов вплотную", "foes", 4, fx(), 40, "minecraft:basic_flame_particle")],
    [D("minecraft:coal_block", 1, 2, 1.0, "§8Уголь колосса"), D("minecraft:netherite_scrap", 1, 1, 0.1, "§6Ядро колосса")])
mob(C("inferno_golem"), "Голем Скверны", [
    aura("Зелёное пламя", "Иссушает врагов вплотную", "foes", 4, fx(("wither", 2, 0)), 40, "minecraft:soul_particle")],
    [D("minecraft:emerald", 1, 3, 1.0, "§aЯдро Скверны"), D("minecraft:slime_ball", 2, 4, 0.6, "§aЗелёная смола")], note="Призывается Гул'даном; есть механики в guldan.js")
mob(C("hephaestus_golem"), "Голем Гефеста", [
    cast("heal", "Починка", "Лечит союзных големов и олимпийцев", 240, 14, r=10, amt=8),
    hit("Удар молота", "Огненный удар", 0.35, fire=3)],
    [D("minecraft:copper_ingot", 2, 4, 1.0, "§6Бронза Гефеста"), D("minecraft:iron_ingot", 1, 3, 0.8, "§7Кованое железо")])

# ======================================================================= cb: lesser creatures
mob(C("goblin"), "Гоблин", [
    hit("Воровская лапа", "Быстро отскакивает после удара", 0.4, self_fx=fx(("speed", 4, 2))),
    hurt("Трусость", "При HP<50% убегает", below=0.5, self_fx=fx(("speed", 6, 2)), cd=400)],
    [D("minecraft:gold_nugget", 1, 4, 1.0, "§6Гоблинская монета"), D("minecraft:emerald", 1, 1, 0.1, "§aКраденый изумруд")], note="Есть дроп и логика в goblin.json")
mob(C("orc"), "Орк", [aura("Боевой клич", "Орки рядом получают Силу I", "allies", 8, fx(("strength", 5, 0)), 120, "minecraft:totem_particle")],
    [D("minecraft:iron_nugget", 2, 5, 0.7, "§7Орочья заклёпка")], note="Есть механики в orcs.js/mob_ai.js")
mob(C("green_orc"), "Зелёный орк", [hit("Рваная рана", "Яд на 3 сек", 0.25, effects=fx(("poison", 3, 0)))],
    [D("minecraft:rotten_flesh", 1, 3, 0.8, "§aЗелёная плоть")], note="Есть механики в orcs.js")
mob(C("hell_orc"), "Адский орк", [hit("Адский удар", "Поджигает цель", 0.35, fire=3)],
    [D("minecraft:blaze_powder", 1, 2, 0.7, "§cАдский порошок")], note="Есть механики в orcs.js")
mob(C("fel_minion"), "Миньон Скверны", [hit("Касание Скверны", "Замедление и слабость", 0.3, effects=fx(("slowness", 2, 0), ("weakness", 3, 0)))],
    [D("minecraft:slime_ball", 1, 2, 0.8, "§aСлизь Скверны")])
mob(C("smart_troll"), "Умный тролль", [
    cast("bolt", "Метание копья", "Бросает копьё", 100, 14, dmg=5, p="minecraft:crit_particle"),
    aura("Смекалка", "Тролли рядом получают Скорость", "allies", 8, fx(("speed", 4, 0)), 120)],
    [D("minecraft:bone", 1, 3, 0.8, "§fТролльская кость")])
mob(C("tribal_troll"), "Тролль-шаман", [
    cast("heal", "Тотем исцеления", "Лечит союзников", 220, 12, r=8, amt=5),
    cast("rally", "Зов племени", "Силу и скорость соплеменникам", 400, 14, r=10, fx=fx(("strength", 8, 0), ("speed", 8, 0)))],
    [D("minecraft:lapis_lazuli", 1, 3, 0.8, "§9Синий камень племени")])
mob(C("wild_troll"), "Дикий тролль", [
    aura("Регенерация тролля", "Быстро регенерирует", "self", 0, fx(("regeneration", 3, 1)), 80),
    hit("Дубина", "Отбрасывает", 0.3, kb=[1.4, 0.4])],
    [D("minecraft:bone", 1, 3, 0.8, "§fДикая кость"), D("minecraft:leather", 1, 2, 0.5, "§6Шкура тролля")])
mob(C("cannibal_troll"), "Тролль-каннибал", [
    hit("Пожирание", "Крадёт часть урона в здоровье, голод цели", 0.4, steal=0.3, effects=fx(("hunger", 5, 1))),
    cast("slam", "Удар в землю", "Топот по площади", 160, 5, r=4, dmg=6, kb=[1.2, 0.5])],
    [D("minecraft:rotten_flesh", 2, 5, 1.0, "§cМясо каннибала"), D("minecraft:bone", 2, 4, 0.8, "§fКость жертвы")])
mob(C("ice_troll"), "Ледяной тролль", [
    aura("Иней", "Замедляет врагов вплотную", "foes", 4, fx(("slowness", 2, 0)), 60, "minecraft:snowflake_particle"),
    hit("Ледяная дубина", "Замораживает цель", 0.3, effects=fx(("slowness", 3, 2)))],
    [D("minecraft:packed_ice", 1, 3, 0.9, "§bЛёд тролля")])
mob(C("troll_totem"), "Тотем тролля", [
    aura("Дух племени", "Тролли и орки рядом регенерируют", "allies", 10, fx(("regeneration", 3, 0), ("resistance", 3, 0)), 80, "minecraft:totem_particle")])
mob(C("warg"), "Варг", [
    cast("leap", "Прыжок варга", "Кидается на врага", 100, 10, h=1.0, v=0.5),
    hit("Волчий укус", "Кровотечение (яд)", 0.3, effects=fx(("poison", 3, 0)))],
    [D("minecraft:bone", 1, 2, 0.7, "§7Клык варга"), D("minecraft:leather", 1, 2, 0.6, "§8Шкура варга")])
mob(C("thunder_lizard"), "Громовой ящер", [
    cast("bolt", "Раскат грома", "Разряд молнии с цепным ударом", 140, 14, dmg=6, chain=dict(n=2, r=5, dmg=3), p="minecraft:electric_spark_particle"),
    cast("charge", "Таран ящера", "Рывок с ударом", 160, 14, dmg=8, r=3)],
    [D("minecraft:lightning_rod", 1, 1, 0.5, "§eЗуб ящера"), D("minecraft:leather", 2, 3, 0.8, "§6Чешуя ящера")], note="Верховой зверь; есть механики в thunder_lizard.js")
mob(C("mermaid"), "Русалка", [aura("Песнь течений", "Игроки и союзники рядом дышат под водой", "allies", 8, fx(("water_breathing", 8, 0)), 120, "minecraft:bubble_particle")],
    [D("minecraft:prismarine_shard", 1, 2, 0.7, "§3Чешуя русалки"), D("minecraft:pufferfish", 1, 1, 0.2, "§3Дар глубин")], note="Есть механики в merfolk.js")
mob(C("siren"), "Сирена", [
    cast("fear", "Зов сирены", "Враги слабеют и замедляются", 260, 12, r=10, fx=fx(("slowness", 4, 1), ("nausea", 5, 0))),
    hit("Ядовитая песнь", "Яд", 0.3, effects=fx(("poison", 4, 0)))],
    [D("minecraft:nautilus_shell", 1, 1, 0.25, "§3Ракушка сирены"), D("minecraft:prismarine_crystals", 1, 2, 0.8, "§3Слеза сирены")], note="Есть механики в merfolk.js")
mob(C("poseidon_triton"), "Тритон Посейдона", [
    cast("bolt", "Трезубец", "Бросок трезубца", 100, 14, dmg=6, p="minecraft:bubble_particle"),
    aura("Благословение моря", "Дыхание под водой союзникам", "allies", 8, fx(("water_breathing", 8, 0), ("speed", 4, 0)), 100)],
    [D("minecraft:prismarine_shard", 1, 3, 1.0, "§3Осколок тритона")])
mob(C("zeus_archon"), "Архонт Зевса", [
    cast("bolt", "Гнев Зевса", "Молния с цепным ударом", 100, 16, dmg=7, chain=dict(n=2, r=5, dmg=4), p="minecraft:electric_spark_particle"),
    hit("Грозовой удар", "Оглушает: слабость и замедление", 0.3, effects=fx(("slowness", 2, 1), ("weakness", 2, 0)))],
    [D("minecraft:gold_ingot", 1, 2, 1.0, "§eЗолото Олимпа"), D("minecraft:lightning_rod", 1, 1, 0.3, "§eИскра архонта")])
mob(C("ares_berserker"), "Берсерк Ареса", [
    hurt("Кровь Ареса", "При HP<50% Сила II", below=0.5, self_fx=fx(("strength", 10, 1)), cd=500),
    hit("Боевой раж", "Крадёт здоровье", 0.4, steal=0.2)],
    [D("minecraft:iron_ingot", 1, 3, 1.0, "§cЖелезо Ареса"), D("minecraft:red_dye", 1, 3, 0.7, "§cКровь войны")])
mob(C("athena_hoplite"), "Гоплит Афины", [
    hurt("Щит фаланги", "При HP<60% Сопротивление II", below=0.6, self_fx=fx(("resistance", 8, 1)), cd=400),
    aura("Фаланга", "Союзники рядом получают Сопротивление I", "allies", 8, fx(("resistance", 4, 0)), 100)],
    [D("minecraft:copper_ingot", 1, 3, 1.0, "§6Бронза Афины"), D("minecraft:emerald", 1, 1, 0.15, "§aДар мудрости")])
mob(C("hades_shade"), "Тень Аида", [
    cast("blink", "Шаг теней", "Появляется рядом с врагом", 140, 12),
    hit("Касание Аида", "Иссушение", 0.35, effects=fx(("wither", 3, 0)))],
    [D("minecraft:soul_sand", 1, 3, 1.0, "§8Пепел души"), D("minecraft:bone", 1, 3, 0.7, "§7Кость тени")])
mob(C("death_knight"), "Рыцарь смерти", [
    hit("Чумной клинок", "Иссушение и замедление", 0.4, effects=fx(("wither", 3, 0), ("slowness", 2, 1))),
    aura("Холод могилы", "Замедляет врагов рядом", "foes", 5, fx(("slowness", 2, 0)), 80, "minecraft:soul_particle")],
    [D("minecraft:iron_ingot", 1, 3, 1.0, "§bРуническая сталь"), D("minecraft:diamond", 1, 1, 0.15, "§bРуна смерти")])
mob(C("ice_spirit"), "Ледяной дух", [
    aura("Морозный вихрь", "Сильно замедляет врагов вплотную", "foes", 5, fx(("slowness", 3, 2)), 50, "minecraft:snowflake_particle"),
    death("Ледяной взрыв", "При гибели замораживает всё рядом", burst=dict(r=4, dmg=3, fx=fx(("slowness", 5, 2))))],
    [D("minecraft:packed_ice", 2, 4, 1.0, "§bЛёд духа"), D("minecraft:prismarine_crystals", 1, 2, 0.6, "§bСлеза зимы")])
mob(C("human_villager"), "Житель", [hurt("Тревога", "Зовёт стражу: даёт Силу соседям", below=0.8, self_fx=fx(("speed", 4, 1)), cd=400)],
    [D("minecraft:bread", 1, 2, 0.5, "§6Хлеб жителя")], note="Есть логика поселений в settlements.js")
mob(C("human_civilian"), "Горожанин", [hurt("Паника", "Быстро убегает от опасности", below=0.9, self_fx=fx(("speed", 5, 1)), cd=300)],
    [D("minecraft:wheat", 1, 3, 0.5, "§eЗерно горожанина")], note="Есть логика поселений в settlements.js")
mob(C("dragon_east"), "Восточный дракон", [aura("Небесный жар", "Поджигает врагов вплотную", "foes", 5, fx(), 40, "minecraft:basic_flame_particle")],
    [D("minecraft:dragon_breath", 1, 1, 0.2, "§dДыхание дракона"), D("minecraft:leather", 2, 4, 0.8, "§6Чешуя дракона")], note="Есть механики в dragons.js")
mob(C("dragon_west"), "Западный дракон", [aura("Огненное дыхание", "Поджигает врагов вплотную", "foes", 5, fx(), 40, "minecraft:basic_flame_particle")],
    [D("minecraft:dragon_breath", 1, 1, 0.2, "§dДыхание дракона"), D("minecraft:leather", 2, 4, 0.8, "§6Чешуя дракона")], note="Есть механики в dragons.js")
mob(C("ore_beetle"), "Рудный жук", [], [], note="Есть механики в beetles.js (руда по виду жука)")
for ore, ru, itm in (("coal", "Угольный", "coal"), ("copper", "Медный", "copper_ingot"), ("iron", "Железный", "iron_ingot"), ("gold", "Золотой", "gold_ingot"),
                     ("diamond", "Алмазный", "diamond"), ("emerald", "Изумрудный", "emerald"), ("lapis", "Лазуритовый", "lapis_lazuli"),
                     ("quartz", "Кварцевый", "quartz"), ("redstone", "Редстоуновый", "redstone")):
    mob(C(ore + "_beetle"), ru + " жук", [], [D("minecraft:" + itm, 1, 1, 0.35, "§7Жила жука")], note="Есть механики в beetles.js")

# ======================================================================= bosses (mechanics already in scripts: trophies only)
BOSS = {
    "zeus": ("Зевс", "Гнев Зевса, грозовой шторм, божественный щит", [D("minecraft:lightning_rod", 2, 4, 1.0, "§eМолния Зевса"), D("minecraft:totem_of_undying", 1, 1, 0.4, "§6Благословение Громовержца")]),
    "poseidon": ("Посейдон", "Цунами, водоворот, призыв тритонов", [D("minecraft:nautilus_shell", 1, 2, 1.0, "§3Раковина Посейдона"), D("minecraft:trident", 1, 1, 0.25, "§3Трезубец морей")]),
    "hades": ("Аид", "Цепи подземного мира, призыв душ, пламя Аида", [D("minecraft:soul_sand", 4, 8, 1.0, "§8Пепел Аида"), D("minecraft:netherite_scrap", 1, 2, 0.35, "§8Слиток подземного мира")]),
    "ares": ("Арес", "Боевая ярость, кровавый рывок, воинственный клич", [D("minecraft:iron_ingot", 3, 6, 1.0, "§cЖелезо Ареса"), D("minecraft:netherite_scrap", 1, 1, 0.3, "§cОсколок щита Ареса")]),
    "athena": ("Афина", "Божественный щит, копьё мудрости, призыв гоплитов", [D("minecraft:book", 1, 2, 1.0, "§fСвиток Афины"), D("minecraft:totem_of_undying", 1, 1, 0.35, "§bМудрость Афины")]),
    "hephaestus": ("Гефест", "Огненная кузница, стражи-големы, божественное ремесло", [D("minecraft:netherite_scrap", 1, 2, 0.6, "§6Слиток Гефеста"), D("minecraft:anvil", 1, 1, 0.3, "§6Наковальня богов")]),
    "minotaur": ("Минотавр", "Таран, топот лабиринта, ярость быка", [D("minecraft:iron_axe", 1, 1, 0.3, "§6Секира Минотавра"), D("minecraft:leather", 3, 6, 1.0, "§6Шкура Минотавра")]),
    "fel_lord": ("Повелитель Скверны", "Призыв легиона, зелёное пламя, проклятие Скверны", [D("minecraft:emerald", 3, 6, 1.0, "§aСердце Скверны"), D("minecraft:nether_star", 1, 1, 0.12, "§aЗвезда Скверны")]),
    "lich_king": ("Король-лич", "Поднятие мёртвых, ледяная гробница, ледяные шипы", [D("minecraft:packed_ice", 4, 8, 1.0, "§bОсколок Трона"), D("minecraft:nether_star", 1, 1, 0.15, "§bЗвезда Короля-лича")]),
    "dreadlord": ("Повелитель ужаса", "Гипноз, летучие мыши, туман", [D("minecraft:phantom_membrane", 2, 4, 1.0, "§5Крыло ужаса"), D("minecraft:echo_shard", 1, 1, 0.25, "§5Эхо кошмара")]),
    "cyclops": ("Циклоп", "Удары рук и ног, захват, глотание, слепота", [D("minecraft:iron_ingot", 4, 8, 1.0, "§6Обломок Циклопа"), D("minecraft:diamond", 1, 2, 0.4, "§bГлаз Циклопа")]),
    "hydra": ("Гидра", "Пять голов, отрастание голов, ядовитые плевки", [D("minecraft:slime_ball", 4, 8, 1.0, "§2Яд Гидры"), D("minecraft:totem_of_undying", 1, 1, 0.3, "§2Бессмертная голова")]),
    "circe": ("Цирцея", "Превращение в животных, магические шары, зелья", [D("minecraft:amethyst_shard", 2, 5, 1.0, "§dКристалл Цирцеи"), D("minecraft:ender_pearl", 1, 2, 0.5, "§dЖемчужина чар")]),
    "guldan": ("Гул'дан", "Шары Скверны, поглощение жизни, голем Скверны", [D("minecraft:emerald", 2, 5, 1.0, "§aЖертва Скверны"), D("minecraft:nether_star", 1, 1, 0.1, "§aГлаз Гул'дана")]),
    "laestrygonian": ("Лестригон", "Удары дубиной, рёв, топот", [D("minecraft:iron_ingot", 2, 4, 1.0, "§6Обломок дубины"), D("minecraft:leather", 2, 4, 0.8, "§6Шкура великана")]),
}
for k, (ru, note, dr) in BOSS.items():
    mob(C(k), ru, [], dr, note="Уникальные механики в скриптах: " + note)

# ------------------------------------------------------------------- weapons / items
ITEMS = {
    "cb:hell_scimitar": dict(ru="Адский ятаган", d="Поджигает цель на 4 сек; 15% — вспышка Скверны (урон по площади)"),
    "cb:laestrygonian_sword": dict(ru="Меч лестригона", d="Размашистый удар: урон и отбрасывание всем врагам рядом с целью"),
    "cb:dragon_scale": dict(ru="Чешуя дракона", d="ПКМ: Огнеупорность на 40 сек (перезарядка 45 сек, не расходуется)"),
    "cb:bronze_ingot": dict(ru="Бронзовый слиток", d="Материал для ковки; ПКМ: Поглощение на 20 сек (перезарядка 60 сек, не расходуется)"),
    "cb:bestiary": dict(ru="Бестиарий уникальностей", d="ПКМ: список фракций, способностей и трофеев всех существ"),
}

# ------------------------------------------------------------------- projectiles / forms / parts (their uniqueness lives in the boss scripts)
for ident, ru, note in (
    ("circe_orb", "Магический шар Цирцеи", "Снаряд Цирцеи: магический урон и превращающая метка (circe.js)"),
    ("dragon_fire", "Огненное дыхание", "Снаряд дракона: поджигает цель и землю (dragons.js)"),
    ("dragon_frost", "Ледяное дыхание", "Снаряд дракона: замораживает и замедляет (dragons.js)"),
    ("dragon_spark", "Грозовое дыхание", "Снаряд дракона: цепная молния (dragons.js)"),
    ("fel_orb", "Шар Скверны", "Снаряд Гул'дана: урон магией и иссушение (guldan.js)"),
    ("fel_rain", "Дождь Скверны", "Падающий снаряд Гул'дана: поражает область (guldan.js)"),
    ("hex_chicken", "Курица-превращение", "Форма Цирцеи: жертва превращается в курицу"),
    ("hex_goat", "Коза-превращение", "Форма Цирцеи: жертва превращается в козу"),
    ("hex_horse", "Лошадь-превращение", "Форма Цирцеи: жертва превращается в лошадь"),
    ("hex_pig", "Свинья-превращение", "Форма Цирцеи: жертва превращается в свинью"),
    ("hex_sheep", "Овца-превращение", "Форма Цирцеи: жертва превращается в овцу"),
    ("hydra_head", "Голова гидры", "Отдельная живая голова: кусает, отрастает заново (hydra.js)"),
    ("hydra_neck", "Шея гидры", "Часть тела гидры: держит голову и принимает урон (hydra.js)"),
    ("hydra_spit", "Яд гидры", "Снаряд гидры: ядовитая лужа (hydra.js)"),
    ("lich_statue", "Ледяная статуя", "Вторая стадия Короля-лича: 8 секунд, затем Ледяной дух (mythic_bosses.js)"),
    ("sargeras_prompt", "Алтарь Саргераса", "Меню призыва голема Скверны (guldan.js)"),
):
    mob(C(ident), ru, [], [], note=note)
