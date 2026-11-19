// =========================================================
// DICCIONARIO COMPLETO DE CORREDORAS (512px y 64px)
// =========================================================
const CHARACTERS = [
    {
        name: "Grass Wonder",
        pose: "https://i.imgur.com/YUvWQkI.gif",     /* COMPLETAR 512px Pose */
        stand: "https://i.imgur.com/YUvWQkI.gif",    /* COMPLETAR 512px Stand */
        walkR: "https://i.imgur.com/lhLRvI1.gif",    /* COMPLETAR 512px Walk_R */
        walkL: "https://i.imgur.com/lhLRvI1.gif",    /* COMPLETAR 512px Walk_L */
        runSlow: "https://i.imgur.com/lhLRvI1.gif",  /* COMPLETAR 64px Run_Slow */
        runFast: "https://i.imgur.com/Zw0MyPf.gif",  /* COMPLETAR 64px Run_Fast */
        celebrate: "https://i.imgur.com/bjadp5J.gif",
        happy: "https://i.imgur.com/NE6Ho06.gif"
    },
    {
        name: "Seiun Sky",
        pose: "https://i.imgur.com/tJWe63B.gif",
        stand: "https://i.imgur.com/LTWNk1T.gif",
        walkR: "https://i.imgur.com/fjjDKk9.gif",
        walkL: "https://i.imgur.com/U2GbU6K.gif",
        runSlow: "https://i.imgur.com/mwLOMeU.gif",
        runFast: "https://i.imgur.com/XBAsKNH.gif",
        celebrate: "https://i.imgur.com/u8awaYl.gif",
        happy: "https://i.imgur.com/vATAu5B.gif"
    },
    {
        name: "King Halo",
        pose: "https://i.imgur.com/W0Ab3t3.gif",
        stand: "https://i.imgur.com/diJjhBC.gif",
        walkR: "https://i.imgur.com/dMSN1Uc.gif",
        walkL: "https://i.imgur.com/cLKhOoP.gif",
        runSlow: "https://i.imgur.com/j0ncvmD.gif",
        runFast: "https://i.imgur.com/P2NAr0V.gif",
        celebrate: "https://i.imgur.com/oo6Om9l.gif",
        happy: "https://i.imgur.com/o0SUL7u.gif"
    },
    {
        name: "Special Week",
        pose: "https://i.imgur.com/dTuDedo.gif",
        stand: "https://i.imgur.com/cdgR5VS.gif",
        walkR: "https://i.imgur.com/H1tB3D6.gif",
        walkL: "https://i.imgur.com/xww75iv.gif",
        runSlow: "https://i.imgur.com/iYdVdvC.gif",
        runFast: "https://i.imgur.com/Hv90jWb.gif",
        celebrate: "https://i.imgur.com/UfQ48JV.gif",
        happy: "https://i.imgur.com/kdQsGeK.gif"
    },
    {
        name: "Condor Pasa",
        pose: "https://i.imgur.com/w34VrsB.gif",
        stand: "https://i.imgur.com/7WaM8zU.gif",
        walkR: "https://i.imgur.com/O4omK71.gif",
        walkL: "https://i.imgur.com/qUXgJzh.gif",
        runSlow: "https://i.imgur.com/6tCm8l9.gif",
        runFast: "https://i.imgur.com/njXH8mB.gif",
        celebrate: "https://i.imgur.com/6YnBydV.gif",
        happy: "https://i.imgur.com/5mmykDT.gif"
    }
];

// =========================================================
// ESTADO GLOBAL Y BASE DE DATOS
// =========================================================
let hallOfFame = {};
let userColorsMemory = {};

let peekTimeout = null;
let ttsTimeout = null;

// Estados de carrera: IDLE | LOBBY | WALKING_TO_START | COUNTDOWN | RACING | FINISHING
let raceState = "IDLE";
let raceMode = "FREE";
let racePot = 0;
let raceRunners = {};
let raceTimer = 0;
let raceInterval = null;
const IG_BOOST_COOLDOWN = 3500;
const GOAL_DISTANCE = 2400;
const START_LINE_X = 210; // Posición X donde se alinean antes del 3, 2, 1

