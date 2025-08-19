// --- DOM ELEMENT REFERENCES ---
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const rayTracerCanvas = document.getElementById('rayTracerCanvas');
const rayCtx = rayTracerCanvas.getContext('2d');
const rayTracerContainer = document.getElementById('rayTracerContainer');

// Controls
const stringTensionSlider = document.getElementById('stringTension');
const stringDistSlider = document.getElementById('stringDistance');
const sourceDistSlider = document.getElementById('sourceDistance');
const velXSlider = document.getElementById('velocityX');
const velYSlider = document.getElementById('velocityY');

// Value Displays
const gmuValueDisplay = document.getElementById('gmuValue');
const stringDistValueDisplay = document.getElementById('stringDistValue');
const sourceDistValueDisplay = document.getElementById('sourceDistValue');
const velXValueDisplay = document.getElementById('velXValue');
const velYValueDisplay = document.getElementById('velYValue');

// Analysis Panel
const logText = document.getElementById('logText');
const deficitAngleValue = document.getElementById('deficitAngleValue');
const imageSeparationValue = document.getElementById('imageSeparationValue');
const brightnessRatioValue = document.getElementById('brightnessRatioValue');
const toggleRayTracer = document.getElementById('toggleRayTracer');

// --- SIMULATION STATE ---
const simState = {
    gmu: Math.pow(10, parseFloat(stringTensionSlider.value)),
    stringDistance: parseFloat(stringDistSlider.value), // Gpc
    sourceDistance: parseFloat(sourceDistSlider.value), // Gpc
    velocityX: parseFloat(velXSlider.value), // fraction of c
    velocityY: parseFloat(velYSlider.value), // fraction of c
    string: { start: null, end: null, active: false, vector: null, normal: null, length: 0 },
    galaxies: [],
    stars: [],
    isDragging: false,
    tempStringEnd: null,
    selectedGalaxy: null,
};

const GALAXY_COUNT = 150;
const STAR_COUNT = 500;

// --- INITIALIZATION ---
function setupCanvas() {
    const container = document.querySelector('.simulation-window');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const rayRect = rayTracerContainer.getBoundingClientRect();
    rayTracerCanvas.width = rayRect.width * dpr;
    rayTracerCanvas.height = rayRect.height * dpr;
    rayCtx.scale(dpr, dpr);
}

function generateStars() {
    simState.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        simState.stars.push({
            x: Math.random(), // 0 to 1
            y: Math.random(), // 0 to 1
            size: Math.random() * 1.5,
            brightness: Math.random() * 0.8 + 0.2
        });
    }
}

