# MIDI Controller — clavier + knobs assignables

Surface de contrôle MIDI pour SvelteKit. **N'émet que du MIDI** vers l'extension
Web MIDI Tab Router : un clavier jouable (souris + clavier d'ordinateur) et 8 knobs
assignables à n'importe quel Control Change. Conçue pour piloter le synthé
**FM Tab Router** depuis un autre onglet.

## Installation

```bash
npx sv create midi-controller          # « SvelteKit minimal »
cd midi-controller
# copier les fichiers fournis dans src/ :
#   src/lib/midi.js
#   src/lib/router.js
#   src/lib/Knob.svelte
#   src/routes/+page.js
#   src/routes/+page.svelte
npm install
npm run dev -- --port 5174 --open      # port différent de celui du synthé
```

> Pas de dépendance externe (ni Tone.js) : ce n'est qu'un émetteur MIDI.

## ⚠️ Même contrat que le synthé

`src/lib/router.js` doit utiliser **exactement le même** `IN_TYPE` que le synthé
(seulement utile ici pour le MIDI-learn). Le sens sortant `MIDI_OUT_TO_EXTENSION`
est celui documenté par l'extension.

## Utilisation

- **Jouer** : clique les touches, ou utilise le clavier — `A W S E D F T G Y H U J`
  = une octave (blanches + noires). `←` / `→` changent d'octave. Chaque note envoie
  Note On / Note Off sur le canal choisi, avec la vélocité réglée en bas.
- **Pitch bend** : le curseur vertical à gauche ; il revient au centre au relâchement.
- **Knobs** : glisse verticalement (ou molette / flèches). Chaque mouvement envoie
  un Control Change. Les 8 knobs sont pré-assignés aux paramètres du synthé.
- **Panic** : coupe toutes les notes en cours (Note Off + CC 123).

### Assigner un knob à un CC

Deux méthodes :

1. **Manuel** — édite le numéro sous le knob (champ « CC »).
2. **MIDI-learn** — clique le bouton **L** d'un knob (il clignote en rouge), puis
   envoie un CC depuis une source externe relayée par l'extension : le knob adopte
   ce numéro de CC. Reclique **L** pour annuler.

Le libellé de chaque knob est éditable (clique dessus). Les assignations sont
sauvegardées dans le `localStorage` du navigateur ; « Réinitialiser » restaure les
valeurs par défaut.

### Correspondance par défaut (= CC_MAP du synthé)

| Knob         | CC | Paramètre du synthé |
|--------------|----|---------------------|
| Volume       | 7  | Volume              |
| Harmonicity  | 74 | Harmonicity         |
| FM Index     | 71 | Modulation index    |
| Attack       | 73 | Enveloppe – attack  |
| Decay        | 75 | Enveloppe – decay   |
| Release      | 72 | Enveloppe – release |
| Reverb       | 91 | Reverb (wet)        |
| Mod Wheel    | 1  | Modulation index    |

## Test bout-à-bout

1. Onglet A : le synthé **FM Tab Router** (`npm run dev`, port 5173), clique
   « Démarrer l'audio ».
2. Onglet B : ce contrôleur (`--port 5174`).
3. L'extension Web MIDI Tab Router doit être active sur les deux onglets.
4. Joue / tourne les knobs dans l'onglet B → le synthé de l'onglet A réagit.

Astuce : « Tout envoyer » pousse d'un coup l'état de tous les knobs vers le synthé
(utile juste après avoir démarré l'audio pour synchroniser les paramètres).