// =========================================================
// INICIALIZACIÓN
// =========================================================
function iniciarOverlay(obj) {
    cargarDatosNube();
    setInterval(updateIngameRace, 100);
}

function cargarDatosNube() {
    if (typeof SE_API !== "undefined" && SE_API.store) {
        SE_API.store.get('uma_hall_of_fame').then(data => {
            if (data) hallOfFame = data;
            actualizarTablaUI();
        }).catch(() => {});
    }
}

function guardarDatosNube() {
    if (typeof SE_API !== "undefined" && SE_API.store) {
        SE_API.store.set('uma_hall_of_fame', hallOfFame);
    }
    actualizarTablaUI();
}

function asegurarUsuarioDB(userId, displayName) {
    if (!hallOfFame[userId]) {
        hallOfFame[userId] = { name: displayName, wins: 0, points: 1000 };
    } else {
        hallOfFame[userId].name = displayName;
        if (typeof hallOfFame[userId].points !== "number") hallOfFame[userId].points = 1000;
    }
}

function getRandomCharacter() {
    return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
}

function getCharacterByColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') hexColor = "#FFFFFF";
    let num = parseInt(hexColor.replace('#', ''), 16);
    if (isNaN(num)) num = 0;
    return CHARACTERS[num % CHARACTERS.length];
}

