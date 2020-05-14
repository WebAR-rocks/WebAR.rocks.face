"use strict";

const PI = Math.PI;
const _settings = {
  GLTFModelURL: 'assets/earringsSimple.glb',
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
  WebARRocksEarrings3DHelper.init({
    NN: '../../dist/NN_EARS.json',
    canvasFace: _canvases.face,
    canvasThree: _canvases.three,
    debugOccluder: _settings.debugOccluder,
    callbackReady: function(err, threeStuffs){
      if (err){
        throw new Error(err);
      }
    }
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

    set_lighting();

    if (_settings.GLTFModelURL){
      load_GLTF(_settings.GLTFModelURL, true, true);
    }

    set_occluders();

  }).catch(function(err){
    throw new Error(err);
  });
}

function set_lighting(){
  const hemiLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, 2 );
  _three.scene.add(hemiLight);
}

function load_GLTF(modelURL, isRight, isLeft){
  new THREE.GLTFLoader().load(modelURL, function(gltf){
    const model = gltf.scene;
    model.scale.multiplyScalar(100); // because the model is exported in meters. convert it to cm
    _three.earringRight.add(model);
    _three.earringLeft.add(model.clone()); 
  });
}

function set_occluders(){
  const occluderRightGeom = new THREE.CylinderGeometry(_settings.earsOccluderCylinderRadius, _settings.earsOccluderCylinderRadius, _settings.earsOccluderCylinderHeight);
  const mat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler().fromArray(_settings.earsOccluderCylinderEuler));
  mat.setPosition(new THREE.Vector3().fromArray(_settings.earsOccluderCylinderOffset));
  occluderRightGeom.applyMatrix(mat);
  WebARRocksEarrings3DHelper.add_threeEarsOccluders(occluderRightGeom);
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
    onResize: WebARRocksEarrings3DHelper.resize
  })
}