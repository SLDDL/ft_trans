class PongGame {
    constructor() {
        this.canvas = document.getElementById('renderCanvas');
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        
        // Game state
        this.gameRunning = false;
        this.gameStarted = false;
        this.gamePaused = false;
        this.lastTime = 0;
        this.inMenu = true;
        this.betweenPoints = false;
        
        // Game mode
        this.gameMode = 'human-vs-human'; // 'human-vs-human' or 'human-vs-ai'
        this.aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'
        
        // Screen orientation and camera management
        this.camera = null;
        this.isPortrait = false;
        this.cameraDistance = 15
        this.gameAspectRatio = 16 / 10; // Game field aspect ratio
        
        // Camera angle presets
        this.currentCameraPreset = 0;
        this.cameraPresets = {
            'human-vs-human': [
                { name: 'Top-Down', position: { x: 0, y: 15, z: 0 }, target: { x: 0, y: 0, z: 0 }, rotation: { x: Math.PI / 2, y: 0, z: 0 } },
                { name: 'Angled', position: { x: 0, y: 12, z: -8 }, target: { x: 0, y: 0, z: 0 }, rotation: null },
                { name: 'Side View', position: { x: 0, y: 8, z: -12 }, target: { x: 0, y: 0, z: 0 }, rotation: null }
            ],
            'human-vs-ai': [
                { name: 'Top-Down', position: { x: 0, y: 15, z: 0 }, target: { x: 0, y: 0, z: 0 }, rotation: { x: Math.PI / 2, y: 0, z: 0 } },
                { name: 'Angled', position: { x: 0, y: 12, z: -8 }, target: { x: 0, y: 0, z: 0 }, rotation: null },
                { name: 'Side View', position: { x: 0, y: 8, z: -12 }, target: { x: 0, y: 0, z: 0 }, rotation: null },
                { name: 'Player View', position: { x: -6, y: 4, z: 0 }, target: { x: 0, y: 0, z: 0 }, rotation: null },
                { name: 'Ball Follow', position: { x: 0, y: 10, z: 5 }, target: { x: 0, y: 0, z: 0 }, rotation: null },
                { name: 'Corner View', position: { x: -8, y: 10, z: -6 }, target: { x: 0, y: 0, z: 0 }, rotation: null },
                { name: 'Dynamic', position: { x: 0, y: 8, z: 0 }, target: { x: 0, y: 0, z: 0 }, rotation: null }
            ]
        };
        
        // FPS tracking
        this.frameCount = 0;
        this.fpsLastTime = 0;
        this.currentFPS = 0;
        
        // Game objects
        this.ball = null;
        this.paddle1 = null;
        this.paddle2 = null;
        this.walls = [];
        this.table = null;
        
        // Game physics (units per second, not per frame)
        this.ballSpeed = 5.0;  // units per second
        this.paddleSpeed = 8.0;  // units per second
        this.ballVelocity = { x: 0, y: 0 };
        
        // Game dimensions (2D field)
        this.gameWidth = 16;
        this.gameHeight = 10;
        this.paddleWidth = 0.3;
        this.paddleHeight = 2;
        this.ballSize = 0.3;
        
        // Player controls
        this.keys = {};
        
        // Track paddle velocities for ball influence
        this.paddle1Velocity = 0;
        this.paddle2Velocity = 0;
        this.lastPaddle1Pos = 0;
        this.lastPaddle2Pos = 0;
        
        // Score
        this.score = { player1: 0, player2: 0 };
        
        // AI variables
        this.aiTarget = 0;
        this.aiReactionTime = 0;
        this.aiLastUpdate = 0;
        this.aiPredictedBallPos = 0;
        
        this.init();
        this.setupOrientationHandling();
    }
    
    setupOrientationHandling() {
        // Initial orientation setup
        this.updateOrientation();
        
        // Listen for orientation and resize changes
        window.addEventListener('resize', () => {
            this.updateOrientation();
            this.engine.resize();
        });
        
        // Listen for orientation change events (mobile)
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateOrientation();
                this.engine.resize();
            }, 100); // Small delay to ensure the viewport has updated
        });
    }
    
    updateOrientation() {
        const canvas = this.canvas;
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const screenAspectRatio = canvasWidth / canvasHeight;
        
        // Determine if we should treat this as portrait orientation
        // Portrait: when screen is taller than it is wide
        this.isPortrait = screenAspectRatio < 1;
        
        if (this.camera) {
            this.updateCamera();
            this.updateControlInstructions();
        }
    }
    
    updateControlInstructions() {
        const player1Controls = document.getElementById('player1-controls');
        const player2ControlKeys = document.getElementById('player2-control-keys');
        
        if (this.isPortrait) {
            player1Controls.textContent = 'Arrow Left/Right';
            player2ControlKeys.textContent = 'A/D keys';
        } else {
            player1Controls.textContent = 'Arrow Up/Down';
            player2ControlKeys.textContent = 'W/S keys';
        }
    }
    
    updateCamera() {
        const canvas = this.canvas;
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const screenAspectRatio = canvasWidth / canvasHeight;
        
        // Get current camera preset
        const presets = this.cameraPresets[this.gameMode];
        const preset = presets[this.currentCameraPreset];
        
        // Set camera to orthographic mode for consistent scaling
        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        
        const gameFieldWidth = this.gameWidth;
        const gameFieldHeight = this.gameHeight;
        
        // Apply camera position and rotation based on preset
        if (preset.name === 'Ball Follow' && this.ball) {
            // Dynamic ball following camera
            this.camera.position = new BABYLON.Vector3(
                this.ball.position.x * 0.3 + preset.position.x,
                preset.position.y,
                this.ball.position.z * 0.3 + preset.position.z
            );
        } else if (preset.name === 'Dynamic' && this.ball) {
            // Dynamic rotating camera
            const time = performance.now() * 0.001;
            const radius = 8;
            this.camera.position = new BABYLON.Vector3(
                Math.cos(time * 0.2) * radius,
                preset.position.y,
                Math.sin(time * 0.2) * radius
            );
        } else {
            this.camera.position = new BABYLON.Vector3(preset.position.x, preset.position.y, preset.position.z);
        }
        
        this.camera.setTarget(new BABYLON.Vector3(preset.target.x, preset.target.y, preset.target.z));
        
        if (preset.rotation) {
            this.camera.rotation.x = preset.rotation.x;
            this.camera.rotation.y = preset.rotation.y;
            this.camera.rotation.z = preset.rotation.z;
            if (this.isPortrait) {
                this.camera.rotation.z -= Math.PI / 2;
            }
        }
        
        // Calculate orthographic bounds based on camera distance and view
        let orthoSize;
        if (preset.name === 'Top-Down') {
            // Use the original top-down logic for orthographic view
            if (this.isPortrait) {
                const gameAspectRatio = gameFieldHeight / gameFieldWidth;
                if (screenAspectRatio > gameAspectRatio) {
                    const orthoHeight = gameFieldWidth / 2 * 1;
                    const orthoWidth = orthoHeight * screenAspectRatio;
                    this.camera.orthoTop = orthoHeight;
                    this.camera.orthoBottom = -orthoHeight;
                    this.camera.orthoLeft = -orthoWidth;
                    this.camera.orthoRight = orthoWidth;
                } else {
                    const orthoWidth = gameFieldHeight / 2 * 1;
                    const orthoHeight = orthoWidth / screenAspectRatio;
                    this.camera.orthoTop = orthoHeight;
                    this.camera.orthoBottom = -orthoHeight;
                    this.camera.orthoLeft = -orthoWidth;
                    this.camera.orthoRight = orthoWidth;
                }
            } else {
                const gameAspectRatio = gameFieldWidth / gameFieldHeight;
                if (screenAspectRatio > gameAspectRatio) {
                    const orthoHeight = gameFieldHeight / 2 * 1.1;
                    const orthoWidth = orthoHeight * screenAspectRatio;
                    this.camera.orthoTop = orthoHeight;
                    this.camera.orthoBottom = -orthoHeight;
                    this.camera.orthoLeft = -orthoWidth;
                    this.camera.orthoRight = orthoWidth;
                } else {
                    const orthoWidth = gameFieldWidth / 2 * 1.1;
                    const orthoHeight = orthoWidth / screenAspectRatio;
                    this.camera.orthoTop = orthoHeight;
                    this.camera.orthoBottom = -orthoHeight;
                    this.camera.orthoLeft = -orthoWidth;
                    this.camera.orthoRight = orthoWidth;
                }
            }
        } else {
            // For angled views, calculate orthographic bounds based on distance
            const distance = Math.sqrt(
                Math.pow(this.camera.position.x, 2) + 
                Math.pow(this.camera.position.y, 2) + 
                Math.pow(this.camera.position.z, 2)
            );
            orthoSize = Math.max(gameFieldWidth, gameFieldHeight) * (distance / 15) * 0.8;
            
            const orthoWidth = orthoSize * screenAspectRatio / 2;
            const orthoHeight = orthoSize / 2;
            
            this.camera.orthoTop = orthoHeight;
            this.camera.orthoBottom = -orthoHeight;
            this.camera.orthoLeft = -orthoWidth;
            this.camera.orthoRight = orthoWidth;
        }
    }
    
    init() {
        this.createScene();
        this.createGameObjects();
        this.setupControls();
        this.setupMenuControls();
        this.setupGameLoop();
        this.resetBall();
        this.updateUI();
        this.showMenu();
        
        // Start the render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }
    
    showMenu() {
        this.inMenu = true;
        this.gamePaused = false;
        this.gameRunning = false;
        this.gameStarted = false;
        this.resetMenuState();
        document.getElementById('game-mode-menu').style.display = 'block';
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('ui-overlay').style.display = 'none';
    }
    
    resetMenuState() {
        // Reset all menu sections to initial state
        document.getElementById('game-mode-selection').style.display = 'block';
        document.getElementById('ai-difficulty').style.display = 'none';
        document.getElementById('camera-selection').style.display = 'block';
        document.getElementById('start-game-section').style.display = 'none';
        this.populateCameraSelector();
    }
    
    populateCameraSelector() {
        const selector = document.getElementById('camera-selector');
        const pauseSelector = document.getElementById('pause-camera-selector');
        const presets = this.cameraPresets[this.gameMode];
        
        // Clear existing options
        selector.innerHTML = '';
        pauseSelector.innerHTML = '';
        
        presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = preset.name;
            if (index === this.currentCameraPreset) {
                option.selected = true;
            }
            selector.appendChild(option);
            
            const pauseOption = option.cloneNode(true);
            pauseSelector.appendChild(pauseOption);
        });
    }
    
    showPauseMenu() {
        this.gamePaused = true;
        this.gameRunning = false;
        this.populateCameraSelector(); // Update camera options for current game mode
        document.getElementById('pause-menu').style.display = 'block';
        document.getElementById('ui-overlay').style.display = 'none';
    }
    
    hidePauseMenu() {
        this.gamePaused = false;
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('ui-overlay').style.display = 'block';
    }
    
    hideMenu() {
        this.inMenu = false;
        document.getElementById('game-mode-menu').style.display = 'none';
        document.getElementById('ui-overlay').style.display = 'block';
        this.updateGameStatus('Press SPACE to start the game!');
        this.updateControlInstructions(); // Update controls when menu is hidden
        this.updateCamera();
        this.updateCameraUI();
    }
    
    setupMenuControls() {
        // Human vs AI button
        document.getElementById('human-vs-ai').addEventListener('click', () => {
            this.gameMode = 'human-vs-ai';
            document.getElementById('game-mode-selection').style.display = 'none';
            document.getElementById('ai-difficulty').style.display = 'block';
            document.getElementById('camera-selection').style.display = 'block';
            document.getElementById('player2-controls').style.display = 'none';
            this.populateCameraSelector();
        });
        
        // Human vs Human button
        document.getElementById('human-vs-human').addEventListener('click', () => {
            this.gameMode = 'human-vs-human';
            document.getElementById('game-mode-selection').style.display = 'none';
            document.getElementById('ai-difficulty').style.display = 'none';
            document.getElementById('camera-selection').style.display = 'block';
            document.getElementById('start-game-section').style.display = 'block';
            document.getElementById('player2-controls').style.display = 'block';
            this.populateCameraSelector();
            this.updateControlInstructions();
        });
        
        // Difficulty buttons
        document.querySelectorAll('[data-difficulty]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.aiDifficulty = btn.dataset.difficulty;
                document.getElementById('start-game-section').style.display = 'block';
            });
        });
        
        // Camera selector
        document.getElementById('camera-selector').addEventListener('change', (e) => {
            this.currentCameraPreset = parseInt(e.target.value);
            this.updateCamera();
            this.updateCameraUI();
        });
        
        // Pause menu camera selector
        document.getElementById('pause-camera-selector').addEventListener('change', (e) => {
            this.currentCameraPreset = parseInt(e.target.value);
            this.updateCamera();
            this.updateCameraUI();
        });
        
        // Start game button
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.hideMenu();
        });
        
        // Pause menu buttons
        document.getElementById('resume-game-btn').addEventListener('click', () => {
            this.hidePauseMenu();
            if (this.gameStarted) {
                this.gameRunning = true;
                this.updateGameStatus('');
            }
        });
        
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.hidePauseMenu();
            this.showMenu();
            this.resetGame();
        });
    }
    
    createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color3(0.02, 0.02, 0.08); // Dark space-like background
        
        // Create top-down camera (classic Pong view but in 3D)
        this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, this.cameraDistance, 0), this.scene);
        this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
        
        // Set up initial camera orientation
        this.updateOrientation();
        
        // Better lighting setup
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.6;
        light.diffuse = new BABYLON.Color3(0.8, 0.9, 1.0);
        
        // Add some rim lighting
        const rimLight = new BABYLON.DirectionalLight('rimLight', new BABYLON.Vector3(0, -1, 0), this.scene);
        rimLight.intensity = 0.3;
        rimLight.diffuse = new BABYLON.Color3(0.3, 0.6, 1.0);
    }
    
    createGameObjects() {
        // Create game field (cyberpunk style)
        this.table = BABYLON.MeshBuilder.CreateGround('field', { 
            width: this.gameWidth + 2, 
            height: this.gameHeight + 2 
        }, this.scene);
        const fieldMaterial = new BABYLON.StandardMaterial('fieldMaterial', this.scene);
        fieldMaterial.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.15);
        fieldMaterial.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.1);
        fieldMaterial.specularColor = new BABYLON.Color3(0.2, 0.3, 0.5);
        this.table.material = fieldMaterial;
        
        // Add field lines (center line and boundaries)
        const centerLine = BABYLON.MeshBuilder.CreateBox('centerLine', { 
            width: 0.1, 
            height: 0.01, 
            depth: this.gameHeight 
        }, this.scene);
        centerLine.position.y = 0.01;
        const centerLineMaterial = new BABYLON.StandardMaterial('centerLineMaterial', this.scene);
        centerLineMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.8, 1.0);
        centerLine.material = centerLineMaterial;
        
        // Create glowing ball
        this.ball = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: this.ballSize }, this.scene);
        this.ball.position.y = 0.3;
        const ballMaterial = new BABYLON.StandardMaterial('ballMaterial', this.scene);
        ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
        ballMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.9, 1.0);
        ballMaterial.specularColor = new BABYLON.Color3(1, 1, 1);
        this.ball.material = ballMaterial;
        
        // Add glow effect to ball
        const ballGlow = new BABYLON.GlowLayer('ballGlow', this.scene);
        ballGlow.addIncludedOnlyMesh(this.ball);
        ballGlow.intensity = 0.5;
        
        // Create cyberpunk paddles
        this.paddle1 = BABYLON.MeshBuilder.CreateBox('paddle1', { 
            width: this.paddleWidth, 
            height: 0.3, 
            depth: this.paddleHeight 
        }, this.scene);
        this.paddle1.position.x = -this.gameWidth / 2 + 0.5;
        this.paddle1.position.y = 0.15;
        
        this.paddle2 = BABYLON.MeshBuilder.CreateBox('paddle2', { 
            width: this.paddleWidth, 
            height: 0.3, 
            depth: this.paddleHeight 
        }, this.scene);
        this.paddle2.position.x = this.gameWidth / 2 - 0.5;
        this.paddle2.position.y = 0.15;
        
        // Glowing paddle materials
        const paddle1Material = new BABYLON.StandardMaterial('paddle1Material', this.scene);
        paddle1Material.diffuseColor = new BABYLON.Color3(0, 1, 0.3);
        paddle1Material.emissiveColor = new BABYLON.Color3(0, 0.5, 0.1);
        paddle1Material.specularColor = new BABYLON.Color3(0.5, 1, 0.5);
        this.paddle1.material = paddle1Material;
        
        const paddle2Material = new BABYLON.StandardMaterial('paddle2Material', this.scene);
        paddle2Material.diffuseColor = new BABYLON.Color3(1, 0.2, 0);
        paddle2Material.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0);
        paddle2Material.specularColor = new BABYLON.Color3(1, 0.5, 0.5);
        this.paddle2.material = paddle2Material;
        
        // Add glow to paddles
        ballGlow.addIncludedOnlyMesh(this.paddle1);
        ballGlow.addIncludedOnlyMesh(this.paddle2);
        
        // Create neon walls
        const wallMaterial = new BABYLON.StandardMaterial('wallMaterial', this.scene);
        wallMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.2, 1.0);
        wallMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0.5);
        wallMaterial.specularColor = new BABYLON.Color3(1, 0.5, 1);
        
        const topWall = BABYLON.MeshBuilder.CreateBox('topWall', { 
            width: this.gameWidth + 2, 
            height: 0.4, 
            depth: 0.2 
        }, this.scene);
        topWall.position.z = this.gameHeight / 2 + 0.1;
        topWall.position.y = 0.2;
        topWall.material = wallMaterial;
        this.walls.push(topWall);
        
        const bottomWall = BABYLON.MeshBuilder.CreateBox('bottomWall', { 
            width: this.gameWidth + 2, 
            height: 0.4, 
            depth: 0.2 
        }, this.scene);
        bottomWall.position.z = -this.gameHeight / 2 - 0.1;
        bottomWall.position.y = 0.2;
        bottomWall.material = wallMaterial;
        this.walls.push(bottomWall);
        
        // Add glow to walls
        ballGlow.addIncludedOnlyMesh(topWall);
        ballGlow.addIncludedOnlyMesh(bottomWall);
    }
    
    setupControls() {
        // Keyboard event listeners
        window.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            if (event.code === 'Space' && !this.inMenu && !this.gamePaused) {
                event.preventDefault();
                this.toggleGame();
            }
            
            if (event.code === 'Escape') {
                event.preventDefault();
                if (this.inMenu) {
                    // If in menu, do nothing or maybe exit fullscreen
                    return;
                } else if (this.gamePaused) {
                    // If paused, resume game
                    this.hidePauseMenu();
                    if (this.gameStarted) {
                        this.gameRunning = true;
                        this.updateGameStatus('');
                    }
                } else {
                    // If in game, pause
                    this.showPauseMenu();
                }
            }
        });
        
        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
    }
    
    cycleCameraAngle() {
        // Only allow camera changes in menu, pause, or between points
        if (!this.inMenu && !this.gamePaused && !this.betweenPoints) {
            return;
        }
        
        const presets = this.cameraPresets[this.gameMode];
        this.currentCameraPreset = (this.currentCameraPreset + 1) % presets.length;
        this.updateCamera();
        this.updateCameraUI();
        
        // Update selectors if they exist
        const selector = document.getElementById('camera-selector');
        const pauseSelector = document.getElementById('pause-camera-selector');
        if (selector) selector.value = this.currentCameraPreset;
        if (pauseSelector) pauseSelector.value = this.currentCameraPreset;
    }
    
    updateCameraUI() {
        const presets = this.cameraPresets[this.gameMode];
        const currentPreset = presets[this.currentCameraPreset];
        document.getElementById('camera-mode-text').textContent = currentPreset.name;
    }
    
    setupGameLoop() {
        this.scene.registerBeforeRender(() => {
            const currentTime = performance.now();
            const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0; // Convert to seconds
            this.lastTime = currentTime;
            
            // Calculate FPS
            this.frameCount++;
            if (currentTime - this.fpsLastTime >= 1000) { // Update FPS every second
                this.currentFPS = Math.round(this.frameCount * 1000 / (currentTime - this.fpsLastTime));
                this.frameCount = 0;
                this.fpsLastTime = currentTime;
                this.updateFPSDisplay();
            }
            
            if (this.gameRunning && deltaTime < 0.1) { // Cap delta time to prevent large jumps
                this.updatePaddles(deltaTime);
                this.updateBall(deltaTime);
                this.checkCollisions();
                this.updateDynamicCamera();
            }
        });
    }
    
    updatePaddles(deltaTime) {
        const paddleMovement = this.paddleSpeed * deltaTime;
        
        // Store previous positions to calculate velocity
        this.lastPaddle1Pos = this.paddle1.position.z;
        this.lastPaddle2Pos = this.paddle2.position.z;
        
        if (this.isPortrait) {
            // Portrait mode: camera is rotated 90 degrees
            // Player 1 is at the top of the screen (negative X in world space)
            // Player 2 is at the bottom of the screen (positive X in world space)
            
            // Player 1 controls (A/D keys) - now controls top paddle
            if (this.keys['KeyD'] && this.paddle1.position.z > -this.gameHeight / 2 + this.paddleHeight / 2) {
                this.paddle1.position.z -= paddleMovement;
            }
            if (this.keys['KeyA'] && this.paddle1.position.z < this.gameHeight / 2 - this.paddleHeight / 2) {
                this.paddle1.position.z += paddleMovement;
            }
            
            // Player 2 controls or AI - now controls bottom paddle
            if (this.gameMode === 'human-vs-human') {
                if (this.keys['ArrowRight'] && this.paddle2.position.z > -this.gameHeight / 2 + this.paddleHeight / 2) {
                    this.paddle2.position.z -= paddleMovement;
                }
                if (this.keys['ArrowLeft'] && this.paddle2.position.z < this.gameHeight / 2 - this.paddleHeight / 2) {
                    this.paddle2.position.z += paddleMovement;
                }
            } else if (this.gameMode === 'human-vs-ai') {
                this.updateAI(deltaTime);
            }
        } else {
            // Landscape mode: standard controls
            // Player 1 controls (W/S keys)
            if (this.keys['KeyS'] && this.paddle1.position.z > -this.gameHeight / 2 + this.paddleHeight / 2) {
                this.paddle1.position.z -= paddleMovement; // W moves up (negative Z)
            }
            if (this.keys['KeyW'] && this.paddle1.position.z < this.gameHeight / 2 - this.paddleHeight / 2) {
                this.paddle1.position.z += paddleMovement; // S moves down (positive Z)
            }
            
            // Player 2 controls or AI
            if (this.gameMode === 'human-vs-human') {
                // Human Player 2 controls (Arrow keys)
                if (this.keys['ArrowDown'] && this.paddle2.position.z > -this.gameHeight / 2 + this.paddleHeight / 2) {
                    this.paddle2.position.z -= paddleMovement; // Arrow Up moves up (negative Z)
                }
                if (this.keys['ArrowUp'] && this.paddle2.position.z < this.gameHeight / 2 - this.paddleHeight / 2) {
                    this.paddle2.position.z += paddleMovement; // Arrow Down moves down (positive Z)
                }
            } else if (this.gameMode === 'human-vs-ai') {
                this.updateAI(deltaTime);
            }
        }
        
        // Calculate paddle velocities
        this.paddle1Velocity = (this.paddle1.position.z - this.lastPaddle1Pos) / deltaTime;
        this.paddle2Velocity = (this.paddle2.position.z - this.lastPaddle2Pos) / deltaTime;
    }
    
    updateAI(deltaTime) {
        const currentTime = performance.now();
        
        // AI difficulty settings
        let reactionTime, speed, accuracy, prediction;
        switch (this.aiDifficulty) {
            case 'easy':
                reactionTime = 300; // 300ms reaction time
                speed = 0.6; // 60% of max speed
                accuracy = 0.7; // 70% accuracy
                prediction = 0.2; // 20% prediction
                break;
            case 'medium':
                reactionTime = 150; // 150ms reaction time
                speed = 0.8; // 80% of max speed
                accuracy = 0.85; // 85% accuracy
                prediction = 0.5; // 50% prediction
                break;
            case 'hard':
                reactionTime = 50; // 50ms reaction time
                speed = 1.0; // 100% of max speed
                accuracy = 0.95; // 95% accuracy
                prediction = 0.8; // 80% prediction
                break;
        }
        
        // Update AI target less frequently based on reaction time
        if (currentTime - this.aiLastUpdate > reactionTime) {
            this.aiLastUpdate = currentTime;
            
            // Predict where the ball will be when it reaches the paddle
            let targetZ = this.ball.position.z;
            
            if (prediction > 0 && this.ballVelocity.x > 0) { // Ball moving toward AI paddle
                const timeToReachPaddle = Math.abs((this.paddle2.position.x - this.ball.position.x) / this.ballVelocity.x);
                const predictedZ = this.ball.position.z + (this.ballVelocity.y * timeToReachPaddle * prediction);
                
                // Clamp prediction to game boundaries
                targetZ = Math.max(-this.gameHeight / 2, Math.min(this.gameHeight / 2, predictedZ));
            }
            
            // Add some inaccuracy to make AI beatable
            const inaccuracy = (1 - accuracy) * 2; // Range from 0 to 0.6 for easy mode
            targetZ += (Math.random() - 0.5) * inaccuracy * this.paddleHeight;
            
            this.aiTarget = targetZ;
        }
        
        // Move AI paddle toward target
        const paddleMovement = this.paddleSpeed * speed * deltaTime;
        const currentPos = this.paddle2.position.z;
        const diff = this.aiTarget - currentPos;
        
        if (Math.abs(diff) > 0.1) { // Dead zone to prevent jittery movement
            if (diff > 0 && this.paddle2.position.z < this.gameHeight / 2 - this.paddleHeight / 2) {
                this.paddle2.position.z += Math.min(paddleMovement, diff);
            } else if (diff < 0 && this.paddle2.position.z > -this.gameHeight / 2 + this.paddleHeight / 2) {
                this.paddle2.position.z += Math.max(-paddleMovement, diff);
            }
        }
    }
    
    updateBall(deltaTime) {
        this.ball.position.x += this.ballVelocity.x * deltaTime;
        this.ball.position.z += this.ballVelocity.y * deltaTime; // Y velocity moves Z position (top-down)
    }
    
    updateDynamicCamera() {
        const presets = this.cameraPresets[this.gameMode];
        const preset = presets[this.currentCameraPreset];
        
        if (preset.name === 'Ball Follow' && this.ball) {
            // Smooth ball following camera
            this.camera.position.x = this.ball.position.x * 0.3 + preset.position.x;
            this.camera.position.z = this.ball.position.z * 0.3 + preset.position.z;
        } else if (preset.name === 'Dynamic' && this.ball) {
            // Dynamic rotating camera around the field
            const time = performance.now() * 0.001;
            const radius = 8;
            this.camera.position.x = Math.cos(time * 0.2) * radius;
            this.camera.position.z = Math.sin(time * 0.2) * radius;
            this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
        }
    }
    
    checkCollisions() {
        const ballPos = this.ball.position;
        const ballRadius = this.ballSize / 2;
        
        // Wall collisions (top and bottom walls in Z direction)
        if (ballPos.z + ballRadius >= this.gameHeight / 2) {
            this.ballVelocity.y *= -1;
            this.ball.position.z = this.gameHeight / 2 - ballRadius;
        }
        if (ballPos.z - ballRadius <= -this.gameHeight / 2) {
            this.ballVelocity.y *= -1;
            this.ball.position.z = -this.gameHeight / 2 + ballRadius;
        }
        
        // Paddle collisions
        // Paddle 1 (left)
        if (ballPos.x - ballRadius <= this.paddle1.position.x + this.paddleWidth / 2 &&
            ballPos.x - ballRadius >= this.paddle1.position.x - this.paddleWidth / 2 &&
            ballPos.z <= this.paddle1.position.z + this.paddleHeight / 2 &&
            ballPos.z >= this.paddle1.position.z - this.paddleHeight / 2 &&
            this.ballVelocity.x < 0) {
            
            this.ballVelocity.x *= -1;
            this.ball.position.x = this.paddle1.position.x + this.paddleWidth / 2 + ballRadius;
            
            // Add variation based on where ball hits paddle
            const hitPosition = (ballPos.z - this.paddle1.position.z) / (this.paddleHeight / 2);
            this.ballVelocity.y += hitPosition * 3;
            
            // Add paddle movement influence
            const paddleInfluence = this.paddle1Velocity * 0.8;
            this.ballVelocity.y += paddleInfluence;
            
            // Slightly increase ball speed on each hit
            this.ballVelocity.x *= 1.05;
            this.ballVelocity.y *= 1.02;
        }
        
        // Paddle 2 (right)
        if (ballPos.x + ballRadius >= this.paddle2.position.x - this.paddleWidth / 2 &&
            ballPos.x + ballRadius <= this.paddle2.position.x + this.paddleWidth / 2 &&
            ballPos.z <= this.paddle2.position.z + this.paddleHeight / 2 &&
            ballPos.z >= this.paddle2.position.z - this.paddleHeight / 2 &&
            this.ballVelocity.x > 0) {
            
            this.ballVelocity.x *= -1;
            this.ball.position.x = this.paddle2.position.x - this.paddleWidth / 2 - ballRadius;
            
            // Add variation based on where ball hits paddle
            const hitPosition = (ballPos.z - this.paddle2.position.z) / (this.paddleHeight / 2);
            this.ballVelocity.y += hitPosition * 3;
            
            // Add paddle movement influence
            const paddleInfluence = this.paddle2Velocity * 0.8;
            this.ballVelocity.y += paddleInfluence;
            
            // Slightly increase ball speed on each hit
            this.ballVelocity.x *= 1.05;
            this.ballVelocity.y *= 1.02;
        }
        
        // Score detection
        if (ballPos.x < -this.gameWidth / 2 - 1) {
            this.score.player2++;
            this.resetBall();
            this.updateUI();
        } else if (ballPos.x > this.gameWidth / 2 + 1) {
            this.score.player1++;
            this.resetBall();
            this.updateUI();
        }
        
        // Limit ball velocity
        const maxSpeed = 10.0;
        if (Math.abs(this.ballVelocity.x) > maxSpeed) {
            this.ballVelocity.x = Math.sign(this.ballVelocity.x) * maxSpeed;
        }
        if (Math.abs(this.ballVelocity.y) > maxSpeed) {
            this.ballVelocity.y = Math.sign(this.ballVelocity.y) * maxSpeed;
        }
    }
    
    resetBall() {
        this.ball.position.x = 0;
        this.ball.position.y = 0.3;
        this.ball.position.z = 0;
        
        // Reset paddle velocities
        this.paddle1Velocity = 0;
        this.paddle2Velocity = 0;
        this.lastPaddle1Pos = this.paddle1.position.z;
        this.lastPaddle2Pos = this.paddle2.position.z;
        
        // Random direction
        const angle = (Math.random() - 0.5) * Math.PI / 3; // ±30 degrees
        const direction = Math.random() < 0.5 ? 1 : -1;
        
        this.ballVelocity.x = Math.cos(angle) * this.ballSpeed * direction;
        this.ballVelocity.y = Math.sin(angle) * this.ballSpeed;
        
        // Pause briefly after scoring
        if (this.gameStarted) {
            this.betweenPoints = true;
            this.gameRunning = false;
            setTimeout(() => {
                if (this.gameStarted && !this.inMenu && !this.gamePaused) {
                    this.betweenPoints = false;
                    this.gameRunning = true;
                    this.updateGameStatus('');
                }
            }, 1000);
            this.updateGameStatus('Goal! Next point in 1 second...');
        }
    }
    
    resetGame() {
        this.gameStarted = false;
        this.gameRunning = false;
        this.gamePaused = false;
        this.betweenPoints = false;
        this.score = { player1: 0, player2: 0 };
        this.paddle1.position.z = 0;
        this.paddle2.position.z = 0;
        this.resetBall();
        this.updateUI();
    }
    
    toggleGame() {
        if (!this.gameStarted) {
            this.gameStarted = true;
            this.gameRunning = true;
            this.gamePaused = false;
            this.betweenPoints = false;
            this.updateGameStatus('');
        } else {
            this.gameRunning = !this.gameRunning;
            this.gamePaused = !this.gameRunning;
            if (this.gamePaused) {
                this.showPauseMenu();
            } else {
                this.hidePauseMenu();
                this.updateGameStatus('');
            }
        }
    }
    
    updateUI() {
        document.getElementById('player1-score').textContent = this.score.player1;
        document.getElementById('player2-score').textContent = this.score.player2;
    }
    
    updateGameStatus(message) {
        const statusElement = document.getElementById('game-status');
        statusElement.textContent = message;
        statusElement.style.display = message ? 'block' : 'none';
    }
    
    updateFPSDisplay() {
        // Update or create FPS display
        let fpsElement = document.getElementById('fps-counter');
        if (!fpsElement) {
            fpsElement = document.createElement('div');
            fpsElement.id = 'fps-counter';
            fpsElement.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                color: #00ff00;
                font-family: monospace;
                font-size: 14px;
                background: rgba(0, 0, 0, 0.7);
                padding: 5px 10px;
                border-radius: 4px;
                pointer-events: none;
                z-index: 1000;
            `;
            document.getElementById('ui-overlay').appendChild(fpsElement);
        }
        fpsElement.textContent = `FPS: ${this.currentFPS}`;
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new PongGame();
});
