"use strict";

const PI = Math.PI;
const _settings = {
  // 3D model:
  GLTFModelURL: 'assets/earringsSimple.glb',

  // lighting:
  envmapURL: 'assets/venice_sunset_512.hdr',
  pointLightIntensity: 0.8,
  pointLightY: 200, // larger -> move the pointLight to the top
  hemiLightIntensity: 0.8,

  // bloom (set to null to disable):
  bloom: {
    threshold: 0.5, //0.99,
    strength: 8,
    radius: 0.6
  },

  // temporal anti aliasing. Number of samples. 0 -> disabled:
  taaLevel: 3,

  // occluder parameters:
  earsOccluderCylinderRadius: 2,
  earsOccluderCylinderHeight: 0.5, // height of the cylinder, so depth in fact
  earsOccluderCylinderOffset: [0, 1, 0], // +Y -> pull up
  earsOccluderCylinderEuler: [0,PI/6,PI/2,'XYZ'],

  // debug flags:
  debugCube: false,
  debugOccluder: false // set to true to tune earsOccluderCylinder* settings
};

const _canvases = {
  face: null,
  three: null
};

let _three = null;


function start(){
  // Init WebAR.rocks.face through the earrings 3D helper:
  WebARRocksFaceEarrings3DHelper.init({
    NN: '../../neuralNets/NN_EARS_2.json',
    taaLevel: _settings.taaLevel,
    canvasFace: _canvases.face,
    canvasThree: _canvases.three,
    debugOccluder: _settings.debugOccluder,
    callbackReady: function(err){
      if (err){
        throw new Error(err);
      }
    }
    //,videoURL: '../../../../testVideos/1032526922-hd.mov'    
  }).then(function(three){
    
    _three = three;
    if (_settings.debugCube){
      const debugCubeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(2,2,2),
          new THREE.MeshNormalMaterial()
        );
      _three.earringRight.add(debugCubeMesh);
      _three.earringLeft.add(debugCubeMesh.clone()); 
    }

    // improve WebGLRenderer settings:
    _three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _three.renderer.outputEncoding = THREE.sRGBEncoding;

    set_postprocessing();

    set_lighting();

    if (_settings.GLTFModelURL){
      load_GLTF(_settings.GLTFModelURL, true, true);
    }

    set_occluders();

  }).catch(function(err){
    throw new Error(err);
  });
}


function set_postprocessing(){
  // bloom:
  if (_settings.bloom){ // see https://threejs.org/examples/#webgl_postprocessing_unreal_bloom
    // create the bloom postprocessing pass:
    const bloom = _settings.bloom;
    const rendererSize = new THREE.Vector2();
    _three.renderer.getSize(rendererSize);
    const bloomPass = new THREE.UnrealBloomPass( rendererSize,
       bloom.strength,
       bloom.radius,
       bloom.threshold);

    _three.composer.addPass( bloomPass );
  }
}


function set_lighting(){
  if (_settings.envmapURL){
    // image based lighting:
    const pmremGenerator = new THREE.PMREMGenerator( _three.renderer );
    pmremGenerator.compileEquirectangularShader();

    new THREE.RGBELoader().setDataType( THREE.UnsignedByteType )
      .load(_settings.envmapURL, function ( texture ) {
      const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
      pmremGenerator.dispose();
      _three.scene.environment = envMap;
    });

  } 
  
  // simple lighting:
  //  We add a soft light. Should not be necessary if we use an envmap:
  if (_settings.hemiLightIntensity > 0) {
    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x000000, _settings.hemiLightIntensity );
    _three.scene.add(hemiLight);
  }

  // add a pointLight to highlight specular lighting:
  if ( _settings.pointLightIntensity > 0){
    const pointLight = new THREE.PointLight( 0xffffff, _settings.pointLightIntensity );
    pointLight.position.set(0, _settings.pointLightY, 0);
    _three.scene.add(pointLight);
  }
}


function load_GLTF(modelURL, isRight, isLeft){
  new THREE.GLTFLoader().load(modelURL, function(gltf){
    const model = gltf.scene;
    model.scale.multiplyScalar(100); // because the model is exported in meters. convert it to cm
    set_shinyMetal(model);
    _three.earringRight.add(model);
    _three.earringLeft.add(model.clone()); 
  });
}


function set_shinyMetal(model){
  model.traverse(function(threeStuff){
    if (!threeStuff.isMesh){
      return;
    }
    const mat = threeStuff.material;
    mat.roughness = 0;
    mat.metalness = 1;
    mat.refractionRatio = 1;
  });
}


function set_occluders(){
  const occluderRightGeom = new THREE.CylinderGeometry(_settings.earsOccluderCylinderRadius, _settings.earsOccluderCylinderRadius, _settings.earsOccluderCylinderHeight);
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler().fromArray(_settings.earsOccluderCylinderEuler));
  matrix.setPosition(new THREE.Vector3().fromArray(_settings.earsOccluderCylinderOffset));
  occluderRightGeom.applyMatrix4(matrix);
  WebARRocksFaceEarrings3DHelper.add_threeEarsOccluders(occluderRightGeom);
}


function main(){
  // get the 2 canvas from the DOM:
  _canvases.face = document.getElementById('WebARRocksFaceCanvas');
  _canvases.three = document.getElementById('threeCanvas');

  // Set the canvas to fullscreen
  // and add an event handler to capture window resize:
  WebARRocksResizer.size_canvas({
    isFullScreen: true,
    canvas: _canvases.face,     // WebARRocksFace main canvas
    overlayCanvas: [_canvases.three], // other canvas which should be resized at the same size of the main canvas
    callback: start,
    onResize: WebARRocksFaceEarrings3DHelper.resize
  })
}