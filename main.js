import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Basic Setup ---
const simWindow = document.getElementById('simulation-window');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, simWindow.clientWidth / simWindow.clientHeight, 0.1, 10000);
camera.position.set(0, 50, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true });
simWindow.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

// --- Simulation State & Parameters ---
let SIM_STATE = {};
const universeBox = new THREE.Box3();
const boxHelper = new THREE.Box3Helper(universeBox, 0x555555);
scene.add(boxHelper);

let strings = [];
let loops = [];
let history = {};

function resetState() {
    Object.assign(SIM_STATE, {
        isPaused: true,
        time: 1,
        scaleFactor: 1,
        boxSize: 100,
        expansionModel: document.getElementById('expansion-select').value,
        loopFormationEfficiency: parseFloat(document.getElementById('loop-eff-slider').value) / 100,
        gravitationalBackReaction: parseFloat(document.getElementById('g-back-reaction-slider').value),
        tension: 1.0,
        hubbleFriction: 0.1,
        stepsSincePlot: 0,
    });
    history = { time: [], scalingParam: [], loopCount: [], stringDensity: [], backgroundDensity: [] };
}

class CosmicString {
    constructor(points) {
        this.points = points;
        this.velocities = this.points.map(() => new THREE.Vector3());
        this.id = Math.random();
        const curve = new THREE.CatmullRomCurve3(this.points);
        const geometry = new THREE.TubeGeometry(curve, 32, 0.3, 8, false);
        const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);
    }
    updateGeometry() {
        if (this.points.length < 2) { this.dispose(); return; }
        this.mesh.geometry.dispose();
        this.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.points), 32, 0.3, 8, false);
    }
    dispose() {
        if(this.mesh.geometry) this.mesh.geometry.dispose();
        if(this.mesh.material) this.mesh.material.dispose();
        scene.remove(this.mesh);
    }
}

function generateInitialNetwork() {
    resetState();

    // Manually reset the UI elements to their initial state
    document.getElementById('scaling-param').textContent = 'N/A';
    const canvasIds = ['scaling-plot-canvas', 'loop-plot-canvas', 'energy-plot-canvas'];
    canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });

    strings.forEach(s => s.dispose());
    strings = [];
    loops.forEach(l => l.dispose());
    loops = [];

    const density = parseInt(document.getElementById('density-slider').value);
    const pointsPerString = 30;
    const stepSize = SIM_STATE.boxSize / pointsPerString * 2;

    for (let i = 0; i < density; i++) {
        const points = [];
        let currentPoint = new THREE.Vector3((Math.random()-0.5)*SIM_STATE.boxSize, (Math.random()-0.5)*SIM_STATE.boxSize, (Math.random()-0.5)*SIM_STATE.boxSize);
        points.push(currentPoint.clone());
        for (let j = 0; j < pointsPerString; j++) {
            const randomStep = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(stepSize);
            currentPoint.add(randomStep);
            points.push(currentPoint.clone());
        }
        strings.push(new CosmicString(points));
    }
}

function updatePhysics() {
    const dt = 0.1;
    SIM_STATE.time += dt;

    const a_prev = SIM_STATE.scaleFactor;
    if (SIM_STATE.expansionModel === 'radiation') {
        SIM_STATE.scaleFactor = Math.sqrt(SIM_STATE.time);
    } else {
        SIM_STATE.scaleFactor = Math.pow(SIM_STATE.time, 2/3);
    }
    const scaleChange = SIM_STATE.scaleFactor / a_prev;
    const H = (SIM_STATE.scaleFactor - a_prev) / (a_prev * dt);
    SIM_STATE.hubbleFriction = 2 * H;

    strings.forEach(s => s.points.forEach(p => p.multiplyScalar(scaleChange)));

    const halfSize = SIM_STATE.boxSize * SIM_STATE.scaleFactor / 2;
    universeBox.set(new THREE.Vector3(-halfSize, -halfSize, -halfSize), new THREE.Vector3(halfSize, halfSize, halfSize));

    strings.forEach(string => {
        const forces = string.points.map(() => new THREE.Vector3());
        for (let i = 1; i < string.points.length - 1; i++) {
            const force = string.points[i-1].clone().add(string.points[i+1]).sub(string.points[i].clone().multiplyScalar(2)).multiplyScalar(SIM_STATE.tension);
            forces[i].add(force);
        }
        for (let i = 0; i < string.points.length; i++) {
            const friction = string.velocities[i].clone().multiplyScalar(-SIM_STATE.hubbleFriction);
            forces[i].add(friction);
            if(SIM_STATE.gravitationalBackReaction > 0) {
                const backReactionForce = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(SIM_STATE.gravitationalBackReaction * 0.1);
                forces[i].add(backReactionForce);
            }
            string.velocities[i].add(forces[i].multiplyScalar(dt));
            string.points[i].add(string.velocities[i].clone().multiplyScalar(dt));
        }
        string.updateGeometry();
    });

    if(Math.random() < 0.05) {
        const s = strings[Math.floor(Math.random() * strings.length)];
        if (s && s.points.length > 10 && Math.random() < SIM_STATE.loopFormationEfficiency) {
            const i = 1, j = s.points.length - 2;
            if (s.points[i].distanceTo(s.points[j]) < 5.0 * SIM_STATE.scaleFactor) {
                const loopPoints = s.points.splice(i, j - i);
                loops.push(new CosmicString(loopPoints));
                s.updateGeometry();
            }
        }
    }

    if (++SIM_STATE.stepsSincePlot > 10) {
        updatePlots();
        SIM_STATE.stepsSincePlot = 0;
    }
}

