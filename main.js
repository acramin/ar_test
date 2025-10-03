// All JavaScript from <script> tag in index.html
// GAME CONFIGURATION - Change this number to set how many cans need to be found
const CANS_TO_FIND = 3; // Easy to change for testing different amounts!

// Main application variables
let video, renderer, scene, camera, can;
let alpha = 0,
  beta = 0,
  gamma = 0;
let canPosition = { x: 0, y: 0, z: -15 };
let foundCan = false;
let currentFacingMode = "environment";
let foundCount = 0;
let raycaster, mouse;
let reticlePulseInterval;
let gameStarted = false;
let gameCompleted = false;

// Initialize the application
function init() {
  document.getElementById("target-count").textContent = CANS_TO_FIND;
  document.getElementById("final-count").textContent = CANS_TO_FIND;
  setupThreeJS();
  setupDeviceOrientation();
  const startButton = document.getElementById("start-game");
  const playAgainButton = document.getElementById("play-again");
  const restartGameButton = document.getElementById("restart-game");
  const cameraSwitchButton = document.querySelector(".camera-switch");
  if (startButton) {
    console.log("Start game button found (using onclick)");
  } else {
    console.error("Start game button not found");
  }
  if (playAgainButton) {
    playAgainButton.addEventListener("click", resetGame);
  }
  if (restartGameButton) {
    restartGameButton.addEventListener("click", restartCompleteGame);
  }
  if (cameraSwitchButton) {
    cameraSwitchButton.addEventListener("click", switchCamera);
  }
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("click", onCanvasTap, false);
  renderer.domElement.addEventListener("touchstart", onCanvasTap, {
    passive: false,
  });
  randomizeCanPosition();
  animate();
  startReticlePulse();
  startCamera();
}

function startGame() {
  console.log("startGame function called!");
  gameStarted = true;

  randomizeCanPosition();

  const welcomeScreen = document.getElementById("welcome-screen");
  if (welcomeScreen) {
    welcomeScreen.classList.add("hidden");
    welcomeScreen.style.display = "none";
    welcomeScreen.style.visibility = "hidden";
    console.log("Welcome screen hidden");
  } else {
    console.error("Welcome screen not found");
  }
  const uiOverlay = document.getElementById("ui-overlay");
  const reticle = document.getElementById("reticle");
  const cameraSwitch = document.querySelector(".camera-switch");
  if (uiOverlay) {
    uiOverlay.style.display = "flex";
    uiOverlay.style.visibility = "visible";
    console.log("UI overlay shown");
  }
  if (reticle) {
    reticle.style.display = "block";
    reticle.style.visibility = "visible";
    console.log("Reticle shown");
  }
  if (cameraSwitch) {
    cameraSwitch.style.display = "flex";
    cameraSwitch.style.visibility = "visible";
    console.log("Camera switch shown");
  }
}

// function setupThreeJS() {
//   scene = new THREE.Scene();
//   camera = new THREE.PerspectiveCamera(
//     70,
//     window.innerWidth / window.innerHeight,
//     0.1,
//     1000
//   );
//   camera.position.set(0, 1.6, 5); // Move camera UP to eye level (1.6m high)
  
//   renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
//   renderer.setSize(window.innerWidth, window.innerHeight);
//   renderer.setPixelRatio(window.devicePixelRatio);
//   document.getElementById("canvas-container").appendChild(renderer.domElement);
//   createCan();
//   const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
//   scene.add(ambientLight);
//   const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
//   directionalLight.position.set(1, 1, 1);
//   scene.add(directionalLight);
//   const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
//   directionalLight2.position.set(-1, -1, -1);
//   scene.add(directionalLight2);
// }

function setupThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 5);
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById("canvas-container").appendChild(renderer.domElement);
  
  // ADD COORDINATE SYSTEM HELPERS
  addCoordinateHelpers(); // Disabled as requested
  
  createCan();
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);
}

