import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

const CONFIG = {
    CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    API_KEY: import.meta.env.VITE_GOOGLE_API_KEY, 
    SPREADSHEET_ID: import.meta.env.VITE_GOOGLE_SHEET_ID, 
    RANGE: 'Sheet1!A2:F', 
};

let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function startApp() {
    console.log("Loading necessary libraries...");
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js');
        console.log("TWEEN animation library loaded successfully!");

        await loadScript('https://apis.google.com/js/api.js');
        await loadScript('https://accounts.google.com/gsi/client');
        
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });

        initGisClient();
        console.log("All libraries loaded, ready to log in.");
        
        const authContainer = document.getElementById('auth-container');
        if (authContainer) authContainer.style.display = 'flex'; 

    } catch (err) {
        console.error("Failed to load scripts, please check your network:", err);
    }
}

let tokenClient;
function initGisClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        callback: '', 
    });
    
    const btn = document.getElementById('authorize_button');
    if(btn) btn.onclick = handleAuthClick;
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error) throw resp;
        
        gapi.client.setToken(resp);
        console.log("Login successful!");
        
        document.getElementById('auth-container').style.display = 'none';
        document.body.style.backgroundColor = '#000000'; 
        document.getElementById('container').style.display = 'block';
        
        const menu = document.getElementById('menu');
        if (menu) {
            menu.style.display = 'block';
            menu.style.zIndex = '99999'; 
        }
        
        initThreeJS();
        await fetchSheetData();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

async function fetchSheetData() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: CONFIG.RANGE,
        });
        const rows = response.result.values;
        if (rows && rows.length > 0) {
            console.log(`Got ${rows.length} rows of data, starting to create cards...`);
            createObjects(rows); 
            setTimeout(() => {
                console.log("Initial animation started!");
                transform(targets.table, 2000);
            }, 500);
        }
    } catch (err) {
        console.error("Failed to read data:", err);
    }
}

function getNetWorthColor(netWorthStr) {
    if (!netWorthStr) return 'rgba(0,127,127,'; 
    const value = parseFloat(netWorthStr.replace(/[$,]/g, ""));
    if (value > 200000) return 'rgba(0,255,0,'; 
    if (value > 100000) return 'rgba(255,165,0,'; 
    return 'rgba(255,0,0,'; 
}

function createObjects(data) {
    objects.forEach(obj => scene.remove(obj));
    objects.length = 0;
    targets.table.length = 0;
    targets.sphere.length = 0;
    targets.helix.length = 0;
    targets.grid.length = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row[0];
        const photoUrl = row[1];
        const country = row[3];
        const netWorth = row[5];

        const element = document.createElement('div');
        element.className = 'element';
        
        const baseColor = getNetWorthColor(netWorth);
        element.style.backgroundColor = baseColor + '0.5)'; 
        element.style.boxShadow = `0px 0px 12px ${baseColor}0.5)`;
        element.style.border = `1px solid ${baseColor}0.25)`;
        
        const imgDisplay = photoUrl ? `<img src="${photoUrl}" class="photo">` : '';
        
        element.innerHTML = `
            <div class="name">${name}</div>
            ${imgDisplay}
            <div class="details">${country}<br>${netWorth}</div>
        `;

        const object = new CSS3DObject(element);
        object.position.x = Math.random() * 4000 - 2000;
        object.position.y = Math.random() * 4000 - 2000;
        object.position.z = Math.random() * 4000 - 2000;
        scene.add(object);
        objects.push(object);
    }
    calculateLayouts(objects.length);
}

function calculateLayouts(count) {
    // Table
    for (let i = 0; i < count; i++) {
        const object = new THREE.Object3D();
        const col = i % 20;
        const row = Math.floor(i / 20);
        object.position.x = (col * 140) - 1330;
        object.position.y = -(row * 180) + 990;
        targets.table.push(object);
    }
    // Sphere
    const vector = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        const object = new THREE.Object3D();
        object.position.setFromSphericalCoords(800, phi, theta);
        vector.copy(object.position).multiplyScalar(2);
        object.lookAt(vector);
        targets.sphere.push(object);
    }
    // Helix
    for (let i = 0; i < count; i++) {
        const object = new THREE.Object3D();
        const theta = i * 0.1 + Math.PI * (i % 2); 
        const y = -(i * 30) + 3000; 

        object.position.setFromCylindricalCoords(800, theta, y);
        vector.x = object.position.x * 2;
        vector.y = object.position.y;
        vector.z = object.position.z * 2;
        object.lookAt(vector);

        targets.helix.push(object);
    }
    // Grid
    for (let i = 0; i < count; i++) {
        const object = new THREE.Object3D();
        object.position.x = ((i % 5) * 400) - 800;
        object.position.y = (-(Math.floor(i / 5) % 4) * 400) + 800;
        object.position.z = (Math.floor(i / 20)) * 1000 - 2000;
        targets.grid.push(object);
    }
}

function initThreeJS() {
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 3000; 

    scene = new THREE.Scene();

    renderer = new CSS3DRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    
    const container = document.getElementById('container');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener('change', render);

    document.getElementById('table').addEventListener('click', () => {
        console.log("Click Table");
        transform(targets.table, 2000);
    });
    document.getElementById('sphere').addEventListener('click', () => {
        console.log("Click Sphere");
        transform(targets.sphere, 2000);
    });
    document.getElementById('helix').addEventListener('click', () => {
        console.log("Click Helix");
        transform(targets.helix, 2000);
    });
    document.getElementById('grid').addEventListener('click', () => {
        console.log("Click Grid");
        transform(targets.grid, 2000);
    });

    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function transform(targets, duration) {
    TWEEN.removeAll();

    for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        const target = targets[i];
        if (!target) continue;

        new TWEEN.Tween(object.position)
            .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();

        new TWEEN.Tween(object.rotation)
            .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }
    
    new TWEEN.Tween({})
        .to({}, duration * 2)
        .onUpdate(render)
        .start();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function animate() {
    requestAnimationFrame(animate);
    TWEEN.update(); 
    controls.update();
    scene.rotation.y += 0.0015;
}

function render() {
    renderer.render(scene, camera);
}

startApp();