// =========================================================
// RECEPCIÓN DE EVENTOS
// =========================================================
function recibirEvento(obj) {
    if (!obj || !obj.detail) return;
    const listener = obj.detail.listener;
    const event = obj.detail.event;

    // 1. Recompensas de Puntos de Canal
    if (listener === "redemption-latest" || (event && event.type === "channelPointsRedemption")) {
        let user = (event && (event.name || event.displayName || event.user)) || "Chatter";
        let userId = user.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let rewardTitle = (event && (event.rewardTitle || event.title || "Recompensa")) || "Recompensa";
        let userInput = (event && (event.message || event.userInput)) || "";
        let color = userColorsMemory[userId] || "#76ff03";

        asegurarUsuarioDB(userId, user);
        hallOfFame[userId].points += 250;
        guardarDatosNube();

        activarCamaraPeek(user, "🎁 " + rewardTitle.substring(0, 14), color);

        if (userInput && userInput.trim().length > 0) {
            activarTTSRunner(user, userInput, color);
        }

        if (raceState === "LOBBY" && !raceRunners[userId]) {
            unirseACarrera(userId, user, color, 100, true);
        }
        return;
    }

    // 2. Mensajes de Chat
    if (listener !== "message") return;

    let data = event.data;
    let userId = data.nick || data.displayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let displayName = data.displayName;
    let text = (data.text || "").trim();
    let lower = text.toLowerCase();
    let color = (data.tags && data.tags.color) ? data.tags.color : "#FFFFFF";

    userColorsMemory[userId] = color;
    asegurarUsuarioDB(userId, displayName);
    hallOfFame[userId].points += 5;

    let isModOrBroadcaster = false;
    if (data.tags && data.tags.badges) {
        isModOrBroadcaster = data.tags.badges.includes("broadcaster") || data.tags.badges.includes("moderator");
    }
    if (data.tags && (data.tags.mod === "1" || data.tags.mod === true)) {
        isModOrBroadcaster = true;
    }

    // -----------------------------------------------------
    // COMANDO !DEBUG (Streamer / Mods)
    // -----------------------------------------------------
    if (lower.startsWith("!debug") && isModOrBroadcaster) {
        let sub = lower.split(" ")[1] || "peek";
        if (sub === "peek") {
            activarCamaraPeek(displayName, "🛠️ DEBUG PEEK", color);
        } else if (sub === "anuncio") {
            lanzarAnuncio("¡Este es un anuncio de prueba caminando por el stream!");
        } else if (sub === "tts") {
            activarTTSRunner(displayName, "Hola Mixxo, probando el sistema de TTS con animación de entrada y modo stand.", color);
        } else if (sub === "carrera") {
            iniciarDebugCarrera();
        }
        return;
    }

    // -----------------------------------------------------
    // SOUNDALERTS TTS
    // -----------------------------------------------------
    if (userId === "soundalerts" || displayName.toLowerCase() === "soundalerts") {
        let matchUser = text.split(" ")[0] || displayName;
        let cleanId = matchUser.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let savedColor = userColorsMemory[cleanId] || "#00e5ff";
        activarTTSRunner(matchUser, text, savedColor);
        return;
    }

    if (lower.startsWith("!tts ")) {
        let ttsMsg = text.substring(5).trim();
        if (ttsMsg) activarTTSRunner(displayName, ttsMsg, color);
        return;
    }

    // -----------------------------------------------------
    // CUALQUIER MENCIÓN DE "LURK" EN EL CHAT (!lurk o lurk)
    // -----------------------------------------------------
    if (/\blurk\b/i.test(text)) {
        activarCamaraPeek(displayName, "💤 LURK", color);
    }

    // -----------------------------------------------------
    // ANUNCIOS (!anuncio)
    // -----------------------------------------------------
    if (lower.startsWith("!anuncio ") && isModOrBroadcaster) {
        let anuncioTexto = text.substring(9).trim();
        if (anuncioTexto.length > 0) lanzarAnuncio(anuncioTexto);
        return;
    }

    // -----------------------------------------------------
    // TABLA (!top / !tabla)
    // -----------------------------------------------------
    if (lower === "!top" || lower === "!tabla") {
        mostrarTablaTemporal();
        return;
    }

    // -----------------------------------------------------
    // CARRERAS (!carrera free / !carrera apuesta / !p)
    // -----------------------------------------------------
    if (lower.startsWith("!carrera") && isModOrBroadcaster) {
        if (raceState !== "IDLE") return;
        abrirLobbyCarrera(lower.includes("apuesta") ? "BET" : "FREE", 35);
        return;
    }

    if (lower === "!p" || lower.startsWith("!p ")) {
        if (raceState !== "LOBBY") return;
        let partes = text.split(" ");
        let monto = parseInt(partes[1], 10);
        if (isNaN(monto) || monto <= 0) monto = 100;
        unirseACarrera(userId, displayName, color, monto, false);
        return;
    }

    // Boost durante la carrera
    if (raceState === "RACING" && raceRunners[userId]) {
        let runner = raceRunners[userId];
        let now = Date.now();
        if (now - runner.lastBoost >= IG_BOOST_COOLDOWN) {
            runner.speed = Math.min(24, runner.speed + 11);
            runner.lastBoost = now;
        }
    }
}

// =========================================================
// 1. MARCO DE CÁMARA PEEK (Modo Happy)
// =========================================================
function activarCamaraPeek(username, badgeText, userColor) {
    const actor = document.getElementById("cam-peek-actor");
    const img = document.getElementById("peek-img");
    const badge = document.getElementById("peek-badge");
    const userEl = document.getElementById("peek-user");

    const randomChar = getRandomCharacter();

    if (peekTimeout) clearTimeout(peekTimeout);
    actor.classList.remove("active");

    setTimeout(() => {
        img.src = randomChar.happy;
        badge.innerText = badgeText;
        userEl.innerText = username;
        actor.style.setProperty('--peek-color', userColor || "#1a1a1a");

        actor.classList.add("active");

        peekTimeout = setTimeout(() => {
            actor.classList.remove("active");
        }, 5500);
    }, 150);
}

// =========================================================
// 2. ANUNCIOS CAMINANDO (Walk_R / Walk_L)
// =========================================================
function lanzarAnuncio(mensaje) {
    const track = document.getElementById("announcement-track");
    const randomChar = getRandomCharacter();
    const goRight = Math.random() < 0.5;
    const dirClass = goRight ? "dir-right" : "dir-left";
    const walkSprite = goRight ? randomChar.walkR : randomChar.walkL;

    const group = document.createElement("div");
    group.className = `announcer-group ${dirClass}`;

    group.innerHTML = `
        <img class="announcer-runner" src="${walkSprite}" alt="Runner">
        <div class="announcer-rope"></div>
        <div class="announcer-banner">📢 ${mensaje}</div>
    `;

    track.appendChild(group);

    setTimeout(() => {
        group.remove();
    }, 12500);
}

