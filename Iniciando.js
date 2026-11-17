// ==========================================
// DICCIONARIO DE CORREDORAS
// ==========================================
const CHARACTERS = [
    { name: "Grass Wonder", frente: "https://i.imgur.com/YUvWQkI.gif", victoria: "https://i.imgur.com/bjadp5J.gif", correrLento: "https://i.imgur.com/lhLRvI1.gif", correrTurbo: "https://i.imgur.com/Zw0MyPf.gif" },
    { name: "Seiun Sky", frente: "https://i.imgur.com/LTWNk1T.gif", victoria: "https://i.imgur.com/u8awaYl.gif", correrLento: "https://i.imgur.com/mwLOMeU.gif", correrTurbo: "https://i.imgur.com/XBAsKNH.gif" },
    { name: "Special Week", frente: "https://i.imgur.com/cdgR5VS.gif", victoria: "https://i.imgur.com/UfQ48JV.gif", correrLento: "https://i.imgur.com/iYdVdvC.gif", correrTurbo: "https://i.imgur.com/Hv90jWb.gif" },
    { name: "King Halo", frente: "https://i.imgur.com/diJjhBC.gif", victoria: "https://i.imgur.com/oo6Om9l.gif", correrLento: "https://i.imgur.com/j0ncvmD.gif", correrTurbo: "https://i.imgur.com/P2NAr0V.gif" },
    { name: "Condor Pasa", frente: "https://i.imgur.com/7WaM8zU.gif", victoria: "https://i.imgur.com/6YnBydV.gif", correrLento: "https://i.imgur.com/6tCm8l9.gif", correrTurbo: "https://i.imgur.com/njXH8mB.gif" }
];

let runners = {};
let maxRunners = 64;
let countdown = 300; 
let isRacing = true;
const BOOST_COOLDOWN = 4000; 

function updateTimerText() {
    let min = Math.floor(countdown / 60).toString().padStart(2, '0');
    let sec = (countdown % 60).toString().padStart(2, '0');
    document.getElementById("timer").innerText = `${min}:${sec}`;
}

function iniciarOverlay(obj) {
    let timerInterval = setInterval(() => {
        if (countdown > 0) {
            countdown--;
            updateTimerText();
        } else if (countdown === 0 && isRacing) {
            endRace();
            clearInterval(timerInterval);
        }
    }, 1000);
    setInterval(updateRace, 100); 
}

function recibirEvento(obj) {
    if (!isRacing) return;
    if (obj.detail.listener !== "message") return;
    
    let data = obj.detail.event.data;
    
    // BLINDAJE 1: Usamos el nick real (letras minúsculas sin espacios) como ID único interno.
    // Si no está disponible, limpiamos el displayName a la fuerza.
    let userId = data.nick || data.displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); 
    let displayName = data.displayName;
    let text = data.text;
    
    // BLINDAJE 2: Verificamos de forma segura que el color exista en la ruta de datos.
    let color = "#FFFFFF";
    if (data.tags && data.tags.color) {
        color = data.tags.color;
    }

    if (!runners[userId] && Object.keys(runners).length < maxRunners) {
        spawnRunner(userId, displayName, color);
    }
    
    if (runners[userId]) {
        let now = Date.now();
        if (now - runners[userId].lastBoost >= BOOST_COOLDOWN) {
            runners[userId].speed += 8; 
            runners[userId].lastBoost = now; 
        }
        showChatBubble(userId, text);
    }
}

function getCharacterByColor(hexColor) {
    // BLINDAJE 3: Si el dato llega corrupto, lo forzamos a ser un string blanco válido
    if (!hexColor || typeof hexColor !== 'string') {
        hexColor = "#FFFFFF";
    }
    
    let cleanHex = hexColor.replace('#', '');
    let num = parseInt(cleanHex, 16);
    
    // Si la conversión falla (no es hexadecimal), asignamos 0 por defecto
    if (isNaN(num)) num = 0; 
    
    let index = num % CHARACTERS.length;
    return CHARACTERS[index];
}