function addCoordinateHelpers() {
  // 1. MUCH BIGGER AXES HELPER - Shows X (red), Y (green), Z (blue) axes
  const axesHelper = new THREE.AxesHelper(10); // Much bigger - 10 units long
  axesHelper.position.set(0, 0, 0); // At world origin
  scene.add(axesHelper);
  
  // 2. GRID HELPER - Shows ground plane (bigger and brighter)
  const gridHelper = new THREE.GridHelper(40, 40, 0x00ff00, 0x808080);
  gridHelper.position.y = 0; // At ground level
  scene.add(gridHelper);
  
  // 3. LARGE CAMERA POSITION MARKER
  const cameraMarkerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const cameraMarkerMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffff00,
    wireframe: false
  });
  const cameraMarker = new THREE.Mesh(cameraMarkerGeometry, cameraMarkerMaterial);
  cameraMarker.position.copy(camera.position);
  scene.add(cameraMarker);
  
  // 4. LARGE REFERENCE SPHERES at key positions
  // Big sphere at origin (world center)
  const originSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: false })
  );
  originSphere.position.set(0, 0, 0);
  scene.add(originSphere);
  
  // Big sphere directly in front of camera (should be very visible)
  const frontSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false })
  );
  frontSphere.position.set(0, 1.6, 0); // In front at eye level
  scene.add(frontSphere);
  
  // Sphere to the right
  const rightSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: false })
  );
  rightSphere.position.set(5, 1.6, 0);
  scene.add(rightSphere);
  
  // Sphere to the left
  const leftSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: false })
  );
  leftSphere.position.set(-5, 1.6, 0);
  scene.add(leftSphere);
  
  // 5. DIRECTION ARROW from camera (bigger and longer)
  const arrowHelper = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1), // Direction (forward)
    camera.position,              // Origin (camera position)
    5,                            // Longer - 5 units
    0x00ffff,                     // Cyan color
    1,                            // Head length
    0.5                           // Head width
  );
  scene.add(arrowHelper);
  
  // 6. Add bright boxes at cardinal positions for easy visibility
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  
  // Box in front (Z negative)
  const frontBox = new THREE.Mesh(
    boxGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
  );
  frontBox.position.set(0, 1.6, -3);
  scene.add(frontBox);
  
  console.log("📐 Enhanced coordinate helpers added:");
  console.log("  - LARGE red axis = X (left/right)");
  console.log("  - LARGE green axis = Y (up/down)");
  console.log("  - LARGE blue axis = Z (forward/back)");
  console.log("  - Grid = Ground plane (Y=0)");
  console.log("  - YELLOW sphere = Camera position (0, 1.6, 5)");
  console.log("  - RED sphere = World origin (0, 0, 0)");
  console.log("  - GREEN sphere = Front at eye level (0, 1.6, 0)");
  console.log("  - BLUE sphere = Right side (5, 1.6, 0)");
  console.log("  - MAGENTA sphere = Left side (-5, 1.6, 0)");
  console.log("  - CYAN arrow = Camera forward direction");
  console.log("  - WHITE wireframe box = 3 units in front");
  console.log("");
  console.log("💡 If you don't see anything, try:");
  console.log("   1. Turn your phone around slowly");
  console.log("   2. Tilt phone up/down");
  console.log("   3. The green sphere should be right in front of you!");
}

