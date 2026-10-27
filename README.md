# Hot Water Tank Card (FR)

Carte Home Assistant pour **ballon d'eau chaude (ECS)** : ballon animé avec charge thermique et températures haut/moyenne/bas, autonomie en douches, énergie stockée, performance du dernier cycle (COP), routeur solaire et commandes. Style verre, thème clair/sombre automatique, éditeur visuel, textes en français.

## Installation (HACS)
HACS → ⋮ → Dépôts personnalisés → URL de ce dépôt, catégorie **Tableau de bord** → installer → recharger la page.

## Configuration
Tout se règle dans l'éditeur visuel (sections Ballon, Dernier cycle, Routeur solaire, Pilotage). Toutes les entités sont facultatives : une section sans entité n'est pas affichée. Exemple :

```yaml
type: custom:hot-water-card
title: Ballon ECS
charge_entity: sensor.charge_thermique_ballon_ecs
energy_entity: sensor.energie_stockee_ballon_ecs
max_energy: 9.3
top_entity: sensor.esp_routeur_esp_routeur_temp_haut_ecs
avg_entity: sensor.temperature_moyenne_ballon_ecs
bottom_entity: sensor.esp_routeur_esp_routeur_temp_bas_ecs
autonomy_entity: sensor.autonomie_ballon_ecs
volume_entity: sensor.volume_ecs_disponible_a_40degc
cop_entity: input_number.cop_dernier_cycle
thermal_entity: input_number.energie_thermique_dernier_cycle
electric_entity: input_number.energie_electrique_dernier_cycle
duration_entity: input_number.ecs_duree_dernier_cycle
router_entity: sensor.esp_routeur_esp_routeur_sortie_triac
grid_entity: sensor.esp_routeur_esp_routeur_pu_reseau
pv_entity: sensor.esp_tableau_production_solaire_puissance
hp_entity: sensor.esp_tableau_pac_chauffe_eau_puissance
resistor_entity: sensor.esp_routeur_esp_routeur_p_ecs_jsymk
toggles:
  - { entity: switch.dingtian_relay57239_switch4, name: Chauffe-Eau }
  - { entity: switch.esp_routeur_esp_routeur_mode_auto, name: Mode Auto }
```

| Option | Description |
|---|---|
| `charge_entity` | Charge thermique en % (niveau du ballon) ; couleur verte / orange / rouge selon `charge_warn` (75) et `charge_alert` (40) |
| `energy_entity`, `max_energy` | Énergie stockée ; `max_energy` est une référence (100 %) pour la barre. Au-delà (surcharge solaire), la barre reste pleine, passe en jaune et indique l'excédent |
| `top_entity`, `avg_entity`, `bottom_entity` | Températures affichées à côté du ballon |
| `autonomy_entity`, `volume_entity` | Autonomie (douches) et volume d'eau à 40 °C |
| `cop_entity`… `duration_entity` | Dernier cycle ; COP coloré selon `cop_good` (3,5) et `cop_ok` (2,5) |
| `router_entity` + puissances | Routeur solaire : utilisation en % et tuiles Réseau / PV / PAC / Résistance |
| `resistor_threshold` (0) | Quand `router_entity` (triac) dépasse ce % : une résistance lumineuse apparaît dans le ballon |
| `hp_threshold` (10) | Quand `hp_entity` dépasse cette puissance (W) : le groupe extérieur de la PAC apparaît, ventilateur animé |
| `toggles[]` | Commandes : un appui bascule, un appui long ouvre les détails |

Les graphiques d'historique restent à ajouter avec la carte native `history-graph`. Licence MIT.
