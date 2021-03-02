const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({alpha: true});
var clock = new THREE.Clock();
var mixer = null;
var openMouth;
var blinkL;
var blinkR;

renderer.setClearColor(0xffffff, 0);
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild( renderer.domElement );

//make the screen responsible
window.addEventListener('resize', function()
{
  var width = window.innerWidth;
  var height = window.innerHeight;
  renderer.setSize(width,height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix( );
});

//load all 3D models on a scene
//the meshes must be on the same GLTF file
//just write the file directory (assets/3DMoodels/WATEVERTHEFILENAME.gltf)
function loadMesh() {
  var mesh = "assets/3DModels/TheHeroMage/Export/HeroMage.glb";
  const autoLoader = new THREE.GLTFLoader();
  autoLoader.load(mesh, function(gltf){

    gltf.scene.traverse(function(node){
    if (node.isSkinnedMesh) {
      node.castShadow = true;
      node.receiveShadow = true;}
    });

    mixer = new THREE.AnimationMixer( gltf.scene );

    openMouth = mixer.clipAction(gltf.animations[0]);
    openMouth.setLoop( THREE.LoopOnce);
    blinkL = mixer.clipAction(gltf.animations[1]);
    blinkL.setLoop( THREE.LoopOnce);
    blinkR = mixer.clipAction(gltf.animations[2]);
    blinkR.setLoop( THREE.LoopOnce);

    scene.add(gltf.scene);
    //for (var i = 0; i < gltf.animations.length; i++) {
    //  mixer.clipAction( gltf.animations[i]).play();
    //}
  });
}

//setup lighting
var ambientLight = new THREE.AmbientLight( 0xB2F0FF, 3);
scene.add(ambientLight);

var pointLight = new THREE.PointLight( 0xF37827, 3 ,500)
pointLight.position.set( 100 ,200 ,100 );
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 512; // default
pointLight.shadow.mapSize.height = 512; // default
pointLight.shadow.camera.near = 0.5; // default
pointLight.shadow.camera.far = 500; // default
scene.add(pointLight);

camera.position.z = 200;

//rebdering each frame
const animate = function () {
  requestAnimationFrame( animate );

  if ( mixer ) {
    mixer.update( clock.getDelta() );}
  renderer.render( scene, camera );
};

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
        range: [0.23, 0.25],
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
      if ( openMouth !== null ) {

        openMouth.stop();
        openMouth.play();

      }
      console.log("TRIGGER FIRED - MOUTH OPEN");
    },
    onEnd: function () {
      console.log("TRIGGER FIRED - MOUTH CLOSED");
    },
  });

  WebARRocksFaceExpressionsEvaluator.add_trigger("CLOSE_LEFT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function () {
      if ( blinkL !== null ) {

        blinkL.stop();
        blinkL.play();

      }
      console.log("TRIGGER FIRED - L EYE CLOSED");
    },
    onEnd: function () {
      console.log("TRIGGER FIRED - L EYE OPEN");
    },
  });

  WebARRocksFaceExpressionsEvaluator.add_trigger("CLOSE_RIGHT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function () {
      if ( blinkR !== null ) {

        blinkR.stop();
        blinkR.play();

      }
      console.log("TRIGGER FIRED - R EYE CLOSED");
    },
    onEnd: function () {
      console.log("TRIGGER FIRED - R EYE OPEN");
    },
  });
}

function start() {
  loadMesh();
  WebARRocksFaceDebugHelper.init({
    spec: {}, // keep default specs
    callbackReady: function (err, spec) {
      init_evaluators();
      init_triggers();
    },
    callbackTrack: function (detectState) {
      const expressionsValues = WebARRocksFaceExpressionsEvaluator.evaluate_expressions(
        detectState
      );
      //console.log(expressionsValues.OPEN_MOUTH);
      WebARRocksFaceExpressionsEvaluator.run_triggers(expressionsValues);
    },
  });
}

function main() {
  WebARRocksResizer.size_canvas({
    canvasId: "WebARRocksFaceCanvas",
    callback: start,
  });
}


animate();