function createCan() {
  console.log("Creating can model...");
  
  const group = new THREE.Group();
  
  // Check if GLTFLoader is available
  if (typeof THREE.GLTFLoader !== 'undefined') {
    console.log("GLTFLoader available: true");
    const gltfloader = new THREE.GLTFLoader();
    
    console.log("Loading 3D model from: ./assets/redbull.glb");
    
    gltfloader.load(
      "./assets/redbull.glb", 
      function (gltf) {
        console.log("✅ GLB model loaded successfully!");
        console.log("Model data:", gltf);
        
        // Get the scene from the loaded model
        const model = gltf.scene;
        model.rotation.x = Math.PI / 2; // 90 degrees
        model.rotation.y = 0;
        model.rotation.z = 0;
        // Scale the model appropriately (adjust size as needed)
        model.scale.set(0.05, 0.05, 0.05);
        
        // Add the model to the group
        group.add(model);
        
        console.log("✅ Custom GLB model setup complete!");
      },
      function (progress) {
        // Loading progress
        const percent = (progress.loaded / progress.total * 100).toFixed(0);
        console.log(`Model loading progress: ${percent}%`);
      },
      function (error) {
        console.log("❌ Failed to load GLB model:", error);
        console.log("🔄 Falling back to procedural Red Bull can...");
        createProceduralCan(group);
      }
    );
  } else {
    console.log("GLTFLoader available: false");
    console.log("🔄 Using procedural Red Bull can...");
    createProceduralCan(group);
  }
  
  // Add collision detection sphere (works for both models)
  const collisionGeometry = new THREE.SphereGeometry(1.2, 16, 16);
  const collisionMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    visible: false,
  });
  const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
  collisionMesh.userData.isCanCollision = true;
  group.add(collisionMesh);
  
  // Set up group properties
  group.userData = { floatTime: Math.random() * 100 };
  scene.add(group);
  
  // Set initial reference
  can = group;
  can.position.set(canPosition.x, canPosition.y, canPosition.z);
}



function createCan2() {
  const group = new THREE.Group();
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
  const material = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 100,
    specular: 0xffffff,
  });
  const body = new THREE.Mesh(geometry, material);
  group.add(body);
  const topGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 32);
  const topMaterial = new THREE.MeshPhongMaterial({
    color: 0xeeeeee,
    shininess: 150,
    specular: 0xffffff,
  });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.y = 0.625;
  group.add(top);
  const rimGeometry = new THREE.TorusGeometry(0.45, 0.02, 16, 32);
  const rimMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 200,
    specular: 0xffffff,
  });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.position.y = 0.625;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  const labelGeometry = new THREE.CylinderGeometry(0.51, 0.51, 0.4, 32);
  const labelMaterial = new THREE.MeshPhongMaterial({
    color: 0xff9900,
    shininess: 80,
    specular: 0xffddaa,
  });
  const label = new THREE.Mesh(labelGeometry, labelMaterial);
  label.position.y = 0.2;
  group.add(label);
  const logoGeometry = new THREE.CylinderGeometry(0.52, 0.52, 0.3, 32);
  const logoMaterial = new THREE.MeshPhongMaterial({
    color: 0x003366,
    shininess: 90,
    specular: 0x6699cc,
  });
  const logo = new THREE.Mesh(logoGeometry, logoMaterial);
  logo.position.y = -0.1;
  group.add(logo);
  const collisionGeometry = new THREE.SphereGeometry(1.2, 16, 16);
  const collisionMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    visible: false,
  });
  const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
  collisionMesh.userData.isCanCollision = true;
  group.add(collisionMesh);
  group.userData = { floatTime: Math.random() * 100 };
  scene.add(group);
  can = group;
  can.position.set(canPosition.x, canPosition.y, canPosition.z);
}

function setupDeviceOrientation() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", (event) => {
      alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
      beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
      gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;
    });
  } else {
    alert(
      "Device orientation not supported on this device. The experience will be limited."
    );
  }
}

function startCamera() {
  video = document.getElementById("camera-video");
  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      video.play();
      // Set initial camera transform based on facing mode
      video.style.transform = currentFacingMode === "environment" ? "scaleX(1)" : "scaleX(-1)";
      document.getElementById("loading").style.display = "none";
      if (!gameStarted) {
        document.getElementById("welcome-screen").style.display = "flex";
        document.getElementById("ui-overlay").style.display = "none";
        document.getElementById("reticle").style.display = "none";
        document.querySelector(".camera-switch").style.display = "none";
      }
    })
    .catch((error) => {
      console.error("Camera error:", error);
      document.getElementById("loading").innerHTML = `
                <div class="loader"></div>
                <p>Erro ao acessar a câmera</p>
                <button onclick="startCamera()" class="permission-btn">Tentar Novamente</button>
                <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
                    Verifique se você permitiu o acesso à câmera
                </p>
            `;
      if (currentFacingMode === "environment") {
        currentFacingMode = "user";
        video.style.transform = "scaleX(1)";
        setTimeout(() => startCamera(), 1000);
      }
    });
}

