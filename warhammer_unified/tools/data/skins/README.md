# Свои скины для людей

Положите сюда любой скин игрока 64×64 (классический или тонкий «Alex»), назвав файл именем моба, например
`royal_captain.png`, `royal_queen.png`, `skaal_villager.png`, `santa_claus.png`, и пересоберите аддон
(`python3 tools/build_all.py ...`). Скин будет использован как есть, без перекраски; тонкие руки определяются автоматически.

Имена мобов-людей: royal_captain, royal_knight, dark_plate_knight, elector_knight, garithos_paladin, heide_knight,
heide_hood_knight, high_elf_spearman, imperial_guard, paladin_swordsman, royal_queen, teutonic_cleric, chival_warrior,
bandit_raider, chaos_warrior, norse_berserker, norse_marauder, norse_shaman, skaal_villager, wulfrik_champion,
sabertooth_rider, santa_claus.

Если файла нет, скин генерируется: лицо, глаза, волосы и тон кожи берутся из ванильных Стива/Алекс и перекрашиваются
в палитру моба, одежда и доспехи дорисовываются в раскладке скина игрока. Готовые сгенерированные скины лежат в `previews/skins/`.