// =========================================================
// 3. SOUNDALERTS TTS (Walk_L -> Stand -> Walk_R)
// =========================================================
function activarTTSRunner(username, mensaje, colorStr) {
    const actor = document.getElementById("tts-actor");
    const img = document.getElementById("tts-img");
    const bubble = document.getElementById("tts-bubble");
    const authorEl = document.getElementById("tts-author");
    const textEl = document.getElementById("tts-text");

    const charData = getCharacterByColor(colorStr);

    if (ttsTimeout) clearTimeout(ttsTimeout);

    actor.classList.remove("walk-in", "standing");
    bubble.classList.remove("visible");

    setTimeout(() => {
        // Entra desde la derecha caminando hacia la izquierda
        img.src = charData.walkL;
        authorEl.innerText = username;
        textEl.innerText = mensaje;
        bubble.style.setProperty('--tts-color', colorStr || "#1a1a1a");

        actor.classList.add("walk-in");

        // Se detiene en Stand y abre burbuja
        setTimeout(() => {
            actor.classList.add("standing");
            img.src = charData.stand;
            bubble.classList.add("visible");
        }, 1100);

        let readDuration = Math.min(14000, Math.max(6500, mensaje.length * 110));

        // Se retira caminando hacia la derecha
        ttsTimeout = setTimeout(() => {
            bubble.classList.remove("visible");
            actor.classList.remove("standing");
            img.src = charData.walkR;
            actor.classList.remove("walk-in");
        }, 1100 + readDuration);
    }, 150);
}

// =========================================================
// 4. CARRERA: LOBBY -> CAMINATA AL INICIO -> 3,2,1 -> CARRERA
// =========================================================
function abrirLobbyCarrera(modo, segundosLobby = 35) {
    raceState = "LOBBY";
    raceMode = modo;
    racePot = 0;
    raceRunners = {};
    raceTimer = segundosLobby;

    document.getElementById("ingame-runners-container").innerHTML = "";
    document.getElementById("ingame-finish-line").classList.remove("show");
    const startLine = document.getElementById("ingame-start-line");
    startLine.classList.remove("slide-out");
    startLine.classList.add("visible");

    document.getElementById("ingame-race-wrapper").classList.remove("hidden");

    // También sale una corredora del marco de la cámara avisando que se abrió la carrera
    activarCamaraPeek("¡A CORRER!", modo === "BET" ? "💰 !CARRERA" : "🏇 !CARRERA", "#76ff03");

    const titleEl = document.getElementById("race-status-title");
    const subEl = document.getElementById("race-status-sub");
    const potEl = document.getElementById("race-pot");

    if (modo === "BET") {
        titleEl.innerText = "💰 ¡CARRERA CON APUESTA!";
        subEl.innerHTML = `Escribe <span class="cmd-highlight">!p [puntos]</span> para apostar y correr`;
        potEl.style.display = "block";
        potEl.innerText = `POZO: 0 PTS`;
    } else {
        titleEl.innerText = "🏇 ¡CARRERA GRATIS ABIERTA!";
        subEl.innerHTML = `Escribe <span class="cmd-highlight">!p</span> en el chat para entrar`;
        potEl.style.display = "none";
    }

    actualizarRelojCarrera();

    if (raceInterval) clearInterval(raceInterval);
    raceInterval = setInterval(() => {
        if (raceState === "LOBBY") {
            raceTimer--;
            actualizarRelojCarrera();
            if (raceTimer <= 0) {
                clearInterval(raceInterval);
                caminarAlPuntoDePartida();
            }
        } else if (raceState === "RACING") {
            raceTimer--;
            actualizarRelojCarrera();
            if (raceTimer <= 0) {
                finalizarCarreraIngame();
            }
        }
    }, 1000);
}