function spawnRunner(userId, displayName, colorStr) {
    let container = document.getElementById("runners-container");
    let box = document.createElement("div");
    
    box.className = "runner-box";
    // Usamos el ID seguro para el DOM
    box.id = "runner-" + userId;
    
    let charData = getCharacterByColor(colorStr);
    let laneY = Math.floor(Math.random() * 320); 
    
    box.style.bottom = (laneY + 10) + "px";
    box.style.zIndex = 300 - laneY;
    
    if (!colorStr || typeof colorStr !== 'string') colorStr = "#FFFFFF";
    box.style.setProperty('--user-color', colorStr);

    // Se imprime visualmente el displayName, pero los "id" del HTML utilizan el userId seguro
    box.innerHTML = `
        <div class="chat-bubble" id="bubble-${userId}"></div>
        <div class="runner-name">${displayName}</div>
        <div class="stamina-container charging" id="stamina-container-${userId}">
            <div class="stamina-fill" id="stamina-${userId}"></div>
        </div>
        <img class="runner-img" id="img-${userId}" src="${charData.correrTurbo}">
    `;
    container.appendChild(box);

    // El registro ahora usa el userId para evitar la clonación
    runners[userId] = {
        element: box,
        sprites: charData,
        x: -200, 
        speed: 12, 
        laneY: laneY,
        state: "correrTurbo",
        lastBoost: Date.now(),
        displayName: displayName
    };
}

function showChatBubble(userId, text) {
    let bubble = document.getElementById(`bubble-${userId}`);
    // BLINDAJE 4: Detener ejecución si la burbuja no fue creada
    if (!bubble) return; 
    
    bubble.innerText = text.length > 18 ? text.substring(0, 18) + "..." : text;
    bubble.classList.add("show");
    
    setTimeout(() => {
        bubble.classList.remove("show");
    }, 4000);
}

function updateRace() {
    if (!isRacing) return;
    let maxDist = 0;
    let now = Date.now(); 
    
    for (let u in runners) {
        if (runners[u].speed > 3) runners[u].speed -= 0.4; 
        runners[u].x += runners[u].speed; 
        if (runners[u].x > maxDist) maxDist = runners[u].x;
    }

    for (let u in runners) {
        let displayX = (runners[u].x - maxDist) + 1250; 
        runners[u].element.style.left = displayX + "px";
        
        let targetState = runners[u].speed > 6 ? "correrTurbo" : "correrLento";
        
        if (runners[u].state !== targetState) {
            runners[u].state = targetState;
            let imgEl = document.getElementById(`img-${u}`);
            if (imgEl) imgEl.src = runners[u].sprites[targetState];
        }

        let timeSinceBoost = now - runners[u].lastBoost;
        let staminaFill = document.getElementById(`stamina-${u}`);
        let staminaContainer = document.getElementById(`stamina-container-${u}`);
        
        if (staminaContainer && staminaFill) {
            if (timeSinceBoost >= BOOST_COOLDOWN) {
                staminaFill.style.height = "100%";
                staminaContainer.classList.remove("charging"); 
            } else {
                let percent = Math.floor((timeSinceBoost / BOOST_COOLDOWN) * 100);
                staminaFill.style.height = percent + "%";
                staminaContainer.classList.add("charging");
            }
        }
    }
}

function endRace() {
    document.getElementById("finish-line").classList.add("show"); 
    
    let floatingText = document.getElementById("floating-text");
    if(floatingText) floatingText.style.display = "none";
    
    let winnerId = null;
    let maxDist = -1;
    for (let u in runners) {
        if (runners[u].x > maxDist) {
            maxDist = runners[u].x;
            winnerId = u;
        }
        let staminaContainer = document.getElementById(`stamina-container-${u}`);
        if (staminaContainer) staminaContainer.classList.remove("charging");
    }

    setTimeout(() => {
        isRacing = false; 
        
        let parallaxLayers = document.querySelectorAll('.parallax-layer');
        parallaxLayers.forEach(layer => {
            layer.style.animationPlayState = "paused"; 
        });

        for (let u in runners) {
            let imgEl = document.getElementById(`img-${u}`);
            if (!imgEl) continue;
            
            if (u === winnerId) {
                runners[u].element.style.left = "1620px"; 
                imgEl.src = runners[u].sprites.victoria;
                showChatBubble(u, "🥇 ¡¡GANÉ!!");
            } else {
                let finalX = parseInt(runners[u].element.style.left) - 180;
                runners[u].element.style.left = Math.max(100, finalX) + "px";
                imgEl.src = runners[u].sprites.frente;
            }
        }
    }, 700); 
}