function generateGalaxies() {
    simState.galaxies = [];
    const galaxyTypes = ['spiral', 'elliptical'];
    const colors = ['#ccd8ff', '#fff0cc', '#ffcccc'];
    for (let i = 0; i < GALAXY_COUNT; i++) {
        simState.galaxies.push({
            id: i,
            x: Math.random(), // 0 to 1
            y: Math.random(), // 0 to 1
            size: Math.random() * 15 + 5,
            angle: Math.random() * Math.PI * 2,
            type: galaxyTypes[Math.floor(Math.random() * galaxyTypes.length)],
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

// --- EVENT LISTENERS ---
function initEventListeners() {
    window.addEventListener('resize', () => {
        setupCanvas();
        draw();
    });

    stringTensionSlider.addEventListener('input', handleControlChange);
    stringDistSlider.addEventListener('input', handleControlChange);
    sourceDistSlider.addEventListener('input', handleControlChange);
    velXSlider.addEventListener('input', handleControlChange);
    velYSlider.addEventListener('input', handleControlChange);

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    toggleRayTracer.addEventListener('change', (e) => {
        rayTracerContainer.style.display = e.target.checked ? 'block' : 'none';
        draw();
    });

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                if (pane.id === tabId) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });
}

function handleControlChange() {
    simState.gmu = Math.pow(10, parseFloat(stringTensionSlider.value));
    simState.stringDistance = parseFloat(stringDistSlider.value);
    simState.sourceDistance = parseFloat(sourceDistSlider.value);

    // Ensure source is always farther than string
    if (simState.sourceDistance <= simState.stringDistance) {
        simState.sourceDistance = simState.stringDistance + 0.1;
        sourceDistSlider.value = simState.sourceDistance;
    }

    simState.velocityX = parseFloat(velXSlider.value);
    simState.velocityY = parseFloat(velYSlider.value);

    updateDisplays();
    draw();
}

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function handleMouseDown(e) {
    const pos = getMousePos(e);
    simState.isDragging = true;
    simState.string.start = pos;
    simState.string.end = pos;
    simState.string.active = false;
    logText.textContent = "Dragging to position the cosmic string...";
}

function handleMouseMove(e) {
    if (!simState.isDragging) return;
    const pos = getMousePos(e);
    simState.string.end = pos;
    draw(); // Redraw to show the line being dragged
}

function handleMouseUp(e) {
    if (!simState.isDragging) return;
    simState.isDragging = false;
    const pos = getMousePos(e);
    simState.string.end = pos;

    if (simState.string.start.x === simState.string.end.x && simState.string.start.y === simState.string.end.y) {
        simState.string.active = false;
        logText.textContent = "String placement cancelled. Click and drag to place a string.";
    } else {
        simState.string.active = true;
        const vecX = simState.string.end.x - simState.string.start.x;
        const vecY = simState.string.end.y - simState.string.start.y;
        const len = Math.sqrt(vecX*vecX + vecY*vecY);
        simState.string.vector = { x: vecX / len, y: vecY / len };
        simState.string.normal = { x: -vecY / len, y: vecX / len };
        simState.string.length = len;
        logText.textContent = "Cosmic string placed. Background objects are now being lensed. Observe the duplicated images.";
    }
    draw();
}

function handleMouseLeave(e) {
    if (simState.isDragging) {
        simState.isDragging = false;
        simState.string.active = false;
        logText.textContent = "String placement cancelled. Click and drag to place a string.";
        draw();
    }
}

// --- RENDERING ---
function draw() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    ctx.fillStyle = '#FFF';
    simState.stars.forEach(star => {
        ctx.beginPath();
        ctx.globalAlpha = star.brightness;
        ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw galaxies and lensing
    drawGalaxies(w, h);

    // Draw string
    if (simState.string.active || simState.isDragging) {
        ctx.beginPath();
        ctx.moveTo(simState.string.start.x, simState.string.start.y);
        ctx.lineTo(simState.string.end.x, simState.string.end.y);
        ctx.strokeStyle = simState.string.active ? 'rgba(255, 170, 123, 0.7)' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (toggleRayTracer.checked) {
        drawRayTracer();
    }
}

function drawGalaxy(x, y, galaxy, brightness = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(galaxy.angle);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, galaxy.size * 0.7);
    grad.addColorStop(0, `rgba(255, 255, 255, ${brightness * 0.8})`);
    grad.addColorStop(0.3, `${galaxy.color}${Math.floor(brightness * 255).toString(16).padStart(2, '0')}`);
    grad.addColorStop(1, `${galaxy.color}00`);

    ctx.fillStyle = grad;

    if (galaxy.type === 'elliptical') {
        ctx.scale(1, 0.6);
    }

    ctx.beginPath();
    ctx.arc(0, 0, galaxy.size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    if (galaxy.type === 'spiral') {
        ctx.lineWidth = Math.max(1, galaxy.size / 10);
        ctx.strokeStyle = grad;
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, galaxy.size * 0.5, i * Math.PI, (i + 1.5) * Math.PI);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawGalaxies(w, h) {
    simState.galaxies.forEach(galaxy => {
        const gx = galaxy.x * w;
        const gy = galaxy.y * h;
        let lensed = false;

        if (simState.string.active) {
            const { start, vector, normal } = simState.string;
            // Vector from string start to galaxy
            const galVec = { x: gx - start.x, y: gy - start.y };

            // Project galaxy vector onto string vector to find position along string
            const dotProd = galVec.x * vector.x + galVec.y * vector.y;

            // Check if galaxy is within the segment of the string
            if (dotProd > 0 && dotProd < simState.string.length) {
                // Project galaxy vector onto string normal to find distance from string
                const distFromStr = galVec.x * normal.x + galVec.y * normal.y;

                if (Math.abs(distFromStr) > 0) {
                    lensed = true;
                    const deficitAngle = 8 * Math.PI * simState.gmu;
                    const distanceRatio = (simState.sourceDistance - simState.stringDistance) / simState.sourceDistance;
                    const separationAnglePixels = (deficitAngle / 2) * distanceRatio * w; // Simplified pixel separation

                    const pos1_x = gx - separationAnglePixels * normal.x;
                    const pos1_y = gy - separationAnglePixels * normal.y;

                    const pos2_x = gx + separationAnglePixels * normal.x;
                    const pos2_y = gy + separationAnglePixels * normal.y;

                    // Kaiser-Stebbins Effect
                    const v_total = Math.sqrt(simState.velocityX**2 + simState.velocityY**2);
                    let brightness1 = 1.0;
                    let brightness2 = 1.0;
                    let ratio = 1.0;

                    if (v_total > 0) {
                        // Velocity component perpendicular to string
                        const v_perp_to_string = simState.velocityX * normal.x + simState.velocityY * normal.y;
                        const lorentz = 1 / Math.sqrt(1 - v_total**2);
                        const boost = 4 * Math.PI * simState.gmu * lorentz * v_perp_to_string;

                        // This is an exaggeration for visual effect
                        const visualBoost = Math.tanh(boost * 1e6);
                        brightness1 = 1 + visualBoost;
                        brightness2 = 1 - visualBoost;

                        if (brightness2 > 0) {
                            ratio = brightness1 / brightness2;
                        } else {
                            ratio = Infinity;
                        }
                    }

                    drawGalaxy(pos1_x, pos1_y, galaxy, brightness1);
                    drawGalaxy(pos2_x, pos2_y, galaxy, brightness2);

                    // Update analysis panel if this is a prominent lensed object
                    if (galaxy.size > 18 && simState.selectedGalaxy !== galaxy) {
                        simState.selectedGalaxy = galaxy;
                        updateAnalysisPanel(deficitAngle, separationAnglePixels / w, ratio);
                    }
                }
            }
        }

        if (!lensed) {
            drawGalaxy(gx, gy, galaxy);
        }
    });
}

function drawRayTracer() {
    const w = rayTracerCanvas.width / (window.devicePixelRatio || 1);
    const h = rayTracerCanvas.height / (window.devicePixelRatio || 1);
    rayCtx.clearRect(0, 0, rayTracerCanvas.width, rayTracerCanvas.height);

    const observerX = w * 0.1;
    const sourceX = w * 0.9;
    const stringX = w * (0.1 + 0.8 * (simState.stringDistance / simState.sourceDistance));

    const y_mid = h / 2;

    // Draw Observer
    rayCtx.fillStyle = '#77aaff';
    rayCtx.beginPath();
    rayCtx.arc(observerX, y_mid, 5, 0, 2 * Math.PI);
    rayCtx.fill();
    rayCtx.fillText("Observer", observerX - 20, y_mid + 20);

    // Draw Source
    rayCtx.fillStyle = '#ffcc77';
    rayCtx.beginPath();
    rayCtx.arc(sourceX, y_mid, 5, 0, 2 * Math.PI);
    rayCtx.fill();
    rayCtx.fillText("Source", sourceX - 15, y_mid + 20);

    // Draw String
    rayCtx.strokeStyle = 'var(--accent-color)';
    rayCtx.lineWidth = 2;
    rayCtx.beginPath();
    rayCtx.moveTo(stringX, y_mid - 20);
    rayCtx.lineTo(stringX, y_mid + 20);
    rayCtx.stroke();
    rayCtx.fillText("String", stringX - 15, y_mid - 25);

    // Draw Light Paths
    const deficitAngle = 8 * Math.PI * simState.gmu;
    const y_offset = h * 0.1 * deficitAngle / (1e-6); // Exaggerated offset

    rayCtx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
    rayCtx.lineWidth = 1;
    rayCtx.setLineDash([2, 2]);

    // Path 1
    rayCtx.beginPath();
    rayCtx.moveTo(sourceX, y_mid);
    rayCtx.lineTo(stringX, y_mid - y_offset);
    rayCtx.lineTo(observerX, y_mid);
    rayCtx.stroke();

    // Path 2
    rayCtx.beginPath();
    rayCtx.moveTo(sourceX, y_mid);
    rayCtx.lineTo(stringX, y_mid + y_offset);
    rayCtx.lineTo(observerX, y_mid);
    rayCtx.stroke();

    rayCtx.setLineDash([]);
}


// --- UI UPDATES ---
function updateDisplays() {
    gmuValueDisplay.textContent = simState.gmu.toExponential(1);
    stringDistValueDisplay.textContent = `${simState.stringDistance.toFixed(1)} Gpc`;
    sourceDistValueDisplay.textContent = `${simState.sourceDistance.toFixed(1)} Gpc`;
    velXValueDisplay.textContent = `${simState.velocityX.toFixed(2)} c`;
    velYValueDisplay.textContent = `${simState.velocityY.toFixed(2)} c`;
}

function updateAnalysisPanel(deficitAngleRad, separationRad, ratio) {
    // Convert radians to micro-arcseconds (μas) and arcseconds
    const ARCSEC_PER_RAD = 206265;
    const deficit_uas = deficitAngleRad * ARCSEC_PER_RAD * 1e6;
    const separation_as = separationRad * ARCSEC_PER_RAD;

    deficitAngleValue.textContent = `${deficit_uas.toExponential(2)} μas`;
    imageSeparationValue.textContent = `${separation_as.toFixed(3)} arcsec`;
    brightnessRatioValue.textContent = ratio.toFixed(3);
}

// --- MAIN ---
function init() {
    setupCanvas();
    generateStars();
    generateGalaxies();
    initEventListeners();
    updateDisplays();
    draw();
}

init();
