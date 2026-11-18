// =========================================================
// DICCIONARIO DE CORREDORAS
// =========================================================
const CHARACTERS = [
    { name: "Grass Wonder", frente: "https://i.imgur.com/YUvWQkI.gif", victoria: "https://i.imgur.com/bjadp5J.gif", correrLento: "https://i.imgur.com/lhLRvI1.gif", correrTurbo: "https://i.imgur.com/Zw0MyPf.gif" },
    { name: "Seiun Sky", frente: "https://i.imgur.com/LTWNk1T.gif", victoria: "https://i.imgur.com/u8awaYl.gif", correrLento: "https://i.imgur.com/mwLOMeU.gif", correrTurbo: "https://i.imgur.com/XBAsKNH.gif" },
    { name: "Special Week", frente: "https://i.imgur.com/cdgR5VS.gif", victoria: "https://i.imgur.com/UfQ48JV.gif", correrLento: "https://i.imgur.com/iYdVdvC.gif", correrTurbo: "https://i.imgur.com/Hv90jWb.gif" },
    { name: "King Halo", frente: "https://i.imgur.com/diJjhBC.gif", victoria: "https://i.imgur.com/oo6Om9l.gif", correrLento: "https://i.imgur.com/j0ncvmD.gif", correrTurbo: "https://i.imgur.com/P2NAr0V.gif" },
    { name: "Condor Pasa", frente: "https://i.imgur.com/7WaM8zU.gif", victoria: "https://i.imgur.com/6YnBydV.gif", correrLento: "https://i.imgur.com/6tCm8l9.gif", correrTurbo: "https://i.imgur.com/njXH8mB.gif" }
];

// =========================================================
// ESTADO GLOBAL Y BASE DE DATOS (SE_API.store)
// =========================================================
let hallOfFame = {}; // { userId: { name, wins, points } }
let userColorsMemory = {}; // Guarda el último color conocido de cada usuario para SoundAlerts

// Colas para evitar que se pisen animaciones
let peekTimeout = null;
let ttsTimeout = null;

// Estado del Minijuego de Carrera In-Game
let raceState = "IDLE"; // IDLE | LOBBY | RACING | FINISHING
let raceMode = "FREE";  // FREE | BET
let racePot = 0;
let raceRunners = {};
let raceTimer = 0;
let raceInterval = null;
let raceTickInterval = null;
const IG_BOOST_COOLDOWN = 3500;
const GOAL_DISTANCE = 2400; // Distancia total de la carrera

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

// =========================================================
// UTILIDADES DE PERSONAJE
// =========================================================
function getRandomCharacter() {
    let idx = Math.floor(Math.random() * CHARACTERS.length);
    return CHARACTERS[idx];
}

function getCharacterByColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') hexColor = "#FFFFFF";
    let num = parseInt(hexColor.replace('#', ''), 16);
    if (isNaN(num)) num = 0;
    return CHARACTERS[num % CHARACTERS.length];
}

