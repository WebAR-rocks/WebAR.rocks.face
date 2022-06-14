// settings:
const _settings = {
  maskPath: 'assets/readyPlayerMeSkinned5_1.glb',
  moveFactorEyes: 1.4,  // eyebrows movement amplitude
  moveFactorNose: 1.2,  // nose side movement amplitude

  moveFactorMouth: 1.4, // mouth movement amplitude
  moveFactorMouthCenter: 1.1,
  moveFactorMouthCorners: 1.0, // lower than mouth movement amplitude to avoid collision with teeth if mouth open wide

  isDebugSetMatTransparent: false // set mask material transparent for debugging purpose
}


// enum for the state:
const _states = {
    error: -3,
    notLoaded: -1,
    loading: -2,
    idle: 0,
    pause: 1
  };
let _state = _states.notLoaded;

let _threeInstances = null;
let _autobones = null;
let _isAvatar = false;
let _threeAvatar = null, _threeMask = null, _threeAvatarSkinnedMesh = null;

let _canvases = {
  face: null,
  three: null
};


// Entry point:
function main(){
  // get the 2 canvas from the DOM:
  _canvases.face = document.getElementById('WebARRocksFaceCanvas');
  _canvases.three = document.getElementById('threeCanvas');

  resize_canvasFullScreen(_canvases.face);
  resize_canvasFullScreen(_canvases.three);

  init_WebarRocksFace(_canvases.face, _canvases.three, 
    { // spec for WEBARROCKSFACE
      NNCPath: '../../neuralNets/NN_AUTOBONES2_0.json',
      scanSettings: {
        threshold: 0.8,
        isCleanGLStateAtEachIteration: false,
      }
    }).then(setup_UI);
}