function updatePlots() {
    const V = Math.pow(SIM_STATE.boxSize * SIM_STATE.scaleFactor, 3);
    let L_total = 0;
    strings.forEach(s => { for(let i=0; i<s.points.length-1; i++) L_total += s.points[i].distanceTo(s.points[i+1]); });

    const L = L_total > 0 ? Math.sqrt(V / L_total) : 0;
    const scalingParam = L / SIM_STATE.time;
    document.getElementById('scaling-param').textContent = scalingParam.toFixed(3);

    history.time.push(SIM_STATE.time);
    history.scalingParam.push(scalingParam);
    history.loopCount.push(loops.length);

    const rho_s = L_total / V;
    const rho_b = SIM_STATE.expansionModel === 'radiation' ? 1/Math.pow(SIM_STATE.scaleFactor, 4) : 1/Math.pow(SIM_STATE.scaleFactor, 3);
    history.stringDensity.push(rho_s);
    history.backgroundDensity.push(rho_b);

    drawPlot('scaling-plot-canvas', history.time, [history.scalingParam]);
    drawPlot('loop-plot-canvas', history.time, [history.loopCount]);
    drawPlot('energy-plot-canvas', history.time, [history.stringDensity, history.backgroundDensity], true);
}

function drawPlot(canvasId, xData, yDataSets, loglog=false) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const w=canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle = '#555'; ctx.strokeRect(0,0,w,h);

    if (xData.length === 0) return;

    const xMax = Math.max(...xData);
    const yMax = Math.max(...yDataSets.map(d => Math.max(...d)).filter(v => isFinite(v)));

    if (!isFinite(yMax)) return;

    yDataSets.forEach((yData, idx) => {
        ctx.strokeStyle = idx === 0 ? 'var(--accent-color)' : 'orange';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<xData.length; i++) {
            let x, y;
            if(loglog) {
                const logX = Math.log10(xData[i] || 1);
                const logY = Math.log10(yData[i] || 1e-10);
                const logXMax = Math.log10(xMax || 1);
                const logYMax = Math.log10(yMax || 1);
                x = (logX / logXMax) * w;
                y = h - (logY / logYMax) * h;
            } else {
                x = xData[i] / xMax * w;
                y = h - yData[i] / yMax * h;
            }
            if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
    });
}

// --- Resize Handling ---
const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0];
    const { width, height } = entry.contentRect;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
resizeObserver.observe(simWindow);

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    if (!SIM_STATE.isPaused) {
        updatePhysics();
    }
    controls.update();
    renderer.render(scene, camera);
}
animate();

// --- UI Listeners ---
document.getElementById('start-sim-btn').addEventListener('click', () => { SIM_STATE.isPaused = !SIM_STATE.isPaused; });
document.getElementById('reset-sim-btn').addEventListener('click', generateInitialNetwork);
document.getElementById('density-slider').addEventListener('input', e => { document.getElementById('density-readout').textContent = e.target.value; });
document.getElementById('loop-eff-slider').addEventListener('input', e => {
    SIM_STATE.loopFormationEfficiency = parseFloat(e.target.value) / 100;
    document.getElementById('loop-eff-readout').textContent = `${e.target.value}%`;
});
document.getElementById('g-back-reaction-slider').addEventListener('input', e => {
    SIM_STATE.gravitationalBackReaction = parseFloat(e.target.value);
    document.getElementById('g-back-reaction-readout').textContent = e.target.value;
});
document.getElementById('expansion-select').addEventListener('change', e => { SIM_STATE.expansionModel = e.target.value; });

generateInitialNetwork();
console.log("Scaling Solution Simulator Initialized.");
