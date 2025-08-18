class PongGame {
    constructor() {
        this.canvas = document.getElementById('renderCanvas');
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        
        // Game state
        this.gameRunning = false;
        this.gameStarted = false;
        
        // Game objects
        this.ball = null;
        this.paddle1 = null;
        this.paddle2 = null;
        this.walls = [];
        
        // Game physics
        this.ballSpeed = 0.3;
        this.paddleSpeed = 0.5;
        this.ballVelocity = { x: 0, y: 0 };
        
        // Game dimensions (normalized to scene)
        this.gameWidth = 20;
        this.gameHeight = 12;
        this.paddleWidth = 0.5;
        this.paddleHeight = 3;
        this.ballSize = 0.3;
        
        // Player controls
        this.keys = {};
        
        // Score
        this.score = { player1: 0, player2: 0 };
        
        this.init();
    }
    
    init() {
        this.createScene();
        this.createGameObjects();
        this.setupControls();
        this.setupGameLoop();
        this.resetBall();
        this.updateUI();
        
        // Start the render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }
    
    createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.2);
        
        // Create camera
        const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, -15), this.scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        
        // Create light
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.8;
    }
    
    createGameObjects() {
        // Create ball
        this.ball = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: this.ballSize }, this.scene);
        const ballMaterial = new BABYLON.StandardMaterial('ballMaterial', this.scene);
        ballMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        this.ball.material = ballMaterial;
        
        // Create paddles
        this.paddle1 = BABYLON.MeshBuilder.CreateBox('paddle1', { 
            width: this.paddleWidth, 
            height: this.paddleHeight, 
            depth: 0.2 
        }, this.scene);
        this.paddle1.position.x = -this.gameWidth / 2 + 1;
        
        this.paddle2 = BABYLON.MeshBuilder.CreateBox('paddle2', { 
            width: this.paddleWidth, 
            height: this.paddleHeight, 
            depth: 0.2 
        }, this.scene);
        this.paddle2.position.x = this.gameWidth / 2 - 1;
        
        // Create paddle materials
        const paddle1Material = new BABYLON.StandardMaterial('paddle1Material', this.scene);
        paddle1Material.emissiveColor = new BABYLON.Color3(0, 1, 0);
        this.paddle1.material = paddle1Material;
        
        const paddle2Material = new BABYLON.StandardMaterial('paddle2Material', this.scene);
        paddle2Material.emissiveColor = new BABYLON.Color3(1, 0, 0);
        this.paddle2.material = paddle2Material;
        
        // Create walls (top and bottom)
        const wallMaterial = new BABYLON.StandardMaterial('wallMaterial', this.scene);
        wallMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        
        const topWall = BABYLON.MeshBuilder.CreateBox('topWall', { 
            width: this.gameWidth, 
            height: 0.2, 
            depth: 0.2 
        }, this.scene);
        topWall.position.y = this.gameHeight / 2;
        topWall.material = wallMaterial;
        this.walls.push(topWall);
        
        const bottomWall = BABYLON.MeshBuilder.CreateBox('bottomWall', { 
            width: this.gameWidth, 
            height: 0.2, 
            depth: 0.2 
        }, this.scene);
        bottomWall.position.y = -this.gameHeight / 2;
        bottomWall.material = wallMaterial;
        this.walls.push(bottomWall);
    }
    
    setupControls() {
        // Keyboard event listeners
        window.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            if (event.code === 'Space') {
                event.preventDefault();
                this.toggleGame();
            }
        });
        
        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
    }
    
    setupGameLoop() {
        this.scene.registerBeforeRender(() => {
            if (this.gameRunning) {
                this.updatePaddles();
                this.updateBall();
                this.checkCollisions();
            }
        });
    }
    
    updatePaddles() {
        // Player 1 controls (W/S)
        if (this.keys['KeyW'] && this.paddle1.position.y < this.gameHeight / 2 - this.paddleHeight / 2) {
            this.paddle1.position.y += this.paddleSpeed;
        }
        if (this.keys['KeyS'] && this.paddle1.position.y > -this.gameHeight / 2 + this.paddleHeight / 2) {
            this.paddle1.position.y -= this.paddleSpeed;
        }
        
        // Player 2 controls (Arrow keys)
        if (this.keys['ArrowUp'] && this.paddle2.position.y < this.gameHeight / 2 - this.paddleHeight / 2) {
            this.paddle2.position.y += this.paddleSpeed;
        }
        if (this.keys['ArrowDown'] && this.paddle2.position.y > -this.gameHeight / 2 + this.paddleHeight / 2) {
            this.paddle2.position.y -= this.paddleSpeed;
        }
    }
    
    updateBall() {
        this.ball.position.x += this.ballVelocity.x;
        this.ball.position.y += this.ballVelocity.y;
    }
    
    checkCollisions() {
        const ballPos = this.ball.position;
        const ballRadius = this.ballSize / 2;
        
        // Wall collisions (top and bottom)
        if (ballPos.y + ballRadius >= this.gameHeight / 2 || ballPos.y - ballRadius <= -this.gameHeight / 2) {
            this.ballVelocity.y *= -1;
        }
        
        // Paddle collisions
        // Paddle 1 (left)
        if (ballPos.x - ballRadius <= this.paddle1.position.x + this.paddleWidth / 2 &&
            ballPos.x - ballRadius >= this.paddle1.position.x - this.paddleWidth / 2 &&
            ballPos.y <= this.paddle1.position.y + this.paddleHeight / 2 &&
            ballPos.y >= this.paddle1.position.y - this.paddleHeight / 2 &&
            this.ballVelocity.x < 0) {
            
            this.ballVelocity.x *= -1;
            // Add some variation based on where the ball hits the paddle
            const hitPosition = (ballPos.y - this.paddle1.position.y) / (this.paddleHeight / 2);
            this.ballVelocity.y += hitPosition * 0.1;
        }
        
        // Paddle 2 (right)
        if (ballPos.x + ballRadius >= this.paddle2.position.x - this.paddleWidth / 2 &&
            ballPos.x + ballRadius <= this.paddle2.position.x + this.paddleWidth / 2 &&
            ballPos.y <= this.paddle2.position.y + this.paddleHeight / 2 &&
            ballPos.y >= this.paddle2.position.y - this.paddleHeight / 2 &&
            this.ballVelocity.x > 0) {
            
            this.ballVelocity.x *= -1;
            // Add some variation based on where the ball hits the paddle
            const hitPosition = (ballPos.y - this.paddle2.position.y) / (this.paddleHeight / 2);
            this.ballVelocity.y += hitPosition * 0.1;
        }
        
        // Score detection (ball goes off screen)
        if (ballPos.x < -this.gameWidth / 2 - 2) {
            this.score.player2++;
            this.resetBall();
            this.updateUI();
        } else if (ballPos.x > this.gameWidth / 2 + 2) {
            this.score.player1++;
            this.resetBall();
            this.updateUI();
        }
        
        // Limit ball velocity
        const maxSpeed = 0.8;
        if (Math.abs(this.ballVelocity.x) > maxSpeed) {
            this.ballVelocity.x = Math.sign(this.ballVelocity.x) * maxSpeed;
        }
        if (Math.abs(this.ballVelocity.y) > maxSpeed) {
            this.ballVelocity.y = Math.sign(this.ballVelocity.y) * maxSpeed;
        }
    }
    
    resetBall() {
        this.ball.position.x = 0;
        this.ball.position.y = 0;
        
        // Random direction
        const angle = (Math.random() - 0.5) * Math.PI / 3; // ±30 degrees
        const direction = Math.random() < 0.5 ? 1 : -1;
        
        this.ballVelocity.x = Math.cos(angle) * this.ballSpeed * direction;
        this.ballVelocity.y = Math.sin(angle) * this.ballSpeed;
        
        // Pause the game briefly after scoring
        if (this.gameStarted) {
            this.gameRunning = false;
            setTimeout(() => {
                if (this.gameStarted) {
                    this.gameRunning = true;
                    this.updateGameStatus('');
                }
            }, 1000);
            this.updateGameStatus('Goal! Next point in 1 second...');
        }
    }
    
    toggleGame() {
        if (!this.gameStarted) {
            this.gameStarted = true;
            this.gameRunning = true;
            this.updateGameStatus('');
        } else {
            this.gameRunning = !this.gameRunning;
            this.updateGameStatus(this.gameRunning ? '' : 'PAUSED - Press SPACE to resume');
        }
    }
    
    updateUI() {
        document.getElementById('player1-score').textContent = this.score.player1;
        document.getElementById('player2-score').textContent = this.score.player2;
    }
    
    updateGameStatus(message) {
        document.getElementById('game-status').textContent = message;
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new PongGame();
});
