<!-- ...existing code... -->

# ft_transcendence - Plan de Développement Détaillé

<div align="center">
  <img src="https://i.pinimg.com/1200x/3b/b5/08/3bb508777a4ea6cee1ad000178050f63.jpg" alt="ft_transcendence" width="800" height="400" />
</div>

## 📋 Vue d'ensemble du projet

**Objectif :** Créer un site web pour jouer au Pong en multijoueur avec des fonctionnalités avancées.

**Score requis :** 25% (partie obligatoire) + 75% (7 modules majeurs minimum)

---

## 🏗️ PHASE 1 : PARTIE OBLIGATOIRE (25% du projet)

### Étape 1.1 : Configuration de l'environnement de développement
- [ ] **Docker Setup**
  - Créer un `Dockerfile` 
  - Créer un `docker-compose.yml`
  - Configurer l'environnement pour lancement avec une seule commande
  - Tester le déploiement sur `/goinfre` ou `/sgoinfre`

### Étape 1.2 : Structure de base du projet
- [ ] **Frontend (TypeScript obligatoire)**
  - Initialiser le projet TypeScript
  - Configurer le bundler (webpack/vite)
  - Créer la structure de fichiers
  - Implémenter la Single Page Application (SPA)
  - Gérer le routing (Back/Forward browser)

- [ ] **Backend (PHP pur OU module Framework)**
  - Si PHP : configurer l'environnement PHP
  - Si module : planifier Fastify + Node.js
  - Configurer la base de données (si nécessaire)

### Étape 1.3 : Sécurité de base
- [ ] **Implémentation sécurité**
  - Hashage des mots de passe (bcrypt/argon2)
  - Protection XSS
  - Protection SQL injection
  - Configuration HTTPS/WSS
  - Validation des formulaires
  - Gestion des variables d'environnement (.env)

### Étape 1.4 : Jeu Pong de base
- [ ] **Game Engine**
  - Logique du jeu Pong (canvas/WebGL)
  - Contrôles clavier pour 2 joueurs locaux
  - Physique de la balle et des paddles
  - Système de score
  - Détection de collision

- [ ] **Système de tournoi**
  - Interface d'inscription des joueurs
  - Système de matchmaking
  - Affichage des matches
  - Gestion des alias
  - Notification des prochains matches

### Étape 1.5 : Tests et validation
- [ ] **Compatibilité**
  - Test sur Firefox (dernière version stable)
  - Test responsive design
  - Vérification absence d'erreurs console
  - Test du système de tournoi

---

## 🚀 PHASE 2 : MODULES (75% du projet)

### Stratégie recommandée : 7 modules majeurs

#### Module 1 : Web - Framework Backend (Major)
- [ ] **Migration vers Fastify + Node.js**
  - Réécrire l'API en Fastify
  - Migrer la logique métier
  - Tests d'intégration

#### Module 2 : User Management - Gestion utilisateurs standard (Major)
- [ ] **Système d'authentification complet**
  - Inscription/Connexion sécurisée
  - Profils utilisateurs avec avatars
  - Système d'amis
  - Historique des matches
  - Statistiques utilisateur

#### Module 3 : Gameplay - Remote Players (Major)
- [ ] **Multijoueur en ligne**
  - WebSockets pour communication temps réel
  - Gestion des déconnexions
  - Synchronisation des états de jeu
  - Gestion du lag réseau

#### Module 4 : AI-Algo - Intelligence Artificielle (Major)
- [ ] **Opposant IA**
  - Algorithme IA (pas A*)
  - Simulation d'input clavier
  - Limitation à 1 refresh/seconde
  - IA capable de gagner occasionnellement

#### Module 5 : Cybersecurity - 2FA + JWT (Major)
- [ ] **Authentification renforcée**
  - Implémentation JWT
  - Two-Factor Authentication
  - Gestion des sessions sécurisées
  - Validation des tokens

#### Module 6 : Gameplay - Live Chat (Major)
- [ ] **Système de chat en temps réel**
  - Messages directs entre utilisateurs
  - Système de blocage
  - Invitations aux parties via chat
  - Notifications de tournoi
  - Accès aux profils via chat

#### Module 7 : Graphics - Techniques 3D avancées (Major)
- [ ] **Migration vers Babylon.js**
  - Réécrire le jeu en 3D
  - Effets visuels avancés
  - Interface 3D immersive

