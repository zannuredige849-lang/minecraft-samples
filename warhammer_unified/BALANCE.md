# Баланс (v10.8.6)

Игрок: 20 HP. Урон игрока: алмазный меч ≈12 в секунду, незеритовый с Остротой V ≈19. Урон по игроку в броне: железо ×0,4, алмаз ×0,2.
Ранги: обычные 20–46 HP / 2–7 урона, элита 50–180 / 5–9, боссы 140–400 / 7–12 (с полосой здоровья).
Скриптовые способности ограничены `scripts/fairness.js`: не больше 40 % здоровья игрока за удар босса (25 % — обычного моба), не больше 60 % за 3 секунды, без мгновенных смертей, вредные эффекты не дольше 5 с и не сильнее II, босс в бою лечится не больше 8 % за 10 с.
Сложность мира: лёгкая ×0,75 HP, тяжёлая ×1,35 HP (скрипты аддона).

| Существо | Ранг | Было (HP / урон) | Стало (HP / урон) | Убить алмазным мечом | Незеритовым V |
|---|---|---|---|---|---|
| `cb:cyclops` | boss | 560/None; cb:sighted: None/0; cb:blind_state: None/0 | 400/— | 33 с | 21 с |
| `cb:fel_lord` | boss | 580/14 | 400/12 | 33 с | 21 с |
| `warcraft:great_unclean_one` | boss | 300/7 | 320/10 | 27 с | 17 с |
| `cb:minotaur` | boss | 260/10 | 300/11 | 25 с | 16 с |
| `warcraft:abomination_lord` | boss | 140/6 | 280/10 | 23 с | 15 с |
| `cb:dreadlord` | boss | 220/10 | 280/10 | 23 с | 15 с |
| `warcraft:ember_colossus` | boss | 220/9 | 260/11 | 22 с | 14 с |
| `cb:cannibal_troll` | boss | 170/14 | 240/11 | 20 с | 13 с |
| `cb:guldan` | boss | 180/6 | 240/7 | 20 с | 13 с |
| `cb:hydra` | boss | 165/6 | 200/7 | 17 с | 11 с |
| `cb:circe` | boss | 70/0 | 140/— | 12 с | 7 с |
| `warcraft:big_ent` | elite | 160/8; ent_oak: 160/8; ent_birch: 135/7; ent_spruce: 190/9; ent_cherry: 145/7; ent_crimson: 185/10; ent_warped: 175/9 | 160/8; ent_oak: 160/8; ent_birch: 140/7; ent_spruce: 180/9; ent_cherry: 145/7; ent_crimson: 175/9; ent_warped: 170/9 | 13 с | 8 с |
| `warcraft:frost_golem` | elite | 120/7 | 120/8 | 10 с | 6 с |
| `cb:inferno_golem` | elite | 110/4 | 120/8 | 10 с | 6 с |
| `warcraft:lightning_golem` | elite | 120/7 | 120/8 | 10 с | 6 с |
| `warcraft:inferno_golem` | elite | 120/7 | 120/8 | 10 с | 6 с |
| `cb:ice_troll` | elite | 120/10 | 100/8 | 8 с | 5 с |
| `warcraft:faceless_general` | elite | 55/7 | 90/8 | 8 с | 5 с |
| `warcraft:ice_demon` | elite | 78/8 | 80/7 | 7 с | 4 с |
| `warcraft:hornet_demon` | elite | 65/6 | 60/6 | 5 с | 3 с |
| `cb:laestrygonian` | elite | 41/[6, 7] | 60/7 | 5 с | 3 с |
| `cb:wild_troll` | elite | 50/7 | 60/7 | 5 с | 3 с |
| `warcraft:pink_horror` | elite | 55/6 | 50/5 | 4 с | 3 с |
| `warcraft:faceless_berserker` | regular | 42/6 | 46/7 | 4 с | 2 с |
| `cb:tribal_troll` | regular | 25/5 | 45/6 | 4 с | 2 с |
| `warcraft:faceless_warrior` | regular | 35/5 | 40/5 | 3 с | 2 с |
| `cb:smart_troll` | regular | 22/4 | 40/5 | 3 с | 2 с |
| `cb:thunder_lizard` | regular | 30/4; cb:ridden: None/7 | 40/5; cb:ridden: —/7 | 3 с | 2 с |
| `warcraft:faceless_sorcerer` | regular | 40/5 | 36/4 | 3 с | 2 с |
| `warcraft:faceless_cultist` | regular | 38/5 | 32/4 | 3 с | 2 с |
| `cb:siren` | regular | 25/3 | 30/4 | 2 с | 2 с |
| `cb:hell_orc` | regular | 22/3; cb:leader: 37/5 | 28/5; cb:leader: 44/7 | 2 с | 1 с |
| `cb:green_orc` | regular | 22/3; cb:leader: 37/5 | 24/4; cb:leader: 40/6 | 2 с | 1 с |
| `cb:orc` | regular | 22/3; cb:leader: 37/5; cb:enslaved: 30/5 | 24/4; cb:leader: 40/6; cb:enslaved: 26/4 | 2 с | 1 с |
| `cb:warg` | regular | 20/4 | 24/4 | 2 с | 1 с |
| `cb:human_villager` | regular | 20/1; cb:role_villager: 20/1; cb:role_militia: 22/4; cb:role_swordsman: 26/6; cb:role_archer: 24/4; cb:role_crossbowman: 25/5; cb:role_spearman: 26/6; cb:role_captain: 28/7 | 20/2; cb:role_villager: 20/2; cb:role_militia: 22/4; cb:role_swordsman: 26/5; cb:role_archer: 22/3; cb:role_crossbowman: 24/3; cb:role_spearman: 26/5; cb:role_captain: 32/6 | 2 с | 1 с |
| `cb:fel_minion` | regular | 15/2 | 16/3 | 1 с | 1 с |
| `cb:goblin` | regular | 12/1; cb:Tamed: 20/None | 14/2; cb:Tamed: 22/— | 1 с | 1 с |
