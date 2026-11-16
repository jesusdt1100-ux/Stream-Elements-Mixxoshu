// ==========================================
// DICCIONARIO DE CORREDORAS (Añade más aquí)
// ==========================================
const CHARACTERS = [
    {
        name: "Grass Wonder",
        frente: "https://i.imgur.com/YUvWQkI.gif",       // Stand (512px)
        victoria: "https://i.imgur.com/bjadp5J.gif",     // Pose (512px)
        correrLento: "https://i.imgur.com/lhLRvI1.gif",  // Run_Slow (64px)
        correrTurbo: "https://i.imgur.com/Zw0MyPf.gif"   // Run_Fast (64px)
    },
    {
        name: "Seiun Sky",
        frente: "https://i.imgur.com/LTWNk1T.gif",       // Stand (512px)
        victoria: "https://i.imgur.com/u8awaYl.gif",     // Celebrate (64px) - Puedes cambiarlo al Pose de 512px si prefieres
        correrLento: "https://i.imgur.com/mwLOMeU.gif",  // Run_Slow (64px)
        correrTurbo: "https://i.imgur.com/XBAsKNH.gif"   // Run_Fast (64px)
    },
    {
        name: "Special Week",
        frente: "https://i.imgur.com/cdgR5VS.gif",       // Stand (512px)
        victoria: "https://i.imgur.com/UfQ48JV.gif",     // Celebrate (64px) - Puedes cambiarlo al Pose de 512px si prefieres
        correrLento: "https://i.imgur.com/iYdVdvC.gif",  // Run_Slow (64px)
        correrTurbo: "https://i.imgur.com/Hv90jWb.gif"   // Run_Fast (64px)
    },
    {
        name: "King Halo",
        frente: "https://i.imgur.com/diJjhBC.gif",       // Stand (512px)
        victoria: "https://i.imgur.com/oo6Om9l.gif",     // Celebrate (64px) - Puedes cambiarlo al Pose de 512px si prefieres
        correrLento: "https://i.imgur.com/j0ncvmD.gif",  // Run_Slow (64px)
        correrTurbo: "https://i.imgur.com/P2NAr0V.gif"   // Run_Fast (64px)
    },
    {
        name: "Condor Pasa",
        frente: "https://i.imgur.com/7WaM8zU.gif",       // Stand (512px)
        victoria: "https://i.imgur.com/6YnBydV.gif",     // Celebrate (64px) - Puedes cambiarlo al Pose de 512px si prefieres
        correrLento: "https://i.imgur.com/6tCm8l9.gif",  // Run_Slow (64px)
        correrTurbo: "https://i.imgur.com/njXH8mB.gif"   // Run_Fast (64px)
    }
    // Añade la siguiente copiando la estructura de arriba, separada por una coma.
];

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let runners = {};
let maxRunners = 64;
let countdown = 300; // 5 minutos
let isRacing = true;
const BOOST_COOLDOWN = 4000; // 4 segundos de enfriamiento para el turbo

function updateTimerText() {
    let min = Math.floor(countdown / 60).toString().padStart(2, '0');
    let sec = (countdown % 60).toString().padStart(2, '0');
    document.getElementById("timer").innerText = `${min}:${sec}`;
}

// Reemplaza onWidgetLoad
function iniciarOverlay(obj) {
    // Spawns de prueba (Opcional, los puedes quitar en producción)
    spawnRunner("NPC1", "#FF0000");
    spawnRunner("NPC2", "#00FF00");
    
    let timerInterval = setInterval(() => {
        if (countdown > 0) {
            countdown--;
            updateTimerText();
        } else if (countdown === 0 && isRacing) {
            endRace();
            clearInterval(timerInterval);
        }
    }, 1000);

    // Motor de físicas y animaciones
    setInterval(updateRace, 100); 
}

// Reemplaza onEventReceived
function recibirEvento(obj) {
    if (!isRacing) return;
    if (obj.detail.listener !== "message") return;
    
    let user = obj.detail.event.data.displayName;
    let text = obj.detail.event.data.text;
    let color = obj.detail.event.data.tags.color || "#FFFFFF";

    if (!runners[user] && Object.keys(runners).length < maxRunners) {
        spawnRunner(user, color);
    }
    
    if (runners[user]) {
        let now = Date.now();
        // Solo da el buff si ya pasó el tiempo de recarga
        if (now - runners[user].lastBoost >= BOOST_COOLDOWN) {
            runners[user].speed += 8; 
            runners[user].lastBoost = now; // Reinicia el cronómetro de la barra
        }
        showChatBubble(user, text); // El globo de chat sale siempre
    }
}

