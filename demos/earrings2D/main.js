"use strict";

const _canvases = {
  face: null, 
  overlay:null
};
let _ctx = null, _earringImage = null;

const _earringSettings = {
  image: 'images/earring.png',
  angleHide: 5, // head rotation angle in degrees from which we should hide the earrings
  angleHysteresis: 0.5, // add hysteresis to angleHide value, in degrees
  scale: 0.08,    // width of the earring compared to the face width (1 -> 100% of the face width)
  pullUp: 0.05,   // 0 -> earring are displayed at the bottom of the spotted position
                  // 1 -> earring are displaed above the spotted position 
  k: 0.7,  // position is interpolated between 2 keypoints. this is the interpolation coefficient
           // 0-> earrings are at the bottom of the ear, 1-> earrings are further back
}

const _earringsVisibility = {
  right: false,
  left: false
};

function start(){
  WebARRocksFaceCanvas2DHelper.init({
    spec: {
      NNCpath: '../../neuralNets/NN_EARS.json', // neural network model file
      canvas: _canvases.face
    },

    callbackReady: function(err, spec){ // called when everything is ready
      if (err) {
        console.log('ERROR in demo.js: ', err);
        return;
      }

      console.log('INFO in demo.js: WebAR.rocks.face is ready :)');
    },

    callbackTrack: function(detectState){
      clear_canvas();
      if (detectState.isDetected){
        draw_faceCrop(detectState.faceCrop);
        draw_earrings(detectState.landmarks, detectState.faceWidth, detectState.ry);
      } else {
        _earringsVisibility.right = true;
        _earringsVisibility.left = true;
      }
    }
  });
}

function mix_landmarks(posA, posB, k){
  return [
    posA[0] * (1-k) + posB[0] * k, // X
    posA[1] * (1-k) + posB[1] * k  // Y
  ];
}

function draw_faceCrop(faceCrop){
  _ctx.strokeStyle = 'lime';
  _ctx.beginPath();
  _ctx.moveTo(faceCrop[0][0], faceCrop[0][1]);
  _ctx.lineTo(faceCrop[1][0], faceCrop[1][1]);
  _ctx.lineTo(faceCrop[2][0], faceCrop[2][1]);
  _ctx.lineTo(faceCrop[3][0], faceCrop[3][1]);
  _ctx.closePath();
  _ctx.stroke();
}

function draw_earrings(landmarks, faceWidth, ry){
  const scale = _earringSettings.scale * faceWidth / _earringImage.width
  
  // right earring:
  const rightEarringAngleHide = -_earringSettings.angleHide - _earringSettings.angleHysteresis * ((_earringsVisibility.right) ? 1 : -1);
  if (ry > rightEarringAngleHide){
    const pos = mix_landmarks(landmarks.rightEarBottom, landmarks.rightEarEarring, _earringSettings.k);
    draw_earring(pos, scale);
    _earringsVisibility.right = true;
  } else {
    _earringsVisibility.right = false;
  }

  // left earring:
  const leftEarringAngleHide = -_earringSettings.angleHide - _earringSettings.angleHysteresis * ((_earringsVisibility.left) ? 1 : -1);
  if (-ry > leftEarringAngleHide){
    const pos = mix_landmarks(landmarks.leftEarBottom, landmarks.leftEarEarring, _earringSettings.k);
    draw_earring(pos, scale); 
    _earringsVisibility.left = true;
  } else {
    _earringsVisibility.left = false;
  }
}

function draw_earring(pos, scale){
  const dWidth = scale * _earringImage.width;
  const dHeight = scale * _earringImage.height;
  const dx = pos[0] - dWidth/2.0; //earring are centered horizontally
  const dy = pos[1] - dHeight * _earringSettings.pullUp;
  _ctx.drawImage(_earringImage, dx, dy, dWidth, dHeight);
}

function clear_canvas(){
  _ctx.clearRect(0, 0, _canvases.overlay.width, _canvases.overlay.height);
}

function main(){
  // Create earring image:
  _earringImage = new Image();
  _earringImage.src = _earringSettings.image;

  // Get canvas from the DOM:
  _canvases.face = document.getElementById('WebARRocksFaceCanvas');
  _canvases.overlay = document.getElementById('overlayCanvas');

  // Create 2D context for the overlay canvas (where the earring are drawn):
  _ctx = _canvases.overlay.getContext('2d'); 

  // Set the canvas to fullscreen
  // and add an event handler to capture window resize:
  WebARRocksResizer.size_canvas({
    isFullScreen: true,
    canvas: _canvases.face,     // WebARRocksFace main canvas
    overlayCanvas: [_canvases.overlay], // other canvas which should be resized at the same size of the main canvas
    callback: start
  })
}