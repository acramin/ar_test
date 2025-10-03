// COMPLETE AR GAME - REBUILT FROM SCRATCH
// Game Configuration
const CANS_TO_FIND = 3;

// Global Variables
let video, renderer, scene, camera, can;
let currentFacingMode = "environment";
let foundCount = 0;
let gameStarted = false;
let gameCompleted = false;
let foundCan = false;

// Device Orientation (stored in radians)
let deviceOrientation = {
  alpha: 0,  // Compass direction (Z-axis)
  beta: 0,   // Front-to-back tilt (X-axis)
  gamma: 0   // Left-to-right tilt (Y-axis)
};

// Can position in spherical coordinates (easier for AR)
let canSpherical = {
  azimuth: 0,    // Horizontal angle (degrees)
  elevation: 0,  // Vertical angle (degrees)
  distance: 8    // Distance from camera
};

// ============================================
// INITIALIZATION
// ============================================
function init() {
  console.log("🚀 Initializing AR Game");
  
  // Update UI with target count
  document.getElementById("target-count").textContent = CANS_TO_FIND;
  document.getElementById("final-count").textContent = CANS_TO_FIND;
  
  // Setup Three.js
  setupThreeJS();
  
  // Setup device orientation tracking
  setupDeviceOrientation();
  
  // Setup event listeners
  setupEventListeners();
  
  // Start camera
  startCamera();
  
  // Start animation loop
  animate();
  
  // Place first can
  placeNewCan();
  
  console.log("✅ Initialization complete");
}

// ============================================
// THREE.JS SETUP
// ============================================
function setupThreeJS() {
  // Create scene
  scene = new THREE.Scene();
  
  // Create camera with appropriate FOV for mobile AR
  camera = new THREE.PerspectiveCamera(
    75, // Wider FOV for mobile
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0); // Camera at origin
  
  // Create renderer
  renderer = new THREE.WebGLRenderer({ 
    alpha: true, 
    antialias: true 
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById("canvas-container").appendChild(renderer.domElement);
  
  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);
  
  console.log("✅ Three.js setup complete");
}

// ============================================
// CREATE CAN MODEL
// ============================================
function createCan() {
  const group = new THREE.Group();
  
  // Try to load GLB model
  if (typeof THREE.GLTFLoader !== 'undefined') {
    const loader = new THREE.GLTFLoader();
    
    loader.load(
      "./assets/redbull.glb",
      (gltf) => {
        console.log("✅ GLB model loaded");
        const model = gltf.scene;
        model.scale.set(0.3, 0.3, 0.3); // Adjust scale as needed
        group.add(model);
      },
      undefined,
      (error) => {
        console.log("⚠️ GLB load failed, using procedural can");
        createProceduralCan(group);
      }
    );
  } else {
    createProceduralCan(group);
  }
  
  // Add LARGER invisible collision sphere for easier tapping
  const collisionGeo = new THREE.SphereGeometry(1.5, 16, 16); // Increased from 0.8 to 1.5
  const collisionMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    visible: false
  });
  const collisionMesh = new THREE.Mesh(collisionGeo, collisionMat);
  collisionMesh.userData.clickable = true;
  group.add(collisionMesh);
  
  // Mark the entire group as clickable
  group.userData.clickable = true;
  
  scene.add(group);
  return group;
}

function createProceduralCan(group) {
  // Main can body
  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 32);
  const bodyMat = new THREE.MeshPhongMaterial({
    color: 0x1e3a8a,
    shininess: 100
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);
  
  // Top cap
  const topGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 32);
  const topMat = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    shininess: 150
  });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = 0.525;
  group.add(top);
  
  // Label stripe
  const labelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.3, 32);
  const labelMat = new THREE.MeshPhongMaterial({
    color: 0xfbbf24,
    shininess: 80
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.y = 0.1;
  group.add(label);
  
  console.log("✅ Procedural can created");
}

// ============================================
// DEVICE ORIENTATION
// ============================================
function setupDeviceOrientation() {
  // Request permission on iOS 13+
  if (typeof DeviceOrientationEvent !== 'undefined' && 
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
        }
      })
      .catch(console.error);
  } else {
    // Non-iOS or older iOS
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

function handleOrientation(event) {
  if (event.alpha !== null) {
    deviceOrientation.alpha = THREE.MathUtils.degToRad(event.alpha);
  }
  if (event.beta !== null) {
    deviceOrientation.beta = THREE.MathUtils.degToRad(event.beta);
  }
  if (event.gamma !== null) {
    deviceOrientation.gamma = THREE.MathUtils.degToRad(event.gamma);
  }
}

// ============================================
// CAMERA
// ============================================
function startCamera() {
  video = document.getElementById("camera-video");
  
  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };
  
  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      video.srcObject = stream;
      video.play();
      document.getElementById("loading").style.display = "none";
      
      if (!gameStarted) {
        showWelcomeScreen();
      }
    })
    .catch(error => {
      console.error("Camera error:", error);
      showCameraError();
    });
}

