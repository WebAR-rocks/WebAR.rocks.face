
// settings:
const _spec = {
  maskURL: 'assets/foolMask.glb',
  maskARMetadataURL: 'assets/foolMaskARMetadata.json',
 
  // debug flags:
  debugCube: false //display a cube tracking the head
}

let _threeInstances = null;
let _flexibleMaskHelper = null;
let _flexibleMaskMesh = null;
let _ARTrackingRootObject = null;

function main(){
  // get the 2 canvas from the DOM:
  const canvasFace = document.getElementById('WebARRocksFaceCanvas');
  const canvasThree = document.getElementById('threeCanvas');

  // Init WebAR.rocks.face through the helper:
  WebARRocksFaceThreeHelper.init({
    spec:  {
      NNCpath: '../../neuralNets/NN_FACE.json'
    },
    canvas: canvasFace,
    canvasThree: canvasThree,
    
    callbackTrack: function(detectStates){
      if (_flexibleMaskMesh === null){
        return;
      }
      _flexibleMaskHelper.update_flexibleMask(_threeInstances.threeCamera, _flexibleMaskMesh, detectStates);
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

  // build and add the flexible mask:
  new THREE.GLTFLoader(threeLoadingManager).load(_spec.maskURL, function(model){
    _ARTrackingRootObject = model.scene;
  });

  // add the occluder:
  WebARRocksFaceThreeHelper.add_occluderFromFile('assets/occluder.glb', null, threeLoadingManager);

  // add tone mapping:
  _threeInstances.threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  _threeInstances.threeRenderer.outputEncoding = THREE.sRGBEncoding;

  // add lighting:
  const pointLight = new THREE.PointLight(0xffffff, 1);
  _threeInstances.threeScene.add(pointLight);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  _threeInstances.threeScene.add(ambientLight);
  
  threeLoadingManager.onLoad = fetch_ARTrackingMetaData;
}


function fetch_ARTrackingMetaData(){
  console.log('INFO in main.js: fetch_ARTrackingMetaData()');

  // load ARTRACKING Medadata separately:
  fetch(_spec.maskARMetadataURL).then((response) => {
    response.json().then(function(ARTrackingMetaData){
      
      // look for Face tracking metadata among ARMetadata:
      const ARTrackingFaceMetadata = ARTrackingMetaData['ARTRACKING'].filter(function(ARTrackingExperience){
        return (ARTrackingExperience['TYPE'] === "FACE");
      });
      if (ARTrackingFaceMetadata.length === 0){
        throw new Error('No Face AR tracking experience where found');
      }
      const ARTrackingExperience = ARTrackingFaceMetadata[0];

      // build flexible mask mesh. It will be removed from ARTrackingRootObject
      _flexibleMaskMesh = _flexibleMaskHelper.build_flexibleMaskFromStdMetadata(_ARTrackingRootObject,  ARTrackingExperience, false);

      // add flexible mask mesh and remaining of ARTrackingRootObject (rigid stuffs) to the face follower object:
      _threeInstances.threeFaceFollowers[0].add(_flexibleMaskMesh, _ARTrackingRootObject);

    });
  });

}