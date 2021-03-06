// settings:
var clock = new THREE.Clock();
var mixer = null;
var openMouth = null;
var blinkL = null;
var blinkR = null;

const _spec = {
  maskURL: "./assets/HeroMageOrange.glb",
  maskARMetadataURL: "./assets/foolMaskARMetadata.json",

  // debug flags:
  debugCube: false, //display a cube tracking the head
};

let _threeInstances = null;
let _flexibleMaskHelper = null;
let _flexibleMaskMesh = null;
let _ARTrackingRootObject = null;
let i = 0;

function start() {
  // get the 2 canvas from the DOM:
  const canvasFace = document.getElementById("WebARRocksFaceCanvas");
  const canvasThree = document.getElementById("threeCanvas");

  WebARRocksFaceThreeHelper.init({
    spec: {
      NNCPath: "../../neuralNets/NN_FACE_0.json",
    },
    canvas: canvasFace,
    canvasThree: canvasThree,

    callbackTrack: function (detectStates, landmarksStabilized) {
      if (_flexibleMaskMesh === null) {
        return;
      }
      i++;
    },

    callbackTrack: function (detectState) {
      const expressionsValues = WebARRocksFaceExpressionsEvaluator.evaluate_expressions(
        detectState
      );
      //console.log(expressionsValues.OPEN_MOUTH);
      WebARRocksFaceExpressionsEvaluator.run_triggers(expressionsValues);
    },

    callbackReady: function (err, threeInstances) {
      if (err) {
        console.log("ERROR in main.js: ", err);
        return;
      }
      WebARRocksFaceThreeHelper.resize(window.innerWidth, window.innerHeight);
      _flexibleMaskHelper = WebARRocksFaceFlexibleMaskHelper;

      // threeInstances are the THREE.js instances initialized by the helper
      // There are a THREE.Camera, a THREE.Scene and an object following the face
      build_scene(threeInstances);
    },
  }); //end WebARRocksFaceThreeHelper.init()
} //end of  start