function switchCamera() {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  
  startCamera();
}

function showCameraError() {
  document.getElementById("loading").innerHTML = `
    <div class="loader"></div>
    <p>Erro ao acessar a câmera</p>
    <button onclick="startCamera()" class="permission-btn">Tentar Novamente</button>
  `;
}

// ============================================
// GAME FLOW
// ============================================
function showWelcomeScreen() {
  document.getElementById("welcome-screen").style.display = "flex";
  document.getElementById("ui-overlay").style.display = "none";
  document.getElementById("reticle").style.display = "none";
  document.querySelector(".camera-switch").style.display = "none";
}

function startGame() {
  console.log("🎮 Starting game");
  gameStarted = true;
  
  document.getElementById("welcome-screen").style.display = "none";
  document.getElementById("ui-overlay").style.display = "flex";
  document.getElementById("reticle").style.display = "block";
  document.querySelector(".camera-switch").style.display = "flex";
  
  placeNewCan();
}

function placeNewCan() {
  // Remove old can if exists
  if (can) {
    scene.remove(can);
  }
  
  // Reset found flag
  foundCan = false;
  
  // Create new can
  can = createCan();
  
  // Place can RELATIVE TO CURRENT CAMERA DIRECTION
  // This ensures it always spawns in front of where user is looking
  
  // Get current camera direction
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  // Random offset from center view
  // Smaller angles = more centered, easier to find
  const horizontalOffset = (Math.random() - 0.5) * 40; // -20 to +20 degrees
  const verticalOffset = (Math.random() - 0.5) * 20;   // -10 to +10 degrees
  
  // Distance: 8 to 15 meters (farther away)
  const distance = 8 + Math.random() * 7;
  
  // Convert offsets to radians
  const hOffsetRad = THREE.MathUtils.degToRad(horizontalOffset);
  const vOffsetRad = THREE.MathUtils.degToRad(verticalOffset);
  
  // Calculate position in front of camera with offsets
  const direction = cameraDirection.clone();
  
  // Apply horizontal rotation around Y axis
  direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), hOffsetRad);
  
  // Apply vertical rotation around right axis
  const rightVector = new THREE.Vector3();
  rightVector.crossVectors(camera.up, direction).normalize();
  direction.applyAxisAngle(rightVector, vOffsetRad);
  
  // Set final position
  direction.multiplyScalar(distance);
  can.position.copy(direction);
  
  console.log(`📍 Can placed at distance: ${distance.toFixed(1)}m, offsets: H=${horizontalOffset.toFixed(1)}° V=${verticalOffset.toFixed(1)}°`);
  console.log(`📍 World position: x=${can.position.x.toFixed(2)}, y=${can.position.y.toFixed(2)}, z=${can.position.z.toFixed(2)}`);
}

function onCanTapped() {
  if (!gameStarted || foundCan || gameCompleted) return;
  
  console.log("🎯 Can tapped!");
  foundCan = true;
  foundCount++;
  
  document.getElementById("found-count").textContent = foundCount;
  
  // Scale animation
  if (can) {
    can.scale.set(1.3, 1.3, 1.3);
    setTimeout(() => {
      if (can) can.scale.set(1, 1, 1);
    }, 200);
  }
  
  // Show hit effect
  showHitEffect();
  
  // Check if game completed
  if (foundCount >= CANS_TO_FIND) {
    gameCompleted = true;
    setTimeout(() => {
      document.getElementById("game-complete-popup").classList.add("visible");
    }, 1000);
  } else {
    // Show congrats and place new can
    const remaining = CANS_TO_FIND - foundCount;
    document.getElementById("congrats-title").textContent = "Ótimo! 🎉";
    document.getElementById("congrats-text").textContent = 
      `Você encontrou ${foundCount}/${CANS_TO_FIND} latas! Faltam apenas ${remaining}!`;
    
    setTimeout(() => {
      document.getElementById("congrats-popup").classList.add("visible");
    }, 800);
  }
}

function resetGame() {
  document.getElementById("congrats-popup").classList.remove("visible");
  placeNewCan();
}

function restartCompleteGame() {
  foundCount = 0;
  gameCompleted = false;
  document.getElementById("found-count").textContent = "0";
  document.getElementById("game-complete-popup").classList.remove("visible");
  placeNewCan();
}

