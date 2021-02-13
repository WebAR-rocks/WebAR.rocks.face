// settings:
const _spec = {
  // debug mask:
  flexibleMaskURL: "assets/The_Hood.glb",
  flexibleMaskPoints: null, // use default points
  kpInfluenceDecay: [80, 120],
  //*/

  // Tiger mask:
  /*
  flexibleMaskURL: "assets/tiger.glb",
  flexibleMaskPoints: {
    leftEyeExt: [43.89, 46.21, 66.01],
    rightEyeExt: [-43.89, 46.21, 66.01],

    mouthLeft: [22.53, -25.82, 88.17],
    mouthRight: [-22.53, -25.82, 88.17],

    upperLipBot: [-0.03, -26.01, 94.81],
    lowerLipBot: [-0.03, -30.7, 94.04],

    leftEyeBrowInt: [11.7, 64.66, 57.81],
    rightEyeBrowInt: [-11.7, 64.66, 57.81],

    noseBottom: [-4.319218, 4.211337, 78.767807],
    chin: [0, -72.11, 87.43],
  }, // use default points */
  kpInfluenceDecay: [30, 90],

  // debug flags:
  debugCube: false, // display a cube tracking the head
}; //

let _threeInstances = null;
let _flexibleMaskHelper = null;
let _flexibleMaskMesh = null;

function main() {
  // get the 2 canvas from the DOM:
  const canvasFace = document.getElementById("WebARRocksFaceCanvas");
  const canvasThree = document.getElementById("threeCanvas");

  // Init WebAR.rocks.face through the helper:
  WebARRocksFaceThreeHelper.init({
    spec: {
      NNCPath: "../../neuralNets/NN_FACE_0.json",
      /*,videoSettings: {
        idealWidth: 1280,
        idealHeight: 800
      }*/
    },
    canvas: canvasFace,
    canvasThree: canvasThree,
    isCenterObjPoints: false,

    callbackTrack: function (detectStates, landmarksStabilized) {
      if (_flexibleMaskMesh === null) {
        return;
      }
      _flexibleMaskHelper.update_flexibleMask(
        _threeInstances.threeCamera,
        _flexibleMaskMesh,
        detectStates,
        landmarksStabilized
      );
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
} //end main()

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

  // add the occluder:
  //WebARRocksFaceThreeHelper.add_occluderFromFile('assets/occluder.glb', null, threeLoadingManager);

  // build and add the flexible mask:
  _flexibleMaskHelper
    .load_geometryFromGLTF(threeLoadingManager, _spec.flexibleMaskURL, null)
    .then(function (geom) {
      const face3DKeypoints = _spec.flexibleMaskPoints
        ? _spec.flexibleMaskPoints
        : WebARRocksFaceThreeHelper.get_facePointPositions();
      _flexibleMaskMesh = _flexibleMaskHelper.build_flexibleMask(
        geom,
        face3DKeypoints,
        {
          kpInfluenceDecay: _spec.kpInfluenceDecay, // [ distance from the keypoint where decay start, distance from the keypoint where decay ends ]
        }
      );

      tweak_maskMaterial(_flexibleMaskMesh.material);
      _threeInstances.threeFaceFollowers[0].add(_flexibleMaskMesh);
    })
    .catch(function (err) {
      console.log(err);
    });

  // add lighting:
  const pointLight = new THREE.PointLight(0xffffff, 2);
  _threeInstances.threeScene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  _threeInstances.threeScene.add(ambientLight);

  threeLoadingManager.onLoad = start;
}

function tweak_maskMaterial(mat) {
  //mat.opacity.value = 0.6; // make the mask half transparent, for debug
  mat.metalness.value = 0;
  mat.roughness.value = 1;
}

function start() {
  console.log("INFO in main.js: start()");
}