function setup_UI(){
  // display controls:
  document.getElementById('controls').style.display = 'flex';

  // handle orientation change or window resizing:
  const resizeCallback = function(){
    resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('orientationchange', resizeCallback);
  window.addEventListener('resize', resizeCallback);
}


function resize_canvasFullScreen(cv){
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth * dpr;
  const h = window.innerHeight * dpr;
  cv.width = w;
  cv.height = h;
}


function init_WebarRocksFace(canvasFace, canvasThree, specWebARRocksFace){
  return new Promise(function(resolve, reject){
    // Init WebAR.rocks.face through the helper:
    const webARRocksSpec = {
      spec: specWebARRocksFace,
      canvas: canvasFace,
      canvasThree: canvasThree,
      videoURL: null,
      
      landmarksStabilizerSpec: {},

      solvePnPImgPointsLabels: ['chin',
        'leftEarBottom',
        'rightEarBottom',
        'noseBottom',
        'leftEyeExt',
        'rightEyeExt'],

      //rxOffset: -15 * (Math.PI / 180), // Rotation to reposition the mask tilted down

      callbackReady: function(err, threeInstances){
        if (err){
          reject(err);
          _state = _states.error;
          return;
        }
        _threeInstances = threeInstances;
        build_scene();
        _state = _states.idle;
        resolve();
      },

      callbackTrack: callbackTrack
    };
    
    WebARRocksFaceThreeHelper.init(webARRocksSpec);
  }); //end returned promise
}


function tweak_materialsToBasic(threeObject){
  threeObject.traverse(function(threeNode){
    if (!threeNode.material){
      return;
    }
    threeNode.userData.originalMaterial = threeNode.material;
    const mat = threeNode.material;
    threeNode.material = new THREE.MeshBasicMaterial({
      map: mat.map,
      color: mat.color
    });
    if (_settings.isDebugSetMatTransparent){
      threeNode.material = new THREE.MeshNormalMaterial();
      threeNode.material.transparent = true;
      threeNode.material.opacity = 0.5;
      threeNode.material.side = THREE.DoubleSide;
    }
  })
}


function extract_autobonesSkinnedMesh(threeRoot){
  let skm = null;
  threeRoot.traverse(function(threeNode){
    if (threeNode.name === 'Wolf3D_Head'){
    //if (threeNode.isSkinnedMesh){
      skm = threeNode;
    }
  });

  return skm;
}


function build_scene(){
  // add a useless pointlight
  //const pointLight = new THREE.PointLight(0xffffff, 1);
  //_threeInstances.threeScene.add(pointLight);

  // create three avatar fixed parent (only used in avatar mode):
  const threeAvatarFixedParent = new THREE.Object3D();
  threeAvatarFixedParent.position.set(0, 30, -1200);
  _threeInstances.threeScene.add(threeAvatarFixedParent);

  _threeInstances.threeRenderer.outputEncoding = THREE.sRGBEncoding;
    
  const tracker = _threeInstances.threeFaceFollowers[0];
  new THREE.GLTFLoader().load(_settings.maskPath, function(gltf){
    _threeMask = gltf.scene;
    tweak_materialsToBasic(_threeMask);
    _autobones = create_autobones(_threeMask);

    // create avatar:
    _threeAvatar = THREE.SkeletonUtils.clone(_threeMask);
    _threeAvatar.visible = false;
    _threeAvatarSkinnedMesh = extract_autobonesSkinnedMesh(_threeAvatar);
    
    threeAvatarFixedParent.add(_threeAvatar);
    tracker.add(_threeMask);
  });
}


function create_autobones(threeRoot){
  const autobonesSkinnedMesh = extract_autobonesSkinnedMesh(threeRoot);
  const moveFactorsPerAutobone = {
    RBrow: _settings.moveFactorEyes,
    LBrow: _settings.moveFactorEyes,

    //NOSE:
    RNostril: _settings.moveFactorNose,
    LNostril: _settings.moveFactorNose,

    // MOUTH:
    UpperLipCenter: _settings.moveFactorMouthCenter,
    LUpperLip: _settings.moveFactorMouth,
    LLipCorner: _settings.moveFactorMouthCorners,
    LLowerLip: _settings.moveFactorMouth,
    LowerLipCenter: _settings.moveFactorMouthCenter,
    RLowerLip: _settings.moveFactorMouth,
    RLipCorner: _settings.moveFactorMouthCorners,
    RUpperLip: _settings.moveFactorMouth
  };

  const autobones =  new BadgerAutobones(
    autobonesSkinnedMesh,
    {
      // map autobones (by bones names) to WebAR;face landmarks:
      // EYES:
      RBrow: 'rightEyeBrowCenter',
      LBrow: 'leftEyeBrowCenter',

      //NOSE:
      RNostril: 'noseRight',
      LNostril: 'noseLeft',

      // MOUTH:
      UpperLipCenter: 'upperLipTop',
      LUpperLip: 'upperLipTopLeft',
      LLipCorner: 'mouthLeft',
      LLowerLip: 'lowerLipBotLeft',
      LowerLipCenter: 'lowerLipBot',
      RLowerLip: 'lowerLipBotRight',
      RLipCorner: 'mouthRight',
      RUpperLip: 'upperLipTopRight',
    },
    { // options
      webARRocksLandmarks: WEBARROCKSFACE.get_LMLabels(),
      moveFactorsPerAutobone: moveFactorsPerAutobone,
      isSubMeanDisplacement: true,
      isMoveRootByMeanDisplacement: false
    });

  return autobones;
}


function callbackTrack(detectStates, landmarksStabilized){
  if (!landmarksStabilized) return;

  if (_autobones){
    _autobones.update_fromWebARRocks(_threeInstances.threeCamera, landmarksStabilized);
    if (_isAvatar){
      sync_avatarAutobones();
    }
  }

  if (_isAvatar){
    sync_avatarRotation();
  }
}


function sync_avatarAutobones(){
  _threeAvatarSkinnedMesh.skeleton.bones.forEach(function(bone, boneIndex){
    const autoBone = _autobones.skinnedMesh.skeleton.bones[boneIndex];
    bone.position.copy(autoBone.position);
  });
}


function sync_avatarRotation(){
  _threeAvatar.rotation.setFromRotationMatrix(_threeMask.matrixWorld);
}


function pause(isStopVideoStream){
  if (_state !== _states.idle){
    return false;
  }
  WEBARROCKSFACE.toggle_pause(true, isStopVideoStream);
  _state = _states.pause;
  return true;
}


function resume(isStopVideoStream){
  if (_state !== _states.pause){
    return false;
  }
  WEBARROCKSFACE.toggle_pause(false, isStopVideoStream);
  _state = _states.idle;
  return true;
}


let _timerResize = null;
function resize(width, height){
  if (_state !== _states.pause && _state !== _states.idle){
    return false;
  }
  // We need to avoid to resize too often
  // So we put a timer
  if (_timerResize !== null){
    window.clearTimeout(_timerResize);
  }

  _timerResize = setTimeout(function(){
    const s = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
    WebARRocksFaceThreeHelper.resize(width * s, height * s);
    _timerResize = null;
  }, 50);
  return true;
}


function toggle_mode(){
  _isAvatar = !_isAvatar;

  // don't update video background in avatar mode:
  WebARRocksFaceThreeHelper.set_isDrawVideo(!_isAvatar);

  // hide video element in avatar mode:
  _canvases.face.style.display = (_isAvatar) ? 'none' : 'block';

  if (_isAvatar){ // append avatar directly to the scene in avatar mode:
    _threeAvatar.visible = true;
    _threeMask.visible = false;
  } else { // append avatar to tracker in mask mode
    _threeAvatar.visible = false;
    _threeMask.visible = true;
  }
  document.getElementById('toggleModeButton').innerHTML = (_isAvatar) ? 'Mask mode' : 'Avatar mode';
}


window.addEventListener('load', main);