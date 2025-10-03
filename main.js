
  // ====== CONFIG ======
  const CANS_TO_FIND = 3;

  // ====== STATE ======
  let videoEl = null;
  let renderer, scene, camera, canGroup;
  let raycaster, mouse;
  let foundCount = 0;
  let gameStarted = false;
  let gameCompleted = false;
  let currentFacingMode = "environment";
  let deviceQuaternion = new THREE.Quaternion();
  let useGLBPath = "./assets/redbull.glb"; // change if needed
  let reticleEl = null;
  let centerPlacementDistance = 6; // meters (virtual units) in front of camera to place can
  let floatClock = 0;

  // ====== INIT ENTRYPOINT ======
  function init() {
    // hooks to DOM (assumes these exist in your HTML)
    videoEl = document.getElementById("camera-video");
    reticleEl = document.getElementById("reticle");
    document.getElementById("target-count").textContent = CANS_TO_FIND;
    document.getElementById("final-count").textContent = CANS_TO_FIND;
    document.getElementById("found-count").textContent = foundCount;

    setupThree();
    setupInput();
    startCameraStream();
    window.addEventListener("resize", onResize);
    console.log("AR logic initialized");
  }

  // ====== THREE.JS SETUP ======
  function setupThree() {
    scene = new THREE.Scene();

    // A perspective camera that will be rotated by device orientation events.
    camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );
    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0px";
    renderer.domElement.style.left = "0px";

    // Put renderer into the same container your app uses
    const container = document.getElementById("canvas-container") || document.body;
    // clear previous canvas inside container (safety)
    const existing = container.querySelector("canvas");
    if (existing) existing.remove();
    container.appendChild(renderer.domElement);

    // lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(1, 2, 1);
    scene.add(dir);

    // simple grid/axes helper removed for production - uncomment if you need debug visuals
    // scene.add(new THREE.AxesHelper(1.0));

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // create can placeholder immediately (will replace with GLB when loaded)
    createCanFallback();

    // start render loop
    requestAnimationFrame(animate);
  }

  // ====== LOAD OR CREATE CAN MODEL ======
  function createCanFallback() {
    if (canGroup) {
      scene.remove(canGroup);
      canGroup.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }

    const g = new THREE.Group();

    // procedural cylinder can
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.9, 32);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff0033 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    g.add(body);

    // small top
    const topGeo = new THREE.CircleGeometry(0.25, 32);
    const topMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    const top = new THREE.Mesh(topGeo, topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.45;
    g.add(top);

    // collision sphere (invisible) used for raycast hit detection
    const collisionGeo = new THREE.SphereGeometry(0.45, 12, 12);
    const collisionMat = new THREE.MeshBasicMaterial({ visible: false });
    const collisionMesh = new THREE.Mesh(collisionGeo, collisionMat);
    collisionMesh.userData.isCanCollision = true;
    collisionMesh.position.set(0, 0, 0);
    g.add(collisionMesh);

    // store
    canGroup = g;
    scene.add(canGroup);

    // attempt to load GLB to replace it if GLTFLoader is available
    tryLoadGLB();
  }

  function tryLoadGLB() {
    // Check for loader availability
    if (THREE.GLTFLoader) {
      const loader = new THREE.GLTFLoader();
      loader.load(
        useGLBPath,
        (gltf) => {
          // remove fallback pieces and add model instead
          const model = gltf.scene || gltf.scenes[0];
          model.traverse((c) => {
            if (c.isMesh) {
              c.castShadow = false;
              c.receiveShadow = false;
            }
          });

          // create group that includes an invisible collision mesh for raycast
          const group = new THREE.Group();
          // center model
          model.position.set(0, -0.45, 0); // adjust if model pivot different
          // scale to an approximate human scale
          const scale = 0.03;
          model.scale.set(scale, scale, scale);
          group.add(model);

          const collisionGeo = new THREE.SphereGeometry(0.5, 12, 12);
          const collisionMat = new THREE.MeshBasicMaterial({ visible: false });
          const collisionMesh = new THREE.Mesh(collisionGeo, collisionMat);
          collisionMesh.userData.isCanCollision = true;
          collisionMesh.position.set(0, 0, 0);
          group.add(collisionMesh);

          scene.remove(canGroup);
          canGroup = group;
          scene.add(canGroup);

          console.log("GLB loaded and placed into scene");
        },
        (xhr) => {
          // progress (optional)
          if (xhr && xhr.loaded && xhr.total) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            // console.log("GLB loading: " + pct + "%");
          }
        },
        (err) => {
          console.warn("Failed loading GLB, using fallback can. Error:", err);
        }
      );
    } else {
      console.warn("THREE.GLTFLoader not available - using procedural can fallback");
    }
  }

  // ====== CAMERA / DEVICE ORIENTATION ======
  // Convert DeviceOrientationEvent alpha/beta/gamma into a THREE quaternion.
  function handleDeviceOrientationEvent(ev) {
    // Some browsers provide null values initially - guard those
    const alpha = ev.alpha ? THREE.MathUtils.degToRad(ev.alpha) : 0; // Z
    const beta = ev.beta ? THREE.MathUtils.degToRad(ev.beta) : 0; // X'
    const gamma = ev.gamma ? THREE.MathUtils.degToRad(ev.gamma) : 0; // Y''
    // NOTE: The mapping / order is tricky across devices. 'YXZ' often works well.
    const euler = new THREE.Euler(beta, alpha, -gamma, "YXZ");
    deviceQuaternion.setFromEuler(euler);

    // Optional: adjust to align with CSS camera mirroring / phone orientation if needed
    // Some devices require a fix: rotate around X by -90deg
    const screenTransform = new THREE.Quaternion();
    // If the phone is held in portrait natural orientation, this is often not necessary.
    // If you observe a 90deg offset, uncomment and adjust the rotation below:
    // screenTransform.setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
    deviceQuaternion.multiply(screenTransform);
  }

  // Attach device orientation listener
  function enableDeviceOrientation() {
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") {
      // iOS 13+ permission flow
      DeviceOrientationEvent.requestPermission().then((perm) => {
        if (perm === "granted") {
          window.addEventListener("deviceorientation", handleDeviceOrientationEvent);
        } else {
          console.warn("DeviceOrientation permission denied");
        }
      }).catch((err) => {
        console.warn("DeviceOrientation permission error:", err);
      });
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleDeviceOrientationEvent);
    } else {
      console.warn("DeviceOrientationEvent not supported in this browser");
    }
  }

  // ====== CAMERA STREAM (video) ======
  function startCameraStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const loading = document.getElementById("loading");
      if (loading) loading.innerText = "Camera not supported in this browser.";
      return;
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (!videoEl) videoEl = document.getElementById("camera-video");
        if (!videoEl) {
          console.warn("No <video id='camera-video'> found. Still continuing without direct camera preview element.");
        } else {
          videoEl.srcObject = stream;
          videoEl.setAttribute("playsinline", ""); // iOS
          videoEl.play().catch(() => {});
        }

        // show UI if welcome not started
        const loading = document.getElementById("loading");
        if (loading) loading.style.display = "none";

        enableDeviceOrientation();
      })
      .catch((err) => {
        console.error("getUserMedia error:", err);
        const loading = document.getElementById("loading");
        if (loading) {
          loading.innerHTML = `
            <div class="loader"></div>
            <p>Erro ao acessar a câmera</p>
            <button onclick="(function(){ startCameraStream(); })()" class="permission-btn">Tentar Novamente</button>
            <p style="margin-top:20px;font-size:14px;opacity:0.7">Verifique se permitiu o acesso à câmera</p>
          `;
        }
      });
  }

  function switchCamera() {
    // stop existing tracks
    if (videoEl && videoEl.srcObject) {
      videoEl.srcObject.getTracks().forEach(t => t.stop());
    } else {
      // try to stop from any attached stream
      const streams = [];
      try {
        const s = videoEl.srcObject;
        if (s) streams.push(s);
      } catch (e) {}
    }
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    startCameraStream();
  }

  // ====== INPUT / RAYCAST HANDLING ======
  function setupInput() {
    // Dom elements (may not exist if user customized)
    const startButton = document.getElementById("start-game");
    const playAgainButton = document.getElementById("play-again");
    const restartGameButton = document.getElementById("restart-game");
    const cameraSwitchButton = document.querySelector(".camera-switch");

    if (startButton) {
      startButton.addEventListener("click", () => {
        startGame();
      });
    }

    if (playAgainButton) playAgainButton.addEventListener("click", resetFind);
    if (restartGameButton) restartGameButton.addEventListener("click", restartAll);
    if (cameraSwitchButton) cameraSwitchButton.addEventListener("click", switchCamera);

    // pointer handlers on the renderer canvas
    renderer.domElement.addEventListener("click", onPointerEvent, false);
    renderer.domElement.addEventListener("touchstart", onPointerEvent, { passive: false });
  }

  function onPointerEvent(ev) {
    // prevent double handling for touch
    if (ev.type === "touchstart") ev.preventDefault();

    // compute normalized device coordinates for the pointer
    const rect = renderer.domElement.getBoundingClientRect();
    let clientX, clientY;
    if (ev.touches && ev.touches.length) {
      clientX = ev.touches[0].clientX;
      clientY = ev.touches[0].clientY;
    } else {
      clientX = ev.clientX;
      clientY = ev.clientY;
    }
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    // run raycast
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    // look for an object with userData.isCanCollision true
    const hit = hits.find(h => h.object && h.object.userData && h.object.userData.isCanCollision);
    if (hit) {
      onCanHit();
    } else {
      // optionally allow "center tap" snap if user tapped near center reticle
      if (Math.abs(mouse.x) < 0.12 && Math.abs(mouse.y) < 0.12) {
        // if tap at center, try to place or hit using center ray
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hits2 = raycaster.intersectObjects(scene.children, true);
        const hit2 = hits2.find(h => h.object && h.object.userData && h.object.userData.isCanCollision);
        if (hit2) onCanHit();
      }
    }
  }

  function onCanHit() {
    if (!gameStarted || gameCompleted) return;
    foundCount++;
    document.getElementById("found-count").textContent = foundCount;
    animateHitEffect();
    // brief scale animation
    if (canGroup) {
      canGroup.scale.setScalar(1.2);
      setTimeout(() => { if (canGroup) canGroup.scale.setScalar(1.0); }, 220);
    }
    if (foundCount >= CANS_TO_FIND) {
      gameCompleted = true;
      setTimeout(() => {
        const popup = document.getElementById("game-complete-popup");
        if (popup) popup.classList.add("visible");
      }, 700);
    } else {
      // show small congrats popup
      const remaining = CANS_TO_FIND - foundCount;
      const congratsTitle = document.getElementById("congrats-title");
      const congratsText = document.getElementById("congrats-text");
      if (congratsTitle) congratsTitle.textContent = `Ótimo! 🎉`;
      if (congratsText) congratsText.textContent = `Você encontrou ${foundCount}/${CANS_TO_FIND} latas! Faltam ${remaining}.`;
      setTimeout(() => {
        const cp = document.getElementById("congrats-popup");
        if (cp) cp.classList.add("visible");
      }, 600);
    }

    // place next can (or hide if finished)
    if (!gameCompleted) {
      placeCanInFrontOfCameraRandomized();
    } else {
      // allow final pause
      // hide the can or leave as-is for effect
    }
  }

  function animateHitEffect() {
    const el = document.createElement("div");
    el.className = "hit-effect";
    document.body.appendChild(el);
    el.style.animation = "hitAnimation 0.8s forwards";
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 900);
  }

  // ====== GAME CONTROL ======
  function startGame() {
    gameStarted = true;
    gameCompleted = false;
    foundCount = 0;
    document.getElementById("found-count").textContent = foundCount;
    // UI toggles (safe-check for elements)
    const welcome = document.getElementById("welcome-screen");
    if (welcome) { welcome.classList.add("hidden"); welcome.style.display = "none"; }
    const uiOverlay = document.getElementById("ui-overlay");
    if (uiOverlay) { uiOverlay.style.display = "flex"; uiOverlay.style.visibility = "visible"; }
    const ret = document.getElementById("reticle");
    if (ret) { ret.style.display = "block"; ret.style.visibility = "visible"; }
    const cameraSwitch = document.querySelector(".camera-switch");
    if (cameraSwitch) { cameraSwitch.style.display = "flex"; cameraSwitch.style.visibility = "visible"; }

    // Place first can in front of camera
    placeCanInFrontOfCameraRandomized();
    console.log("Game started");
  }

  function resetFind() {
    // hide congrats popup and reposition the same can
    const cp = document.getElementById("congrats-popup");
    if (cp) cp.classList.remove("visible");
    placeCanInFrontOfCameraRandomized();
  }

  function restartAll() {
    foundCount = 0;
    gameCompleted = false;
    gameStarted = false;
    document.getElementById("found-count").textContent = "0";
    const popup = document.getElementById("game-complete-popup");
    if (popup) popup.classList.remove("visible");
    // re-show welcome
    const welcome = document.getElementById("welcome-screen");
    if (welcome) { welcome.classList.remove("hidden"); welcome.style.display = "flex"; }
    console.log("Game restarted to initial state");
  }

  // Place can directly in front of camera with a small randomized offset
  function placeCanInFrontOfCameraRandomized() {
    if (!canGroup) return;
    // compute forward vector in world space
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(deviceQuaternion);
    // world position is camera position (0,0,0) + forward * distance
    const base = forward.clone().multiplyScalar(centerPlacementDistance);

    // add small random lateral & vertical offsets in camera local space
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(deviceQuaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(deviceQuaternion);

    const lateral = (Math.random() - 0.5) * 1.2; // +/- 0.6 units
    const vertical = (Math.random() - 0.5) * 0.8; // +/- 0.4 units
    const depthJitter = (Math.random() - 0.2) * 1.5; // small depth jitter

    const pos = new THREE.Vector3().copy(base)
      .add(right.multiplyScalar(lateral))
      .add(up.multiplyScalar(vertical))
      .add(forward.clone().multiplyScalar(depthJitter));

    canGroup.position.copy(pos);
    // ensure can faces camera: rotate to look at camera origin
    canGroup.lookAt(new THREE.Vector3(0, 0, 0));
    // adjust uprightness if model pivot odd
    canGroup.rotation.z = 0;
    canGroup.rotation.x = 0;

    // also ensure collision mesh is at group center (already in our models)
    canGroup.visible = gameStarted && !gameCompleted;
    console.log("Can placed at", pos.toArray().map(n => n.toFixed(2)).join(", "));
  }

  // ====== RENDER LOOP ======
  function animate(t) {
    requestAnimationFrame(animate);

    // smooth floating
    floatClock += 0.01;
    if (canGroup && canGroup.visible && gameStarted && !gameCompleted) {
      canGroup.position.y += Math.sin(floatClock) * 0.0005; // tiny float
      canGroup.rotation.y += 0.003;
    }

    // update camera orientation from latest device quaternion
    // We want the "virtual camera" to use deviceQuaternion, which represents the phone orientation in world space.
    // Since our camera sits at (0,0,0), we apply deviceQuaternion to camera.quaternion.
    camera.quaternion.copy(deviceQuaternion);

    // If camera needs to be mirrored for 'user' facing mode, we can flip the renderer or video via CSS instead.
    // Raycaster uses the camera quaternion and projection correctly.

    // Render
    renderer.render(scene, camera);
  }

  // ====== WINDOW EVENTS ======
  function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ====== EXTERNAL ENTRY (keep name used by your HTML button) ======
  window.startGameFromButton = function () {
    if (!gameStarted) startGame();
  };

  // Expose switchCamera for your existing button if it calls global switchCamera
  window.switchCamera = switchCamera;

  // initialize on page load
  window.addEventListener("load", init);