function showHitEffect() {
  const effect = document.createElement("div");
  effect.className = "hit-effect";
  document.body.appendChild(effect);
  setTimeout(() => effect.remove(), 800);
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
  requestAnimationFrame(animate);
  
  updateCameraOrientation();
  updateCanPosition();
  
  renderer.render(scene, camera);
}

function updateCameraOrientation() {
  // Convert device orientation to camera rotation
  // This creates the AR effect by rotating the 3D world based on phone orientation
  const { alpha, beta, gamma } = deviceOrientation;
  
  // Create rotation matrix from device orientation
  // Screen orientation is portrait by default
  const screenOrientation = window.orientation || 0;
  const screenAngle = THREE.MathUtils.degToRad(screenOrientation);
  
  // Apply rotations in correct order for mobile AR
  camera.rotation.set(
    beta - Math.PI / 2,  // Tilt correction
    alpha,               // Compass
    -gamma,              // Roll
    'YXZ'
  );
}

function updateCanPosition() {
  if (!can || !gameStarted || gameCompleted) {
    if (can) can.visible = false;
    return;
  }
  
  can.visible = !foundCan;
  
  if (!foundCan) {
    // Can stays at its world position (set when placed)
    // Just add gentle floating animation
    const time = Date.now() * 0.001;
    const baseY = can.position.y;
    
    // Store original Y if not already stored
    if (!can.userData.originalY) {
      can.userData.originalY = baseY;
    }
    
    // Float around original position
    can.position.y = can.userData.originalY + Math.sin(time * 2) * 0.1;
    
    // Gentle rotation
    can.rotation.y += 0.015;
  }
}

// ============================================
// INTERACTION
// ============================================
function setupEventListeners() {
  // Start game button
  const startButton = document.getElementById("start-game");
  if (startButton) {
    startButton.addEventListener("click", startGame);
  }
  
  // Play again button
  const playAgainButton = document.getElementById("play-again");
  if (playAgainButton) {
    playAgainButton.addEventListener("click", resetGame);
  }
  
  // Restart game button
  const restartButton = document.getElementById("restart-game");
  if (restartButton) {
    restartButton.addEventListener("click", restartCompleteGame);
  }
  
  // Camera switch button
  const cameraSwitchButton = document.querySelector(".camera-switch");
  if (cameraSwitchButton) {
    cameraSwitchButton.addEventListener("click", switchCamera);
  }
  
  // Canvas tap/click detection
  renderer.domElement.addEventListener("click", handleCanvasTap);
  renderer.domElement.addEventListener("touchend", handleCanvasTap);
  
  // Window resize
  window.addEventListener("resize", handleResize);
}

function handleCanvasTap(event) {
  if (!gameStarted || foundCan || gameCompleted) return;
  
  event.preventDefault();
  
  // Get tap position
  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = event.clientX || (event.changedTouches && event.changedTouches[0].clientX);
  const clientY = event.clientY || (event.changedTouches && event.changedTouches[0].clientY);
  
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  
  // Convert to normalized device coordinates (-1 to +1)
  const mouse = new THREE.Vector2(
    (x / rect.width) * 2 - 1,
    -(y / rect.height) * 2 + 1
  );
  
  // Raycasting
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Set a more generous threshold for raycasting
  raycaster.params.Points.threshold = 0.5;
  
  // Get all intersections recursively
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  console.log(`🎯 Tap at screen pos: (${x.toFixed(0)}, ${y.toFixed(0)}), found ${intersects.length} intersections`);
  
  // Check if can was hit
  let canHit = false;
  for (let intersect of intersects) {
    // Check if this object or its parent is the can
    let obj = intersect.object;
    while (obj) {
      if (obj === can || obj.userData.clickable) {
        console.log("✅ CAN HIT!");
        canHit = true;
        break;
      }
      obj = obj.parent;
    }
    if (canHit) break;
  }
  
  if (canHit) {
    onCanTapped();
  } else {
    console.log("❌ Miss - no can hit");
    
    // Debug: Show where can is relative to camera
    if (can) {
      const canWorldPos = new THREE.Vector3();
      can.getWorldPosition(canWorldPos);
      
      const distance = camera.position.distanceTo(canWorldPos);
      console.log(`📏 Can distance from camera: ${distance.toFixed(2)}m`);
      console.log(`📍 Can world position: x=${canWorldPos.x.toFixed(2)}, y=${canWorldPos.y.toFixed(2)}, z=${canWorldPos.z.toFixed(2)}`);
    }
  }
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// START GAME
// ============================================
window.addEventListener("load", init);

// Expose to global scope for HTML onclick handlers
window.startGameFromButton = startGame;