### Modules mineurs recommandés (2 mineurs = 1 majeur)
- [ ] **Database (Minor)** : SQLite
- [ ] **Frontend Framework (Minor)** : Tailwind CSS
- [ ] **Game Customization (Minor)** : Power-ups, maps
- [ ] **User Stats Dashboard (Minor)** : Tableaux de bord

---

## 📅 PLANNING DE DÉVELOPPEMENT

### Semaine 1-2 : Fondations
- Configuration Docker
- Structure de base
- Pong basique fonctionnel

### Semaine 3-4 : Sécurité et Backend
- Implémentation sécurité
- Backend Fastify
- Base de données

### Semaine 5-6 : Fonctionnalités utilisateur
- Système d'authentification
- Gestion des profils
- Tournois avancés

### Semaine 7-8 : Multijoueur et IA
- Remote players
- Intelligence artificielle
- Chat en temps réel

### Semaine 9-10 : Sécurité avancée et 3D
- 2FA + JWT
- Migration Babylon.js
- Tests finaux

### Semaine 11-12 : Finitions et tests
- Debug et optimisation
- Documentation
- Tests de charge

---

## 🔧 OUTILS ET TECHNOLOGIES

### Obligatoires
- **Frontend :** TypeScript
- **Backend :** Fastify + Node.js (avec module)
- **Base de données :** SQLite (avec module)
- **Conteneurisation :** Docker
- **3D :** Babylon.js (avec module)

### Recommandées
- **Styling :** Tailwind CSS
- **Authentification :** JWT + 2FA
- **Communication :** WebSockets
- **Tests :** Jest/Mocha

---

## ⚠️ POINTS D'ATTENTION

### Contraintes importantes
- Aucune bibliothèque qui résout un module entier
- Justification de chaque outil utilisé
- Variables sensibles dans .env (gitignored)
- Compatibilité Firefox obligatoire
- Sécurité maximum (HTTPS, validation, hashage)

### Risques et solutions
- **Surestimation :** Commencer simple, ajouter la complexité
- **Modules conflictuels :** Lire tout le sujet avant de choisir
- **Gestion du temps :** Prioriser la partie obligatoire
- **Déploiement :** Tester Docker régulièrement

---

## 📊 SUIVI DU PROJET

### 🎯 Tracker Interactif GitHub
> **Accès direct :** [https://slddl.github.io/ft_trans/tracker.html](https://slddl.github.io/ft_trans/tracker.html)

### 📋 GitHub Issues Board
> **Suivi par module :** [Issues ft_transcendence](https://github.com/SLDDL/ft_trans/issues)

### Partie obligatoire (25%)
- [ ] [🐳 Docker fonctionnel](https://github.com/SLDDL/ft_trans/issues/new?template=01-docker-obligatoire.yml)
- [ ] Frontend TypeScript + SPA
- [ ] Backend sécurisé
- [ ] Pong + Tournoi
- [ ] Sécurité de base

### Modules choisis (75%)
1. [ ] [⚡ Framework Backend](https://github.com/SLDDL/ft_trans/issues/new?template=02-module-backend.yml) (Major)
2. [ ] User Management (Major) 
3. [ ] Remote Players (Major)
4. [ ] AI Opponent (Major)
5. [ ] 2FA + JWT (Major)
6. [ ] Live Chat (Major)
7. [ ] 3D Graphics (Major)

**Total modules :** 7 majeurs = 70 points + 25 (obligatoire) = 95 points minimum

### 🔗 Liens Rapides
- 🎯 **Tracker Temps Réel :** [slddl.github.io/ft_trans/tracker.html](https://slddl.github.io/ft_trans/tracker.html)
- 📋 **Issues Board :** [GitHub Issues](https://github.com/SLDDL/ft_trans/issues)
- 📚 **Documentation :** [Guide d'utilisation](docs/GUIDE_UTILISATION_TRACKER.md)
- 🚀 **Intégration GitHub :** [Setup Guide](docs/GITHUB_INTEGRATION.md)

---

## 🎯 OBJECTIFS DE QUALITÉ

- Code propre et documenté
- Architecture scalable
- Tests unitaires et d'intégration
- Performance optimisée
- Sécurité maximale
- UX/UI soignée

---

Sex:

https://excalidraw.com/#json=UYf921ZtQe0EnRLdlzqEK,PUYOmtJcbRUHD5oNrCTTrQ

https://docs.google.com/spreadsheets/d/1_MjZZlSDL-Tgfgd1fPitdcxD3B8aWhUEiTtR4K5x6do/

*Dernière mise à jour : Août 2025*

<!-- ...existing code... -->