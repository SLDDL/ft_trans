# Babylon.js Pong Game

A classic Pong game implemented using Babylon.js for 3D rendering in the browser.

## Features

- 3D rendering with Babylon.js
- Two-player local gameplay
- Score tracking
- Collision detection
- Pause/resume functionality
- Responsive controls

## Controls

- **Player 1 (Left Paddle)**: W/S keys
- **Player 2 (Right Paddle)**: Arrow Up/Down keys
- **Start/Pause Game**: Spacebar

## How to Run

1. Open `index.html` in a modern web browser
2. Press Spacebar to start the game
3. Use the controls to move your paddle and prevent the ball from reaching your side

## Game Rules

- First player to score wins the point
- Ball speed increases slightly after each paddle hit
- Ball direction changes based on where it hits the paddle
- Game can be paused/resumed at any time with Spacebar

## Technical Details

- Uses Babylon.js CDN for 3D rendering
- Pure JavaScript game logic (no additional frameworks)
- Responsive design that works on different screen sizes
- Real-time collision detection and physics

## File Structure

- `index.html` - Main HTML file
- `style.css` - Styling and UI layout
- `pong-game.js` - Game logic and Babylon.js integration

Enjoy playing!
