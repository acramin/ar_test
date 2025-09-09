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

function setupThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById("canvas-container").appendChild(renderer.domElement);
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

function createCan() {
  const group = new THREE.Group();
  const gltfloader = new THREE.GLTFLoader();
  gltfloader.load("assets/redbull.glb", function (gltf) {
    console.log(gltf);
    printGLTFInfo(gltf);
    print("lata do carai")
    const model = gltf.scene;
    model.scale.set(0.5, 0.5, 0.5);
    group.add(model);
    scene.add(group);
  });
  // --- IGNORE --- This is the old can model creation code, kept for reference
  // const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32);
  // const material = new THREE.MeshPhongMaterial({
  //   color: 0xff0000,
  //   shininess: 100,
  //   specular: 0xffffff,
  // });
  // const body = new THREE.Mesh(geometry, material);
  // group.add(body);
  // const topGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 32);
  // const topMaterial = new THREE.MeshPhongMaterial({
  //   color: 0xeeeeee,
  //   shininess: 150,
  //   specular: 0xffffff,
  // });
  // const top = new THREE.Mesh(topGeometry, topMaterial);
  // top.position.y = 0.625;
  // group.add(top);
  // const rimGeometry = new THREE.TorusGeometry(0.45, 0.02, 16, 32);
  // const rimMaterial = new THREE.MeshPhongMaterial({
  //   color: 0xffffff,
  //   shininess: 200,
  //   specular: 0xffffff,
  // });
  // const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  // rim.position.y = 0.625;
  // rim.rotation.x = Math.PI / 2;
  // group.add(rim);
  // const labelGeometry = new THREE.CylinderGeometry(0.51, 0.51, 0.4, 32);
  // const labelMaterial = new THREE.MeshPhongMaterial({
  //   color: 0xff9900,
  //   shininess: 80,
  //   specular: 0xffddaa,
  // });
  // const label = new THREE.Mesh(labelGeometry, labelMaterial);
  // label.position.y = 0.2;
  // group.add(label);
  // const logoGeometry = new THREE.CylinderGeometry(0.52, 0.52, 0.3, 32);
  // const logoMaterial = new THREE.MeshPhongMacanterial({
  //   color: 0x003366,
  //   shininess: 90,
  //   specular: 0x6699cc,
  // });
  // const logo = new THREE.Mesh(logoGeometry, logoMaterial);
  // logo.position.y = -0.1;
  // group.add(logo);
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
    currentFacingMode === "environment" ? "scaleX(-1)" : "scaleX(1)";
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
    const obj = intersects[i].object;
    console.log("Intersection", i, ":", obj);
    // Check for collision mesh by userData property
    if (obj.userData && obj.userData.isCanCollision) {
      hitCan = true;
      console.log("HIT CAN via collision mesh!");
      break;
    }
    // Fallback: check if intersected object is the can group or model
    if (obj.parent === can || obj === can) {
      hitCan = true;
      console.log("HIT CAN via group/model!");
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

function randomizeCanPosition() {
  const angle = Math.random() * Math.PI * 2;
  const distance = 12 + Math.random() * 5;
  canPosition.x = Math.cos(angle) * distance;
  canPosition.y = 1.5 + Math.random() * 2;
  canPosition.z = Math.sin(angle) * distance;
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

function animate() {
  requestAnimationFrame(animate);
  if (camera) {
    camera.rotation.set(beta, alpha, gamma, "YXZ");
  }
  if (can && !foundCan && gameStarted && !gameCompleted) {
    can.userData.floatTime += 0.01;
    can.position.y = canPosition.y + Math.sin(can.userData.floatTime) * 0.1;
    can.rotation.y += 0.01;
    can.visible = true;
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