function switchCamera() {
  currentFacingMode =
    currentFacingMode === "environment" ? "user" : "environment";
  video.style.transform =
    currentFacingMode === "environment" ? "scaleX(1)" : "scaleX(1)";
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
  }
  startCamera();
}

function onCanvasTap(event) {
  if (!gameStarted || foundCan || gameCompleted) return;
  if (event.type === "touchstart") {
    event.preventDefault();
  }
  const rect = renderer.domElement.getBoundingClientRect();
  if (event.type === "touchstart") {
    mouse.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
  } else {
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  console.log("Tap detected. Intersections found:", intersects.length);
  let hitCan = false;
  for (let i = 0; i < intersects.length; i++) {
    console.log("Intersection", i, ":", intersects[i].object);
    if (intersects[i].object.parent === can || intersects[i].object === can) {
      hitCan = true;
      console.log("HIT CAN!");
      break;
    }
  }
  if (hitCan) {
    foundCan = true;
    foundCount++;
    document.getElementById("found-count").textContent = foundCount;
    console.log("Can found! Total found:", foundCount + "/" + CANS_TO_FIND);
    showHitEffect();
    can.scale.set(1.2, 1.2, 1.2);
    setTimeout(() => {
      if (can) can.scale.set(1, 1, 1);
    }, 200);
    if (foundCount >= CANS_TO_FIND) {
      gameCompleted = true;
      console.log("GAME COMPLETED! All", CANS_TO_FIND, "cans found!");
      setTimeout(() => {
        document.getElementById("game-complete-popup").classList.add("visible");
      }, 1000);
    } else {
      const remaining = CANS_TO_FIND - foundCount;
      document.getElementById("congrats-title").textContent = `Ótimo! 🎉`;
      document.getElementById(
        "congrats-text"
      ).textContent = `Você encontrou ${foundCount}/${CANS_TO_FIND} latas! Faltam apenas ${remaining}!`;
      setTimeout(() => {
        document.getElementById("congrats-popup").classList.add("visible");
      }, 800);
    }
  } else {
    console.log("No can hit this time");
  }
}

function showHitEffect() {
  const effect = document.createElement("div");
  effect.className = "hit-effect";
  document.body.appendChild(effect);
  effect.style.animation = "hitAnimation 0.8s forwards";
  setTimeout(() => {
    document.body.removeChild(effect);
  }, 800);
}

function startReticlePulse() {
  const reticle = document.getElementById("reticle");
  let scale = 1;
  let growing = true;
  reticlePulseInterval = setInterval(() => {
    if (growing) {
      scale += 0.01;
      if (scale >= 1.1) growing = false;
    } else {
      scale -= 0.01;
      if (scale <= 0.9) growing = true;
    }
    reticle.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }, 50);
}

// function randomizeCanPosition() {
//   const angle = Math.random() * Math.PI * 2;
//   const distance = 12 + Math.random() * 5;
//   canPosition.x = Math.cos(angle) * distance;
//   canPosition.y = 1.5 + Math.random() * 2;
//   canPosition.z = Math.sin(angle) * distance;
//   if (can) {
//     can.position.set(canPosition.x, canPosition.y, canPosition.z);
//   }
// }

function randomizeCanPosition() {
  // const distance = 30 + Math.random() * 2; // 20-22 units away
  // const sideOffset = (Math.random() - 0.5) * 10; // -4.5 to +4.5 to the side
  // const heightOffset = 5 + (Math.random() * 2); // 5 to +7 above eye level

  const distance = 10; // 20-22 units away
  const sideOffset = 10; // -4.5 to +4.5 to the side
  const heightOffset = 30; // 5 to +7 above eye level
  
  // Position relative to camera but ensure it's always in front and at good height
  canPosition.x = 10;
  canPosition.y = 10; // Camera is now at 1.6, so this puts can at 1.6-2.6
  canPosition.z = 10; // Always in front (negative Z from camera)
  
  console.log(`Can positioned at: x=${canPosition.x.toFixed(1)}, y=${canPosition.y.toFixed(1)}, z=${canPosition.z.toFixed(1)}`);
  console.log(`Camera position: x=${camera.position.x.toFixed(1)}, y=${camera.position.y.toFixed(1)}, z=${camera.position.z.toFixed(1)}`);
  
  if (can) {
    can.position.set(canPosition.x, canPosition.y, canPosition.z);
  }
}


function resetGame() {
  foundCan = false;
  document.getElementById("congrats-popup").classList.remove("visible");
  randomizeCanPosition();
}

function restartCompleteGame() {
  foundCan = false;
  foundCount = 0;
  gameCompleted = false;
  document.getElementById("found-count").textContent = "0";
  document.getElementById("game-complete-popup").classList.remove("visible");
  randomizeCanPosition();
  console.log("Game restarted - looking for", CANS_TO_FIND, "cans again!");
}



// function animate() {
//   requestAnimationFrame(animate);
//   if (camera) {
//     camera.rotation.set(beta, alpha, gamma, "YXZ");
//   }
//   if (can && !foundCan && gameStarted && !gameCompleted) {
//     // NO ANIMATION - can stays perfectly still at its original position
//     can.position.set(canPosition.x, canPosition.y, canPosition.z);
//     can.visible = true;
    
//     // Debug: Log can position relative to camera
//     console.log(`Can at: x=${can.position.x.toFixed(1)}, y=${can.position.y.toFixed(1)}, z=${can.position.z.toFixed(1)}`);
//     console.log(`Camera position: x=${camera.position.x.toFixed(1)}, y=${camera.position.y.toFixed(1)}, z=${camera.position.z.toFixed(1)}`);
//   } else if (can && (!gameStarted || gameCompleted)) {
//     can.visible = false;
//   }
//   if (renderer && scene && camera) {
//     renderer.render(scene, camera);
//   }
// }

function animate() {
  requestAnimationFrame(animate);
  if (camera) {
    // Fix: Adjust beta to compensate for holding phone upright
    // When phone is upright, beta ≈ 0, but we want camera to look forward
    const adjustedBeta = beta - Math.PI / 2;
    camera.rotation.order = 'ZYX'; // Different order reduces roll sensitivity
    camera.rotation.set(gamma, alpha, adjustedBeta);
    // camera.rotation.set(adjustedBeta, alpha, gamma, "YXZ"); // Removed to prevent camera rotation with device orientation
  }
  if (can && !foundCan && gameStarted && !gameCompleted) {
    // NO ANIMATION - can stays perfectly still at its original position
    can.position.set(canPosition.x, canPosition.y, canPosition.z);
    can.visible = true;
    
    // Debug: Log can position relative to camera
    console.log(`Can at: x=${can.position.x.toFixed(1)}, y=${can.position.y.toFixed(1)}, z=${can.position.z.toFixed(1)}`);
    console.log(`Camera position: x=${camera.position.x.toFixed(1)}, y=${camera.position.y.toFixed(1)}, z=${camera.position.z.toFixed(1)}`);
  } else if (can && (!gameStarted || gameCompleted)) {
    can.visible = false;
  }
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

window.addEventListener("resize", () => {
  if (camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

window.addEventListener("load", init);

function testButton() {
  console.log("Test button clicked!");
  alert("Button is working!");
}

window.startGameFromButton = function () {
  console.log("Starting game from button click");
  startGame();
};
