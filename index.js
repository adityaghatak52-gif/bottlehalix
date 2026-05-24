const mineflayer = require('mineflayer');
const { WebSocketServer } = require('ws');

// 1. Initialize WebSocket Server for your HTML Dashboard
const wss = new WebSocketServer({ port: 8080 });
console.log('⚡ WebSocket server active on port 8080');

const clients = new Set();
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ text: "Connected to live Bottle Pixel bot process.", type: "success" }));
    ws.on('close', () => clients.delete(ws));
});

function broadcastLog(message, logType = 'info') {
    console.log(`[${logType.toUpperCase()}] ${message}`);
    const packet = JSON.stringify({ text: message, type: logType });
    for (const client of clients) {
        if (client.readyState === 1) client.send(packet);
    }
}

// ===================================================
// SECURITY CONFIGURATION
// ===================================================
const BOT_PASSWORD = "YourSecretPassword123"; // 🔴 CHANGE THIS TO YOUR BOT'S PASSWORD

const botOptions = {
    host: 'bottle.hopto.org', 
    port: 19281,                  
    username: 'Bottle_Roamer',  
    version: '1.20.4' 
};

function startBot() {
    broadcastLog(`Connecting to server node at ${botOptions.host}:${botOptions.port}...`, 'info');
    const bot = mineflayer.createBot(botOptions);

    let movementInterval;
    let obstacleCheckInterval;
    let lastPosition = null;

    // 2. Handle Auto-Login & Auto-Register Security Checkpoints
    bot.on('message', (jsonMsg) => {
        const messageText = jsonMsg.toString();
        
        // Listen for standard AuthMe / LoginSecurity chat prompts
        if (messageText.includes('/register')) {
            broadcastLog('Server requested registration! Sending /register...', 'warn');
            bot.chat(`/register ${BOT_PASSWORD} ${BOT_PASSWORD}`);
        } 
        else if (messageText.includes('/login')) {
            broadcastLog('Server requested authentication! Sending /login...', 'warn');
            bot.chat(`/login ${BOT_PASSWORD}`);
        }
    });

    bot.on('spawn', () => {
        broadcastLog('Bot successfully spawned into the world!', 'success');
        
        // Wait 3 seconds after spawning to let login clear, then start walking forward
        setTimeout(() => {
            bot.setControlState('forward', true);
            broadcastLog('Active Roaming: Bot initialized walking state.', 'success');
        }, 3000);

        // Obstacle & Anti-Stuck Detection Loop (Runs every 1.5 seconds)
        obstacleCheckInterval = setInterval(() => {
            if (!bot.entity || !bot.entity.position) return;

            const currentPos = bot.entity.position.clone();

            if (lastPosition) {
                const distance = currentPos.distanceTo(lastPosition);
                
                if (distance < 0.3) {
                    broadcastLog('Obstacle encountered! Attempting structural jump...', 'warn');
                    
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 400);

                    setTimeout(() => {
                        if (bot.entity.position.distanceTo(currentPos) < 0.2) {
                            const randomYaw = (Math.random() * 360) * (Math.PI / 180);
                            bot.look(randomYaw, 0, true);
                            broadcastLog(`Path completely blocked. Alternating orientation heading to ${(randomYaw * 180 / Math.PI).toFixed(0)}°`, 'info');
                        }
                    }, 600);
                }
            }
            lastPosition = currentPos;
        }, 1500);

        // Periodic coordinate logging loop
        movementInterval = setInterval(() => {
            if (bot.entity && bot.entity.position) {
                const { x, y, z } = bot.entity.position;
                broadcastLog(`Current Position Coordinates: X: ${x.toFixed(1)} | Y: ${y.toFixed(1)} | Z: ${z.toFixed(1)}`, 'info');
            }
        }, 8000);
    });

    bot.on('chat', (username, message) => {
        // Prevent logging its own authentication commands into the web system
        if (message.startsWith('/login') || message.startsWith('/register')) return;
        broadcastLog(`<${username}> ${message}`, 'info');
    });

    bot.on('end', () => {
        broadcastLog('Disconnected from server. Cleaning engine states...', 'error');
        clearInterval(movementInterval);
        clearInterval(obstacleCheckInterval);
        lastPosition = null;
        
        broadcastLog('Attempting auto-reconnect routine in 15 seconds...', 'warn');
        setTimeout(startBot, 15000);
    });

    bot.on('error', (err) => {
        broadcastLog(`Network Protocol Error: ${err.message}`, 'error');
    });
}

startBot();