function build_scene(threeInstances) {
  _threeInstances = threeInstances;
  const threeLoadingManager = new THREE.LoadingManager();

  // add a 3D placeholder:
  if (_spec.debugCube) {
    const debugMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    const debugCubeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      debugMat
    );
    debugCubeMesh.scale.multiplyScalar(180);
    _threeInstances.threeFaceFollowers[0].add(debugCubeMesh);
  }

  // build and add the flexible mask:
  new THREE.GLTFLoader(threeLoadingManager).load(
    _spec.maskURL,
    function (model) {
      _ARTrackingRootObject = model.scene;

      model.scene.traverse(function (node) {
        if (node.isSkinnedMesh || node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      mixer = new THREE.AnimationMixer(model.scene);

      openMouth = mixer.clipAction(model.animations[0]);
      openMouth.setLoop(THREE.LoopOnce);
      blinkL = mixer.clipAction(model.animations[1]);
      blinkL.setLoop(THREE.LoopOnce);
      blinkR = mixer.clipAction(model.animations[2]);
      blinkR.setLoop(THREE.LoopOnce);
    }
  );

  // add the occluder:
  //  WebARRocksFaceThreeHelper.add_occluderFromFile(
  //    _spec.occluderURL,
  //    function (occluder) {
  //      occluder.scale.multiplyScalar(_spec.occluderScale);
  //    },
  //    threeLoadingManager,
  //    _spec.occluderDebug
  //  );

  // add tone mapping:
  _threeInstances.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  _threeInstances.threeRenderer.outputEncoding = THREE.sRGBEncoding;

  // add lighting:
  const pointLight = new THREE.PointLight(0xffffff, 1);
  _threeInstances.threeScene.add(pointLight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  _threeInstances.threeScene.add(ambientLight);

  threeLoadingManager.onLoad = fetch_ARTrackingMetaData;

  init_evaluators();
  init_triggers();
}

function fetch_ARTrackingMetaData() {
  console.log("INFO in main.js: fetch_ARTrackingMetaData()");

  // load ARTRACKING Medadata separately:
  fetch(_spec.maskARMetadataURL).then((response) => {
    response.json().then(function (ARTrackingMetaData) {
      // look for Face tracking metadata among ARMetadata:
      const ARTrackingFaceMetadata = ARTrackingMetaData["ARTRACKING"].filter(
        function (ARTrackingExperience) {
          return ARTrackingExperience["TYPE"] === "FACE";
        }
      );
      if (ARTrackingFaceMetadata.length === 0) {
        throw new Error("No Face AR tracking experience where found");
      }
      const ARTrackingExperience = ARTrackingFaceMetadata[0];

      // build flexible mask mesh. It will be removed from ARTrackingRootObject
      _flexibleMaskMesh = _flexibleMaskHelper.build_flexibleMaskFromStdMetadata(
        _ARTrackingRootObject,
        ARTrackingExperience,
        false
      );

      // add flexible mask mesh and remaining of ARTrackingRootObject (rigid stuffs) to the face follower object:
      _threeInstances.threeFaceFollowers[0].add(
        _flexibleMaskMesh,
        _ARTrackingRootObject
      );
    });
  });
}

function init_evaluators() {
  // run WEBARROCKSFACE.get_LMLabels() in the web console
  // to get landmarks labels provided by the current neural network

  // MOUTH:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator("OPEN_MOUTH", {
    refLandmarks: ["lowerLipTop", "chin"],
    landmarks: ["lowerLipTop", "upperLipBot"],
    range: [0.05, 0.45],
    isInv: false,
    isDebug: true,
  });

  // OPEN/CLOSE EYES:
  const closeEyeEvaluatorParams = {
    isInv: true,
    isDebug: true,
    delayMinMs: 500,
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator(
    "CLOSE_LEFT_EYE",
    Object.assign(
      {
        range: [0.18, 0.21],
        refLandmarks: ["leftEyeInt", "leftEyeExt"],
        landmarks: ["leftEyeTop", "leftEyeBot"],
      },
      closeEyeEvaluatorParams
    )
  );
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator(
    "CLOSE_RIGHT_EYE",
    Object.assign(
      {
        range: [0.18, 0.21],
        refLandmarks: ["rightEyeInt", "rightEyeExt"],
        landmarks: ["rightEyeTop", "rightEyeBot"],
      },
      closeEyeEvaluatorParams
    )
  );
}

function init_triggers() {
  WebARRocksFaceExpressionsEvaluator.add_trigger("OPEN_MOUTH", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function () {
      if (openMouth !== null) {
        openMouth.stop();
        openMouth.play();
      }
      //console.log("TRIGGER FIRED - MOUTH OPEN");
    },
    onEnd: function () {
      //console.log("TRIGGER FIRED - MOUTH CLOSED");
    },
  });

  WebARRocksFaceExpressionsEvaluator.add_trigger("CLOSE_LEFT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function () {
      if (blinkL !== null) {
        blinkL.stop();
        blinkL.clampWhenFinished = true;
        blinkL.timeScale = 1;
        blinkL.play();
      }
      //console.log("TRIGGER FIRED - L EYE CLOSED");
    },
    onEnd: function () {
      if (blinkL !== null) {
        blinkL.stop();
        blinkL.clampWhenFinished = false;
        blinkL.timeScale = -1;
        blinkL.play();
      }
      //console.log("TRIGGER FIRED - L EYE OPEN");
    },
  });

  WebARRocksFaceExpressionsEvaluator.add_trigger("CLOSE_RIGHT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function () {
      if (blinkR !== null) {
        blinkR.stop();
        blinkR.clampWhenFinished = true;
        blinkR.timeScale = 1;
        blinkR.play();
      }
      //console.log("TRIGGER FIRED - R EYE CLOSED");
    },
    onEnd: function () {
      if (blinkR !== null) {
        blinkR.stop();
        blinkR.clampWhenFinished = false;
        blinkR.timeScale = -1;
        blinkR.play();
      }
      //console.log("TRIGGER FIRED - R EYE OPEN");
    },
  });
}

function main() {
  WebARRocksResizer.size_canvas({
    canvasId: "WebARRocksFaceCanvas",
    callback: start,
  });
}

const animate = function () {
  requestAnimationFrame(animate);

  if (mixer) {
    mixer.update(clock.getDelta());
  }
};

animate();