function unirseACarrera(userId, displayName, colorStr, monto, esCanjeCanal, isBot = false) {
    if (raceRunners[userId]) return;

    if (!isBot) {
        asegurarUsuarioDB(userId, displayName);
        if (raceMode === "BET" && !esCanjeCanal) {
            if (hallOfFame[userId].points < monto) monto = hallOfFame[userId].points;
            if (monto <= 0) {
                monto = 50;
                hallOfFame[userId].points = 50;
            }
            hallOfFame[userId].points -= monto;
            racePot += monto;
            document.getElementById("race-pot").innerText = `POZO: ${racePot} PTS`;
            guardarDatosNube();
        } else if (raceMode === "BET" && esCanjeCanal) {
            racePot += 250;
            document.getElementById("race-pot").innerText = `POZO: ${racePot} PTS`;
        }
    }

    const container = document.getElementById("ingame-runners-container");
    const charData = getCharacterByColor(colorStr);
    const laneY = Math.floor(Math.random() * 95);
    // Aparecen en zona de espera a la izquierda (entre 10px y 90px) en modo Stand
    const spawnX = 10 + Math.floor(Math.random() * 80);

    const box = document.createElement("div");
    box.className = "ig-runner-box";
    box.id = `ig-runner-${userId}`;
    box.style.bottom = (laneY + 8) + "px";
    box.style.left = spawnX + "px";
    box.style.zIndex = 200 - laneY;
    box.style.setProperty('--user-color', colorStr || "#FFFFFF");

    box.innerHTML = `
        <div class="ig-runner-name">${displayName}</div>
        <div class="ig-stamina-bar">
            <div class="ig-stamina-fill" id="ig-stamina-${userId}"></div>
        </div>
        <img class="ig-runner-img" id="ig-img-${userId}" src="${charData.stand}">
    `;

    container.appendChild(box);

    raceRunners[userId] = {
        element: box,
        sprites: charData,
        x: 0,
        speed: 0,
        state: "stand",
        lastBoost: 0,
        displayName: displayName,
        bet: monto,
        isBot: isBot
    };
}

// PASO INTERMEDIO 1: Caminan al punto de partida
function caminarAlPuntoDePartida() {
    if (Object.keys(raceRunners).length === 0) {
        cerrarCarreraIngame();
        return;
    }

    raceState = "WALKING_TO_START";
    document.getElementById("race-status-title").innerText = "🚶 ¡A SUS POSICIONES!";
    document.getElementById("race-status-sub").innerText = "Las corredoras se acercan al punto de partida...";

    for (let u in raceRunners) {
        let r = raceRunners[u];
        r.element.classList.add("walking-to-start");
        let img = document.getElementById(`ig-img-${u}`);
        if (img) img.src = r.sprites.walkR;
        r.state = "walkR";
        // Se alinean todas exactamente en el punto de partida
        r.element.style.left = START_LINE_X + "px";
    }

    // Al terminar de caminar (2.3s), inicia la cuenta regresiva
    setTimeout(() => {
        iniciarCuentaRegresiva();
    }, 2300);
}

// PASO INTERMEDIO 2: Pose y Cuenta Regresiva (3, 2, 1, ¡YA!)
function iniciarCuentaRegresiva() {
    raceState = "COUNTDOWN";
    document.getElementById("race-status-title").innerText = "🏁 ¡PREPARADAS!";
    document.getElementById("race-status-sub").innerText = "¡Prepárate para escribir en el chat!";

    for (let u in raceRunners) {
        let r = raceRunners[u];
        r.element.classList.remove("walking-to-start");
        let img = document.getElementById(`ig-img-${u}`);
        if (img) img.src = r.sprites.pose;
        r.state = "pose";
    }

    const banner = document.getElementById("race-countdown-banner");
    const pasos = ["3", "2", "1", "¡YA!"];
    let idx = 0;

    function mostrarPaso() {
        banner.innerText = pasos[idx];
        banner.classList.remove("pop");
        void banner.offsetWidth; // Forzar reinicio de animación
        banner.classList.add("pop");

        if (idx === pasos.length - 1) {
            // Arranca la carrera en "¡YA!"
            iniciarCarreraIngame();
            setTimeout(() => {
                banner.classList.remove("pop");
            }, 650);
        } else {
            idx++;
            setTimeout(mostrarPaso, 1000);
        }
    }

    mostrarPaso();
}

