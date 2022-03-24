// settings:
const _spec = {
  maskURL: "./assets/HeroMage.glb",
  // maskURL: "./assets/HeroMageOrange.glb",
  // XAVIER: we don't need flexible mask for this face filter
  maskARMetadataURL: null, //"./assets/armetadata.json",

  // debug flags:
  debugCube: false, //display a cube tracking the head

  // XAVIER: we will apply physics to this skinndMesh:
  physicsSkinnedMeshName: 'The_Hood',
  isDebugPhysics: false,

  // XAVIER: bone physics
  // DEFAULT is for all bones
  bonesPhysics: {
    The_Hood_Rig: null, // this bone should not move
    DEFAULT: { // applied to all other bones:
      damper: 2,
      spring: 20
    }
  }
};


import { ZboingZboingPhysics } from '../../libs/threeZboingZboing/ZboingZboingPhysics.js';


let _threeInstances = null;
let _flexibleMaskHelper = null;
let _flexibleMaskMesh = null;
let _ARTrackingRootObject = null;

// animation variables:
const _threeClock = new THREE.Clock();
let _threeAnimationMixer = null;
const _animationActions = {
  openMouth: null,
  blinkLeft: null,
  blinkRight: null
};

// XAVIER: instance of ZboingZboingPhysics:
let _physics = null;


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

    callbackTrack: function (detectState) {
      // XAVIER: animate is useless, callbackTrack does the job
      
      // update animations:
      if (_threeAnimationMixer) {
        _threeAnimationMixer.update(_threeClock.getDelta());
      }

      // update physics:
      if (_physics){
        _physics.update();
      }

      // update expressions:
      const expressionsValues = WebARRocksFaceExpressionsEvaluator.evaluate_expressions(
        detectState
      );      
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

      // set shadows and get skinnedMesh:
      let skinnedMesh = null;
      model.scene.traverse(function (node) {
        if (node.isSkinnedMesh || node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
        if (node.isSkinnedMesh && node.name === _spec.physicsSkinnedMeshName){
          skinnedMesh = node;
        }
      });

      // XAVIER: set physics:
      if (skinnedMesh){
        _physics = new ZboingZboingPhysics(_threeInstances.threeScene, skinnedMesh, _spec.bonesPhysics, {
          isDebug: _spec.isDebugPhysics
        });
      }

      // set animation:
      // we need to use physics to create the animationMixer
      // because it will be linked to the rigid (and hidden) skeleton
      /*if (_physics){
        _threeAnimationMixer = _physics.create_animationMixer();
      } else {
        _threeAnimationMixer = new THREE.AnimationMixer(model.scene);
      }*/
      _threeAnimationMixer = new THREE.AnimationMixer(model.scene);

      _animationActions.openMouth = _threeAnimationMixer.clipAction(model.animations[0]);
      _animationActions.openMouth.setLoop(THREE.LoopOnce);
      _animationActions.blinkLeft = _threeAnimationMixer.clipAction(model.animations[1]);
      _animationActions.blinkLeft.setLoop(THREE.LoopOnce);
      _animationActions.blinkRight = _threeAnimationMixer.clipAction(model.animations[2]);
      _animationActions.blinkRight.setLoop(THREE.LoopOnce);
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

  if (!_spec.maskARMetadataURL){
    _threeInstances.threeFaceFollowers[0].add(_ARTrackingRootObject);
    return;
  }

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
      if (_animationActions.openMouth !== null) {
        _animationActions.openMouth.stop();
        _animationActions.openMouth.play();
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
      if (_animationActions.blinkLeft !== null) {
        _animationActions.blinkLeft.stop();
        _animationActions.blinkLeft.clampWhenFinished = true;
        _animationActions.blinkLeft.timeScale = 1;
        _animationActions.blinkLeft.play();
      }
      //console.log("TRIGGER FIRED - L EYE CLOSED");
    },
    onEnd: function () {
      if (_animationActions.blinkLeft !== null) {
        _animationActions.blinkLeft.stop();
        _animationActions.blinkLeft.clampWhenFinished = false;
        _animationActions.blinkLeft.timeScale = -1;
        _animationActions.blinkLeft.play();
      }
      //console.log("TRIGGER FIRED - L EYE OPEN");
    },
  });

  WebARRocksFaceExpressionsEvaluator.add_trigger("CLOSE_RIGHT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function () {
      if (_animationActions.blinkRight !== null) {
        _animationActions.blinkRight.stop();
        _animationActions.blinkRight.clampWhenFinished = true;
        _animationActions.blinkRight.timeScale = 1;
        _animationActions.blinkRight.play();
      }
      //console.log("TRIGGER FIRED - R EYE CLOSED");
    },
    onEnd: function () {
      if (_animationActions.blinkRight !== null) {
        _animationActions.blinkRight.stop();
        _animationActions.blinkRight.clampWhenFinished = false;
        _animationActions.blinkRight.timeScale = -1;
        _animationActions.blinkRight.play();
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

window.onload = main;