// =========================================================
// RECEPCIÓN DE EVENTOS (Chat, Canjes, SoundAlerts)
// =========================================================
function recibirEvento(obj) {
    if (!obj || !obj.detail) return;
    const listener = obj.detail.listener;
    const event = obj.detail.event;

    // 1. Recompensas de Puntos de Canal nativos de Twitch
    if (listener === "redemption-latest" || (event && event.type === "channelPointsRedemption")) {
        let user = (event && (event.name || event.displayName || event.user)) || "Chatter";
        let userId = user.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let rewardTitle = (event && (event.rewardTitle || event.title || "Recompensa")) || "Recompensa";
        let userInput = (event && (event.message || event.userInput)) || "";
        let color = userColorsMemory[userId] || "#ff007f";

        asegurarUsuarioDB(userId, user);
        // Bono de +250 monedas del hipódromo por canjear puntos del canal
        hallOfFame[userId].points += 250;
        guardarDatosNube();

        // Siempre sale una corredora aleatoria en modo Happy desde detrás de la cámara
        activarCamaraPeek(user, "🎁 " + rewardTitle.substring(0, 14), color);

        // Si el canje trae texto (ej. TTS o mensaje destacado), también sale abajo a la derecha
        if (userInput && userInput.trim().length > 0) {
            activarTTSRunner(user, userInput, color);
        }

        // Si hay una carrera en lobby, lo mete gratis al pozo
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
    let color = (data.tags && data.tags.color) ? data.tags.color : "#FFFFFF";

    // Guardamos su color en memoria y le damos +5 puntos por participar en el chat
    userColorsMemory[userId] = color;
    asegurarUsuarioDB(userId, displayName);
    hallOfFame[userId].points += 5;

    // Verificar permisos (Streamer o Mod)
    let isModOrBroadcaster = false;
    if (data.tags && data.tags.badges) {
        isModOrBroadcaster = data.tags.badges.includes("broadcaster") || data.tags.badges.includes("moderator");
    }
    if (data.tags && (data.tags.mod === "1" || data.tags.mod === true)) {
        isModOrBroadcaster = true;
    }

    // -----------------------------------------------------
    // A. DETECCIÓN DE SOUNDALERTS TTS EN EL CHAT
    // -----------------------------------------------------
    if (userId === "soundalerts" || displayName.toLowerCase() === "soundalerts") {
        // SoundAlerts suele enviar: "Usuario played Sonido: Mensaje" o "Usuario: Mensaje"
        let matchUser = text.split(" ")[0] || displayName;
        let cleanId = matchUser.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let savedColor = userColorsMemory[cleanId] || "#00e5ff";
        activarTTSRunner(matchUser, text, savedColor);
        return;
    }

    // Comando manual para probar o forzar el TTS (!tts mensaje)
    if (text.toLowerCase().startsWith("!tts ")) {
        let ttsMsg = text.substring(5).trim();
        if (ttsMsg) activarTTSRunner(displayName, ttsMsg, color);
        return;
    }

    // -----------------------------------------------------
    // B. COMANDO !LURK (Sale corredora aleatoria en modo Happy detrás de la cámara)
    // -----------------------------------------------------
    if (text.toLowerCase().startsWith("!lurk")) {
        activarCamaraPeek(displayName, "💤 !LURK", color);
        return;
    }

    // -----------------------------------------------------
    // C. COMANDO !ANUNCIO (Corredora caminando con cartel detrás)
    // -----------------------------------------------------
    if (text.toLowerCase().startsWith("!anuncio ")) {
        if (!isModOrBroadcaster) return;
        let anuncioTexto = text.substring(9).trim();
        if (anuncioTexto.length > 0) {
            lanzarAnuncio(anuncioTexto);
        }
        return;
    }

    // -----------------------------------------------------
    // D. COMANDO !TOP / !TABLA / !PUNTOS
    // -----------------------------------------------------
    if (text.toLowerCase() === "!top" || text.toLowerCase() === "!tabla") {
        mostrarTablaTemporal();
        return;
    }

    // -----------------------------------------------------
    // E. COMANDOS DEL MINIJUEGO DE CARRERA (!carrera y !p)
    // -----------------------------------------------------
    let lower = text.toLowerCase();

    // Iniciar Carrera: !carrera free | !carrera apuesta
    if (lower.startsWith("!carrera")) {
        if (!isModOrBroadcaster) return;
        if (raceState !== "IDLE") return;

        if (lower.includes("apuesta")) {
            abrirLobbyCarrera("BET");
        } else {
            abrirLobbyCarrera("FREE");
        }
        return;
    }

    // Unirse a la carrera: !p o !p 200
    if (lower === "!p" || lower.startsWith("!p ")) {
        if (raceState !== "LOBBY") return;

        let partes = text.split(" ");
        let monto = parseInt(partes[1], 10);
        if (isNaN(monto) || monto <= 0) monto = 100; // Apuesta base por defecto

        unirseACarrera(userId, displayName, color, monto, false);
        return;
    }

    // Si la carrera está en curso (RACING), cualquier mensaje del corredor en el chat le da BOOST
    if (raceState === "RACING" && raceRunners[userId]) {
        let runner = raceRunners[userId];
        let now = Date.now();
        if (now - runner.lastBoost >= IG_BOOST_COOLDOWN) {
            // Boost fuerte: quien no escriba se queda súper atrás
            runner.speed = Math.min(24, runner.speed + 11);
            runner.lastBoost = now;
        }
    }
}

// =========================================================
// 1. LÓGICA: SALIDA DETRÁS DEL MARCO DE CÁMARA (!lurk & Canjes)
// =========================================================
function activarCamaraPeek(username, badgeText, userColor) {
    const actor = document.getElementById("cam-peek-actor");
    const img = document.getElementById("peek-img");
    const badge = document.getElementById("peek-badge");
    const userEl = document.getElementById("peek-user");

    // Selección 100% aleatoria (no se puede elegir cuál sale)
    const randomChar = getRandomCharacter();

    if (peekTimeout) clearTimeout(peekTimeout);
    actor.classList.remove("active");

    setTimeout(() => {
        // Modo Happy (victoria)
        img.src = randomChar.victoria;
        badge.innerText = badgeText;
        userEl.innerText = username;
        actor.style.setProperty('--peek-color', userColor || "#ff007f");

        actor.classList.add("active");

        peekTimeout = setTimeout(() => {
            actor.classList.remove("active");
        }, 5500);
    }, 150);
}

// =========================================================
// 2. LÓGICA: ANUNCIOS CAMINANDO (!anuncio)
// =========================================================
function lanzarAnuncio(mensaje) {
    const track = document.getElementById("announcement-track");
    const randomChar = getRandomCharacter();
    // Dirección aleatoria: izquierda->derecha o derecha->izquierda
    const dir = Math.random() < 0.5 ? "dir-right" : "dir-left";

    const group = document.createElement("div");
    group.className = `announcer-group ${dir}`;

    // El anuncio va detrás de la corredora gracias a flex-direction en el CSS
    group.innerHTML = `
        <img class="announcer-runner" src="${randomChar.correrLento}" alt="Runner">
        <div class="announcer-rope"></div>
        <div class="announcer-banner">📢 ${mensaje}</div>
    `;

    track.appendChild(group);

    // Limpiar del DOM al terminar de cruzar (12.5s)
    setTimeout(() => {
        group.remove();
    }, 12500);
}

// =========================================================
// 3. LÓGICA: SOUNDALERTS TTS (Entra caminando -> Habla en modo Stand)
// =========================================================
function activarTTSRunner(username, mensaje, colorStr) {
    const actor = document.getElementById("tts-actor");
    const img = document.getElementById("tts-img");
    const bubble = document.getElementById("tts-bubble");
    const authorEl = document.getElementById("tts-author");
    const textEl = document.getElementById("tts-text");

    // Corredora según el color del usuario de Twitch
    const charData = getCharacterByColor(colorStr);

    if (ttsTimeout) clearTimeout(ttsTimeout);

    // Resetear posición fuera de pantalla
    actor.classList.remove("walk-in", "standing");
    bubble.classList.remove("visible");

    setTimeout(() => {
        // Paso 1: Entra caminando
        img.src = charData.correrLento;
        authorEl.innerText = username;
        textEl.innerText = mensaje;
        bubble.style.setProperty('--tts-color', colorStr || "#ff007f");

        actor.classList.add("walk-in");

        // Paso 2: Al llegar a la esquina (1.1s), pasa a modo Stand y abre la burbuja para leerlo
        setTimeout(() => {
            actor.classList.add("standing");
            img.src = charData.frente; // Modo Stand
            bubble.classList.add("visible");
        }, 1100);

        // Paso 3: Tiempo de lectura proporcional al largo del texto (mínimo 6s, máximo 14s)
        let readDuration = Math.min(14000, Math.max(6500, mensaje.length * 110));

        ttsTimeout = setTimeout(() => {
            bubble.classList.remove("visible");
            actor.classList.remove("standing");
            img.src = charData.correrLento;
            actor.classList.remove("walk-in");
        }, 1100 + readDuration);
    }, 150);
}

// =========================================================
// 4. LÓGICA: MINIJUEGO DE CARRERA MEJORADO (!carrera free / apuesta)
// =========================================================
function abrirLobbyCarrera(modo) {
    raceState = "LOBBY";
    raceMode = modo;
    racePot = 0;
    raceRunners = {};
    raceTimer = 35; // 35 segundos para inscribirse con !p

    document.getElementById("ingame-runners-container").innerHTML = "";
    document.getElementById("ingame-finish-line").classList.remove("show");
    document.getElementById("ingame-race-wrapper").classList.remove("hidden");

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
                iniciarCarreraIngame();
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

function unirseACarrera(userId, displayName, colorStr, monto, esCanjeCanal) {
    if (raceRunners[userId]) return; // Ya está inscrito

    asegurarUsuarioDB(userId, displayName);

    if (raceMode === "BET" && !esCanjeCanal) {
        // Verificar fondos del usuario
        if (hallOfFame[userId].points < monto) {
            monto = hallOfFame[userId].points; // All-in si tiene menos
        }
        if (monto <= 0) {
            // Si se quedó en 0, le damos 50 de rescate para que no quede fuera
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

    const container = document.getElementById("ingame-runners-container");
    const charData = getCharacterByColor(colorStr);
    const laneY = Math.floor(Math.random() * 95);

    const box = document.createElement("div");
    box.className = "ig-runner-box";
    box.id = `ig-runner-${userId}`;
    box.style.bottom = (laneY + 8) + "px";
    box.style.left = "60px";
    box.style.zIndex = 200 - laneY;
    box.style.setProperty('--user-color', colorStr || "#FFFFFF");

    box.innerHTML = `
        <div class="ig-runner-name">${displayName}</div>
        <div class="ig-stamina-bar">
            <div class="ig-stamina-fill" id="ig-stamina-${userId}"></div>
        </div>
        <img class="ig-runner-img" id="ig-img-${userId}" src="${charData.frente}">
    `;

    container.appendChild(box);

    raceRunners[userId] = {
        element: box,
        sprites: charData,
        x: 0,
        speed: 0,
        state: "frente",
        lastBoost: 0,
        displayName: displayName,
        bet: monto
    };
}

function iniciarCarreraIngame() {
    if (Object.keys(raceRunners).length === 0) {
        // Nadie entró, cerramos pista
        cerrarCarreraIngame();
        return;
    }

    raceState = "RACING";
    raceTimer = 60; // 60 segundos máximos o hasta que alguien cruce GOAL_DISTANCE

    document.getElementById("race-status-title").innerText = "🔥 ¡EN MARCHA!";
    document.getElementById("race-status-sub").innerHTML = `¡Escribe en el chat para <span class="cmd-highlight">BOOSTEAR</span> o te quedarás atrás!`;

    let now = Date.now();
    for (let u in raceRunners) {
        raceRunners[u].speed = 7; // Salida inicial
        raceRunners[u].lastBoost = now - IG_BOOST_COOLDOWN; // Boost listo desde el segundo 1
        raceRunners[u].state = "correrLento";
        let img = document.getElementById(`ig-img-${u}`);
        if (img) img.src = raceRunners[u].sprites.correrLento;
    }
}

function updateIngameRace() {
    if (raceState !== "RACING") return;

    let maxDist = 0;
    let now = Date.now();
    let someoneReachedGoal = false;

    // 1. Físicas con desaceleración fuerte: si no boostean, se quedan casi parados (0.6)
    for (let u in raceRunners) {
        let r = raceRunners[u];
        if (r.speed > 0.6) {
            r.speed = Math.max(0.6, r.speed - 0.55); // Frena rápido si no chatea
        }
        r.x += r.speed;
        if (r.x > maxDist) maxDist = r.x;
        if (r.x >= GOAL_DISTANCE) someoneReachedGoal = true;
    }

    // 2. Renderizado con brecha real grande (las que no boostean se quedan súper atrás)
    for (let u in raceRunners) {
        let r = raceRunners[u];

        // A diferencia del iniciando, aquí la cámara avanza con el líder pero permite
        // que los rezagados caigan hasta -400px (fuera de cámara a la izquierda)
        let leaderScreenX = Math.min(1480, 120 + (maxDist * 0.65));
        let distanceBehindLeader = maxDist - r.x;
        let screenX = leaderScreenX - (distanceBehindLeader * 1.15);

        r.element.style.left = Math.max(-180, screenX) + "px";

        // Animación según velocidad
        let targetState = r.speed > 5.5 ? "correrTurbo" : "correrLento";
        if (r.state !== targetState) {
            r.state = targetState;
            let img = document.getElementById(`ig-img-${u}`);
            if (img) img.src = r.sprites[targetState];
        }

        // Barra de estamina
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

    // Encontrar ganadora
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
            asegurarUsuarioDB(winnerId, w.displayName);
            hallOfFame[winnerId].wins += 1;

            let premioTexto = "";
            if (raceMode === "BET" && racePot > 0) {
                hallOfFame[winnerId].points += racePot;
                premioTexto = ` (+${racePot} PTS)`;
            } else {
                hallOfFame[winnerId].points += 150;
                premioTexto = ` (+150 PTS)`;
            }
            guardarDatosNube();

            document.getElementById("race-status-title").innerText = `🥇 GANADORA: ${w.displayName.toUpperCase()}`;
            document.getElementById("race-status-sub").innerText = `¡Victoria registrada en el Hall of Fame!${premioTexto}`;
        }

        for (let u in raceRunners) {
            let img = document.getElementById(`ig-img-${u}`);
            if (!img) continue;
            if (u === winnerId) {
                raceRunners[u].element.style.left = "1620px";
                img.src = raceRunners[u].sprites.victoria;
            } else {
                img.src = raceRunners[u].sprites.frente;
            }
        }

        // Mostramos la tabla de clasificación actualizada
        mostrarTablaTemporal();

        // Ocultar la pista después de 8 segundos
        setTimeout(() => {
            cerrarCarreraIngame();
        }, 8000);
    }, 650);
}

function cerrarCarreraIngame() {
    if (raceInterval) clearInterval(raceInterval);
    raceState = "IDLE";
    document.getElementById("ingame-race-wrapper").classList.add("hidden");
}

function actualizarRelojCarrera() {
    let min = Math.floor(raceTimer / 60).toString().padStart(2, '0');
    let sec = (raceTimer % 60).toString().padStart(2, '0');
    document.getElementById("race-timer").innerText = `${min}:${sec}`;
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
