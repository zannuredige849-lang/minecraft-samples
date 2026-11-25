# Warhammer Unified v10 — «Новый стиль»

Переработка аддона **ZhekAziz x Warhammer UNIFIED v9.1**: все мобы, текстуры, предметы и яйца призыва приведены к одному стилю,
добавлены фракции/семейства, големы стали почти одинаковыми, призванные существа не воюют со своими.

* Готовый файл: [`dist/ZhekAziz_x_Warhammer_Unified_v10.0_NewStyle.mcaddon`](dist/ZhekAziz_x_Warhammer_Unified_v10.0_NewStyle.mcaddon)
  (UUID паков те же, версия 10.0.0 — ставится поверх v9.1).
* Распакованный результат: [`addon/`](addon) · исходник v9.1: [`source/`](source) · генератор: [`tools/`](tools).
* Превью всех 113 моделей (рендер из итоговых файлов): [`previews/`](previews) (`gallery_01..06.png`, `spawn_eggs.png`).

> **Не проверено в самой игре.** Среда без клиента Minecraft: JSON, ссылки, UV и анимации проверены скриптом
> (`tools/package.py::validate`, 0 ошибок), модели отрисованы собственным рендерером. Поведение целей/анимаций в игре нужно
> проверить вручную (см. «Что проверить в игре»).

## Единый стиль («чанки-блок»)

* Эталон — чистые блочные модели `cb:*` (Арес, Афина, Зевс, орки…). Шумные конверсии из WC3 (`warcraft:*`, до 5000 мелких кубов,
  в позе покоя — «каша») заменены новыми моделями.
* Правила: кубы только целые, плотность 1 пиксель = 1/16 блока, каждая грань = тон палитры + скос (светлее сверху-слева, темнее снизу-справа)
  + редкий структурный узор; никакого случайного шума; одна и та же шкала из 6 тонов (холодные тени, тёплые света) для всех палитр;
  грани нарисованы симметрично (не зависят от ориентации UV в движке).
* Кости и анимации: у 51 пересобранной модели единая раскладка костей (`root/body/head/arm_l/arm_r/leg_l/leg_r/cape/skirt/wing_*/tail/…`),
  анимации перегенерированы с **теми же ID, длинами и циклами**, поэтому старые контроллеры, `warcraft:anim_state` и скрипты работают без правок.

| Что | Как |
|---|---|
| 49 мобов `warcraft:*` | новые модели + текстуры + анимации из генератора (`tools/forge`) |
| `cb:inferno_golem`, `cb:hephaestus_golem` | пересобраны тем же шаблоном голема |
| остальные `cb:*` (≈60 текстур + варианты: драконы, жуки, русалки…) | геометрия и анимации сохранены; текстуры: чистка шума (только каннибал-тролль), ограничение палитры, общая цветокоррекция, скос по граням кубов |
| 87 яиц призыва | одна форма яйца; цвет — доминирующий цвет моба; эмблема — фракции (или стихии/роли) |
| 28 иконок предметов, 48 текстур шкур-брони | **не перерисованы**, а приведены к общему виду (палитра, цветокоррекция, контур внутри силуэта; силуэт сохранён, чтобы не сломать 3D-оружие) |

## Правка v2 (по замечаниям)

* **Эталон детализации — Циклоп, Нага (сирена), Повелитель Скверны.** Каркас гуманоида переписан: тело из сегментов (таз, пресс, грудь, нагрудные пластины, спинная пластина, шея, горжет),
  руки из плеча + предплечья со сгибом в локте (налокотник, браслет с плетёным узором, кулак), ноги из бедра, колена, голени с наколенником, сапога с носком,
  наплечники из нескольких пластин, пояс с подсумками, набедренные повязки, ремни, клыки/рога из сегментов. Кубов на моба стало 50–100 (было 25–60).
  Текстуры богаче: панели с канавками, царапины, заклёпки, плетёные полосы, мышечные блики на коже.
* **Оружие и предметы в руках.** Раньше клинок торчал вертикально над плечом. Теперь оружие — дочерняя кость предплечья, рукоять лежит в кулаке,
  клинок наклонён вперёд (меч ≈48°, копьё ≈14°, посох ≈10°, секиры ≈34–52°), щит держится на согнутом левом предплечье.
  Анимации атаки/каста/ходьбы учитывают предплечья.
* **Ничего не парит рядом с мобом.** Удалены орбиты, нимбы, рой мух, плавающие плиты и т. п. у новых мобов (кристаллы теперь закреплены на плечах);
  у старых `cb:*` убраны парящие ауры (`auraBone` у рыцаря смерти, ледяного духа и ледяной статуи), «эссенции» миньона Скверны и плавающие черепа тотема тролля (26 кубов).
  Скрипт `tools/strays.py` ищет оторванные кластеры; оставшиеся — намеренные (плавники русалок/нагa, кристаллы жуков, лоскуты лестригона).

## Големы

Один шаблон `tools/forge/golems.py`, различаются стихией (палитра) и 2–3 деталями:
ледяной (кристаллы, снег), молния (антенны, искры), инферно/эмбер (рога, огонь, трещины лавы, шипы), кузнечный Гефеста (решётка, трубы), скверна (зелёные трещины).
Все семь големов — одно «родство» `golem_kin`: **между собой не воюют**, даже у разных фракций.