function iniciarCarreraIngame() {
    raceState = "RACING";
    raceTimer = 60;

    document.getElementById("ingame-start-line").classList.add("slide-out");
    document.getElementById("race-status-title").innerText = "🔥 ¡EN MARCHA!";
    document.getElementById("race-status-sub").innerHTML = `¡Escribe en el chat para <span class="cmd-highlight">BOOSTEAR</span> o te quedarás atrás!`;

    let now = Date.now();
    for (let u in raceRunners) {
        raceRunners[u].speed = 7;
        raceRunners[u].lastBoost = now - IG_BOOST_COOLDOWN;
        raceRunners[u].state = "runSlow";
        let img = document.getElementById(`ig-img-${u}`);
        if (img) img.src = raceRunners[u].sprites.runSlow;
    }

    if (raceInterval) clearInterval(raceInterval);
    raceInterval = setInterval(() => {
        if (raceState === "RACING") {
            raceTimer--;
            actualizarRelojCarrera();
            if (raceTimer <= 0) finalizarCarreraIngame();
        }
    }, 1000);
}

function updateIngameRace() {
    if (raceState !== "RACING") return;

    let maxDist = 0;
    let now = Date.now();
    let someoneReachedGoal = false;

    for (let u in raceRunners) {
        let r = raceRunners[u];

        // Si es bot de !debug carrera, simula boosts aleatorios
        if (r.isBot && now - r.lastBoost >= IG_BOOST_COOLDOWN && Math.random() < 0.25) {
            r.speed = Math.min(24, r.speed + 11);
            r.lastBoost = now;
        }

        if (r.speed > 0.6) {
            r.speed = Math.max(0.6, r.speed - 0.55);
        }
        r.x += r.speed;
        if (r.x > maxDist) maxDist = r.x;
        if (r.x >= GOAL_DISTANCE) someoneReachedGoal = true;
    }

    for (let u in raceRunners) {
        let r = raceRunners[u];
        let leaderScreenX = Math.min(1480, START_LINE_X + (maxDist * 0.65));
        let distanceBehindLeader = maxDist - r.x;
        let screenX = leaderScreenX - (distanceBehindLeader * 1.15);

        r.element.style.left = Math.max(-180, screenX) + "px";

        let targetState = r.speed > 5.5 ? "runFast" : "runSlow";
        if (r.state !== targetState) {
            r.state = targetState;
            let img = document.getElementById(`ig-img-${u}`);
            if (img) img.src = r.sprites[targetState];
        }

        let elapsed = now - r.lastBoost;
        let fill = document.getElementById(`ig-stamina-${u}`);
        if (fill) {
            let pct = Math.min(100, Math.floor((elapsed / IG_BOOST_COOLDOWN) * 100));
            fill.style.height = pct + "%";
            fill.style.backgroundColor = pct >= 100 ? "#76ff03" : "#00e5ff";
        }
    }

    if (someoneReachedGoal) {
        finalizarCarreraIngame();
    }
}

