
// settings:
const _spec = {
  // debug mask:
  /*
  flexibleMaskURL: 'assets/face.glb',
  flexibleMaskPoints: null, // use default points
  kpInfluenceDecay: [80, 120],
  //*/

  // Tiger mask:
  flexibleMaskURL: 'assets/tiger.glb',
  flexibleMaskPoints: {
    'leftEyeExt': [43.89, 46.21, 66.01],
    'rightEyeExt': [-43.89, 46.21, 66.01],

    "mouthLeft": [22.53, -25.82, 88.17],
    "mouthRight": [-22.53, -25.82, 88.17],

    "upperLipBot": [-0.03,-26.01,94.81],
    "lowerLipBot": [-0.03,-30.70,94.04],

    "leftEyeBrowInt": [11.70,64.66,57.81],
    "rightEyeBrowInt": [-11.70,64.66,57.81],
    

    'noseBottom': [-4.319218,4.211337,78.767807],
    'chin': [0,-72.11,87.43]
  }, // use default points
  kpInfluenceDecay: [30, 90],
  //*/

  // Joker mask:
  /*flexibleMaskURL: 'assets/joker.glb',
  kpInfluenceDecay: [80, 120],
  flexibleMaskPoints: {
    'leftEyeInt': [21.349674,35.394482,52.206902],
    'rightEyeInt': [-23.840883,32.907703,51.190865],

    'leftEyeExt': [45.382168,33.370209,40.650257],
    'rightEyeExt': [-47.878849,31.727068,38.971622],

    'leftEyeBot': [34.898476,29.203653,48.174278],
    'rightEyeBot': [-36.916851,27.016085,49.992107],

    'leftEyeTop': [34.667419,41.468987,47.426010],
    'rightEyeTop': [-35.412872,27.571577,47.509209],

    'leftEarBottom': [85.562965,-8.878063,-48.344589],
    'rightEarBottom': [-86.026711,-10.690596,-52.441742],

    'leftEarEarring': [85.692131,-24.354218,-47.434364],
    'rightEarEarring': [-88.032906,-26.962864,-54.601341],
    
    'noseLeft': [11.895759,6.016347,75.094627],
    'noseRight': [-19.127909,5.682226,71.770363],

    'noseBottom': [-4.319218,4.211337,78.767807],
    //'noseOuter':

    "mouthLeft": [32.354263,-35.668781,79.057388],
    "mouthRight": [-30.663645,-37.352539,81.406113],

    "upperLipBot": [1.009513,-30.117674,88.958473],
    "upperLipTop": [5.200364,-22.511208,90.229881],
    "lowerLipTop": [2.776186,-35.271061,87.061325],
    "lowerLipBot": [4.817848,-45.513924,86.717743],

    "leftEyeBrowInt": [11.704453,64.668335,57.814079],
    "rightEyeBrowInt": [-15.655808,63.048557,56.032791],

    'chin': [-6.0169, -71.757, 91.248]
  }, //*/

  // debug flags:
  debugCube: false // display a cube tracking the head
}

let _threeInstances = null;
let _flexibleMaskHelper = null;
let _flexibleMaskMesh = null;

function main(){
  // get the 2 canvas from the DOM:
  const canvasFace = document.getElementById('WebARRocksFaceCanvas');
  const canvasThree = document.getElementById('threeCanvas');

  // Init WebAR.rocks.face through the helper:
  WebARRocksFaceThreeHelper.init({
    spec:  {
      NNCpath: '../../neuralNets/NN_FACE.json'
      /*,videoSettings: {
        idealWidth: 1280,
        idealHeight: 800
      }*/
    },
    canvas: canvasFace,
    canvasThree: canvasThree,
    
    callbackTrack: function(detectStates, landmarksStabilized){
      if (_flexibleMaskMesh === null){
        return;
      }
      _flexibleMaskHelper.update_flexibleMask(_threeInstances.threeCamera, _flexibleMaskMesh, detectStates, landmarksStabilized);
    },

    callbackReady: function(err, threeInstances){
      if (err){
        console.log('ERROR in main.js: ', err);
        return;
      }
      WebARRocksFaceThreeHelper.resize(window.innerWidth, window.innerHeight);
      _flexibleMaskHelper = WebARRocksFaceFlexibleMaskHelper;

      // threeInstances are the THREE.js instances initialized by the helper
      // There are a THREE.Camera, a THREE.Scene and an object following the face
      build_scene(threeInstances);
    }
  }); //end WebARRocksFaceThreeHelper.init() 
} //end main()

function build_scene(threeInstances){
  _threeInstances = threeInstances;
  const threeLoadingManager = new THREE.LoadingManager();

  // add a 3D placeholder:
  if (_spec.debugCube){
    const debugMat = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
    const debugCubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), debugMat);
    debugCubeMesh.scale.multiplyScalar(180);
    _threeInstances.threeFaceFollowers[0].add(debugCubeMesh);
  }

  // add the occluder:
  //WebARRocksFaceThreeHelper.add_occluderFromFile('assets/occluder.glb', null, threeLoadingManager);

  // build and add the flexible mask:
  _flexibleMaskHelper.load_geometryFromGLTF(threeLoadingManager, _spec.flexibleMaskURL, null).then(function(geom){
    const face3DKeypoints = (_spec.flexibleMaskPoints) ? _spec.flexibleMaskPoints : WebARRocksFaceThreeHelper.get_facePointPositions();
    _flexibleMaskMesh = _flexibleMaskHelper.build_flexibleMask(geom, face3DKeypoints, {
      kpInfluenceDecay: _spec.kpInfluenceDecay // [ distance from the keypoint where decay start, distance from the keypoint where decay ends ]
    });
    
    tweak_maskMaterial(_flexibleMaskMesh.material);
    _threeInstances.threeFaceFollowers[0].add(_flexibleMaskMesh);
  }).catch(function(err){
    console.log(err);
  });

  // add lighting:
  const pointLight = new THREE.PointLight(0xffffff, 2);
  _threeInstances.threeScene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  _threeInstances.threeScene.add(ambientLight);

  threeLoadingManager.onLoad = start;
}

function tweak_maskMaterial(mat){
  //mat.opacity.value = 0.6; // make the mask half transparent, for debug
  mat.metalness.value = 0;
  mat.roughness.value = 1; 
}

function start(){
  console.log('INFO in main.js: start()');
}