## Фракции и семейства

Единая таблица — `tools/forge/factions.py`. Каждой сущности добавлены семейства `f_<фракция>` (+ `golem_kin`, `summon_safe`);
во все `nearest_attackable_target`, `nearest_prioritized_attackable_target`, `hurt_by_target`, `defend_trusted_target`
(и в component_groups) добавлено условие «цель не из своей фракции/родства» (219 фильтров + 46 `hurt_by_target`).
Призванные существа — те же типы, поэтому остаются в фракции призывателя (олимпийские слуги, миньоны Гул'дана, големы).
Скрипты: новый `scripts/factions.js` (`areAllies`), он подключён в `orcs.js`, `warhammer_main.js`, `guldan.js`, а также возвращает здоровье,
если урон между союзниками всё же прошёл (область, снаряд, скриптовый удар).

| Семейство | Фракция | Сущностей | Состав |
|---|---|---|---|
| `f_order` | Орден Королевства | 13 | chival_warrior, dark_plate_knight, elector_knight, garithos_paladin, heide_hood_knight, heide_knight, high_elf_spearman, imperial_guard… |
| `f_norsca` | Норска | 9 | bandit_dog, bandit_raider, chaos_warrior, norse_berserker, norse_marauder, norse_shaman, sabertooth_rider, skaal_villager… |
| `f_chaos` | Легион Хаоса | 7 | chaos_knight, void_knight, hornet_demon, black_blocker, blood_angel, pink_horror, burning_chariot |
| `f_nurgle` | Нургл | 2 | abomination_lord, great_unclean_one |
| `f_faceless` | Безликие | 6 | faceless_berserker, faceless_cultist, faceless_general, faceless_nightmare, faceless_sorcerer, faceless_warrior |
| `f_scourge` | Плеть | 9 | nazgul, pirate_ghost, skeleton_bear, undead_zombie, death_knight, dreadlord, lich_king, lich_statue… |
| `f_golems` | Стихийные големы | 7 | frost_golem, lightning_golem, inferno_golem, ember_colossus, ice_demon, inferno_golem, hephaestus_golem |
| `f_nature` | Дикая природа | 2 | big_ent, grizzly_bear |
| `f_fel` | Орда Скверны | 9 | fel_lord, fel_minion, fel_orb, fel_rain, green_orc, hell_orc, guldan, warg… |
| `f_tribes` | Племена орков и троллей | 5 | orc, smart_troll, tribal_troll, troll_totem, thunder_lizard |
| `f_wild_trolls` | Дикие тролли | 3 | wild_troll, cannibal_troll, ice_troll |
| `f_olympus` | Олимп | 12 | zeus, zeus_archon, ares, ares_berserker, athena, athena_hoplite, hades, hades_shade… |
| `f_giants` | Великаны | 2 | cyclops, laestrygonian |
| `f_sea` | Морской народ | 2 | mermaid, siren |
| `f_dragons` | Драконы | 5 | dragon_east, dragon_west, dragon_fire, dragon_frost, dragon_spark |
| `f_hydra` | Гидра | 4 | hydra, hydra_head, hydra_neck, hydra_spit |
| `f_witches` | Ведьмы | 7 | circe, circe_orb, hex_chicken, hex_goat, hex_horse, hex_pig, hex_sheep |
| `f_beetles` | Рудные жуки | 10 | ore_beetle, coal_beetle, copper_beetle, diamond_beetle, emerald_beetle, gold_beetle, iron_beetle, lapis_beetle… |
| `f_humans` | Люди | 2 | human_civilian, human_villager |
| `f_goblins` | Гоблины | 1 | goblin |
| `f_labyrinth` | Лабиринт | 1 | minotaur |
| `f_santa` | Зимний дед | 1 | santa_claus |
| `f_beasts` | Ездовые звери | 0 |  |

Отношения между разными фракциями — прежние (из исходных фильтров); поменялось только «свои своих не бьют».

## Пересборка

```bash
mkdir /tmp/v91 && cd /tmp/v91 && unzip -q <repo>/warhammer_unified/source/ZhekAziz_x_Warhammer_Unified_v9.1.mcaddon
cd <repo>/warhammer_unified
python3 tools/build_all.py /tmp/v91 addon --zip dist/ZhekAziz_x_Warhammer_Unified_v10.0_NewStyle.mcaddon
python3 tools/gallery.py addon previews
```
Нужны `numpy` и `Pillow`. Шаги: `build_models` (геометрия/текстуры/анимации) → `restyle` → `items_style` → `patch_bp` (фракции) → `package` (манифесты, проверка, zip).

## Что проверить в игре

1. Позы оружия и посадка всадников (оружие наклонено на 38°, ноги всадников скрыты в посадке).
2. `hurt_by_target.entity_types` с фильтром (документированное поле, но на этой версии не запускалось).
3. Анимации написаны на Molang (`query.anim_time`); смерть валит моба на спину поворотом вокруг `root`.
4. У пересобранных мобов удалены `_mer/_height/texture_set` (PBR-карты старых текстур не подходят новым).
5. Предупреждения валидатора про `cb:hydra_head/neck` — старые, из исходного аддона.