function finalizarCarreraIngame() {
    if (raceState !== "RACING") return;
    raceState = "FINISHING";
    if (raceInterval) clearInterval(raceInterval);

    document.getElementById("ingame-finish-line").classList.add("show");

    let winnerId = null;
    let maxDist = -1;
    for (let u in raceRunners) {
        if (raceRunners[u].x > maxDist) {
            maxDist = raceRunners[u].x;
            winnerId = u;
        }
    }

    setTimeout(() => {
        if (winnerId && raceRunners[winnerId]) {
            let w = raceRunners[winnerId];
            let premioTexto = "";

            if (!w.isBot) {
                asegurarUsuarioDB(winnerId, w.displayName);
                hallOfFame[winnerId].wins += 1;
                if (raceMode === "BET" && racePot > 0) {
                    hallOfFame[winnerId].points += racePot;
                    premioTexto = ` (+${racePot} PTS)`;
                } else {
                    hallOfFame[winnerId].points += 150;
                    premioTexto = ` (+150 PTS)`;
                }
                guardarDatosNube();
            }

            document.getElementById("race-status-title").innerText = `🥇 GANADORA: ${w.displayName.toUpperCase()}`;
            document.getElementById("race-status-sub").innerText = w.isBot ? "¡Carrera de prueba finalizada!" : `¡Victoria registrada en el Hall of Fame!${premioTexto}`;
        }

        for (let u in raceRunners) {
            let img = document.getElementById(`ig-img-${u}`);
            if (!img) continue;
            if (u === winnerId) {
                raceRunners[u].element.style.left = "1620px";
                img.src = raceRunners[u].sprites.celebrate;
            } else {
                img.src = raceRunners[u].sprites.stand;
            }
        }

        mostrarTablaTemporal();

        setTimeout(() => {
            cerrarCarreraIngame();
        }, 8000);
    }, 650);
}

function cerrarCarreraIngame() {
    if (raceInterval) clearInterval(raceInterval);
    raceState = "IDLE";
    document.getElementById("ingame-race-wrapper").classList.add("hidden");
    const startLine = document.getElementById("ingame-start-line");
    startLine.classList.remove("visible", "slide-out");
}

function actualizarRelojCarrera() {
    let min = Math.floor(raceTimer / 60).toString().padStart(2, '0');
    let sec = (raceTimer % 60).toString().padStart(2, '0');
    document.getElementById("race-timer").innerText = `${min}:${sec}`;
}

// =========================================================
// FUNCIÓN AUXILIAR DE PRUEBA (!debug carrera)
// =========================================================
function iniciarDebugCarrera() {
    if (raceState !== "IDLE") cerrarCarreraIngame();
    abrirLobbyCarrera("FREE", 6); // Lobby rápido de 6 segundos

    // Spawnea 4 bots escalonados en modo Stand para probar el flujo completo
    const bots = [
        { id: "bot1", name: "Bot_Sky", color: "#00BFFF" },
        { id: "bot2", name: "Bot_Halo", color: "#32CD32" },
        { id: "bot3", name: "Bot_Spe", color: "#FF69B4" },
        { id: "bot4", name: "Bot_Condor", color: "#FF4500" }
    ];

    bots.forEach((b, i) => {
        setTimeout(() => {
            if (raceState === "LOBBY") {
                unirseACarrera(b.id, b.name, b.color, 100, false, true);
            }
        }, (i + 1) * 700);
    });
}

// =========================================================
// 5. TABLA DE CLASIFICACIÓN (Hall of Fame)
// =========================================================
function actualizarTablaUI() {
    const list = document.getElementById("lb-list");
    if (!list) return;

    let sorted = Object.values(hallOfFame).sort((a, b) => b.wins - a.wins).slice(0, 6);
    if (sorted.length === 0) {
        list.innerHTML = `<div class="lb-row"><span>Sin registros aún</span></div>`;
        return;
    }

    let html = "";
    sorted.forEach((u, index) => {
        let icon = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
        html += `
            <div class="lb-row">
                <span>${icon} ${u.name}</span>
                <span class="lb-stats">${u.wins}W | ${u.points || 0}P</span>
            </div>
        `;
    });
    list.innerHTML = html;
}

let lbTimeout = null;
function mostrarTablaTemporal() {
    actualizarTablaUI();
    const panel = document.getElementById("leaderboard-panel");
    panel.classList.remove("hidden");
    if (lbTimeout) clearTimeout(lbTimeout);
    lbTimeout = setTimeout(() => {
        panel.classList.add("hidden");
    }, 10000);
}