// Lógica para asignar personaje según el color del usuario
function getCharacterByColor(hexColor) {
    // Convierte el color a número y usa el residuo para asignar un personaje fijo
    let num = parseInt(hexColor.replace('#', ''), 16) || 0;
    let index = num % CHARACTERS.length;
    return CHARACTERS[index];
}

function spawnRunner(username, colorStr) {
    let container = document.getElementById("runners-container");
    let box = document.createElement("div");
    
    box.className = "runner-box";
    box.id = "runner-" + username;
    
    let charData = getCharacterByColor(colorStr);
    let laneY = Math.floor(Math.random() * 160); 
    
    box.style.bottom = (laneY + 10) + "px";
    box.style.zIndex = 300 - laneY;
    box.style.setProperty('--user-color', colorStr);

    box.innerHTML = `
        <div class="chat-bubble" id="bubble-${username}"></div>
        <div class="runner-name">${username}</div>
        <div class="stamina-container">
            <div class="stamina-fill" id="stamina-${username}"></div>
        </div>
        <img class="runner-img" id="img-${username}" src="${charData.correrTurbo}">
    `;
    container.appendChild(box);

    runners[username] = {
        element: box,
        sprites: charData,
        x: -200, 
        speed: 12, 
        laneY: laneY,
        state: "correrTurbo",
        lastBoost: Date.now() // Inician con el turbo, así que la barra empieza a cargar
    };
}

function showChatBubble(username, text) {
    let bubble = document.getElementById(`bubble-${username}`);
    bubble.innerText = text.length > 18 ? text.substring(0, 18) + "..." : text;
    bubble.classList.add("show");
    
    setTimeout(() => {
        bubble.classList.remove("show");
    }, 4000);
}

function updateRace() {
    if (!isRacing) return;

    let maxDist = 0;
    let now = Date.now(); // Obtenemos el tiempo actual
    
    // Físicas
    for (let u in runners) {
        if (runners[u].speed > 3) runners[u].speed -= 0.4; 
        
        runners[u].x += runners[u].speed; 
        if (runners[u].x > maxDist) maxDist = runners[u].x;
    }

    // Dibujado, GIFs y Barra de Estamina
    for (let u in runners) {
        let displayX = (runners[u].x - maxDist) + 1250; 
        runners[u].element.style.left = displayX + "px";
        
        let targetState = runners[u].speed > 6 ? "correrTurbo" : "correrLento";
        
        if (runners[u].state !== targetState) {
            runners[u].state = targetState;
            document.getElementById(`img-${u}`).src = runners[u].sprites[targetState];
        }

        // --- LÓGICA DE LA BARRA DE ESTAMINA ---
        let timeSinceBoost = now - runners[u].lastBoost;
        let staminaFill = document.getElementById(`stamina-${u}`);
        
        if (timeSinceBoost >= BOOST_COOLDOWN) {
            staminaFill.style.height = "100%";
            staminaFill.style.backgroundColor = "#ffeb3b"; // Amarillo cuando está listo para el boost
        } else {
            let percent = Math.floor((timeSinceBoost / BOOST_COOLDOWN) * 100);
            staminaFill.style.height = percent + "%";
            staminaFill.style.backgroundColor = "#00a8ff"; // Azul mientras carga
        }
    }
}

function endRace() {
    isRacing = false;
    document.getElementById("background").style.animationPlayState = "paused"; 
    document.getElementById("finish-line").classList.add("show"); 
    
    let winner = null;
    let maxDist = -1;
    for (let u in runners) {
        if (runners[u].x > maxDist) {
            maxDist = runners[u].x;
            winner = u;
        }
    }

    setTimeout(() => {
        for (let u in runners) {
            if (u === winner) {
                // Ganadora
                runners[u].element.style.left = "1620px"; 
                document.getElementById(`img-${u}`).src = runners[u].sprites.victoria;
                showChatBubble(u, "🥇 ¡¡GANÉ!!");
            } else {
                // Perdedoras
                let finalX = parseInt(runners[u].element.style.left) - 180;
                runners[u].element.style.left = Math.max(100, finalX) + "px";
                document.getElementById(`img-${u}`).src = runners[u].sprites.frente;
            }
        }
    }, 3200); 
}
