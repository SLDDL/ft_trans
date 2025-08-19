# GitHub Pages Setup pour ft_transcendence Tracker

## 🚀 Configuration GitHub Pages

### Étape 1 : Activer GitHub Pages
1. Aller dans **Settings** de votre repo GitHub
2. Descendre jusqu'à **Pages** (dans le menu latéral)
3. Dans **Source**, sélectionner **Deploy from a branch**
4. Choisir **main** branch et **/ (root)**
5. Cliquer **Save**

### Étape 2 : Accès direct
Votre tracker sera accessible à :
```
https://votre-username.github.io/ft_trans/tracker.html
```

### Étape 3 : Mise à jour automatique
- Chaque fois que vous pushez sur GitHub
- Le tracker se met à jour automatiquement
- Accessible depuis n'importe où

## 📋 Option 2 : GitHub Issues Templates

### Créer des templates d'issues pour chaque module
```yaml
# .github/ISSUE_TEMPLATE/module-backend.yml
name: "📦 Module Backend"
description: "Tracker pour le module Framework Backend"
labels: ["module", "backend", "major"]
body:
  - type: checkboxes
    attributes:
      label: "Tâches Backend"
      options:
        - label: "Réécrire l'API en Fastify"
        - label: "Migrer la logique métier"
        - label: "Tests d'intégration"
```

## 🗂️ Option 3 : GitHub Projects

### Créer un Kanban board
1. Aller dans **Projects** du repo
2. Créer un **New project**
3. Choisir **Board view**
4. Colonnes : **To Do**, **In Progress**, **Done**
5. Ajouter des cartes pour chaque tâche

## 🔗 Intégration README

### Liens directs dans le README
```markdown
## 📊 Suivi du Projet

- [🎯 Tracker Interactif](https://votre-username.github.io/ft_trans/tracker.html)
- [📋 Issues Board](https://github.com/votre-username/ft_trans/issues)
- [🗂️ Kanban Project](https://github.com/votre-username/ft_trans/projects/1)
```
