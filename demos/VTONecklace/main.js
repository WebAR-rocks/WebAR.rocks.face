
function main(){
  // get the 2 canvas from the DOM:
  const canvasFace = document.getElementById('WebARRocksFaceCanvas');
  const canvasThree = document.getElementById('threeCanvas');

  // init WebAR.rock.mirror:
  WebARRocksMirror.init({
    isGlasses: false,

    specWebARRocksFace: {
      NNCpath: '../../neuralNets/NN_NECKLACE_1.json',
      scanSettings: { // harden detection:
        threshold: 0.9,
        dThreshold: 1.0
      }
    },

    solvePnPObjPointsPositions: {
      // indices of the points are given as comments. 
      // Open dev/torso.blend to get point positions

      "torsoNeckCenterUp": [0.000006,-78.167770,33.542694], // ind: 4,
      "torsoNeckCenterDown": [0.000004,-112.370636,44.173981], // ind: 5,

      "torsoNeckLeftUp": [77.729225,-1.220459,-42.653336], // ind: 41,
      "torsoNeckLeftDown": [130.661072,-11.937241,-44.706360], // ind: 117,
      "torsoNeckRightUp": [-77.898209,-1.191437,-42.648613],// ind: 14,
      "torsoNeckRightDown": [-130.661041,-11.937241,-44.706360],// ind: 112,

      "torsoNeckBackUp": [-0.040026,-11.528961,-99.635696],// ind: 218,
      "torsoNeckBackDown": [0.000007,-47.934677,-127.748184]// ind: 2
    },
    solvePnPImgPointsLabels: [
      "torsoNeckCenterUp",
      "torsoNeckLeftUp",
      "torsoNeckRightUp",
      "torsoNeckBackUp",
      "torsoNeckCenterDown",
      "torsoNeckLeftDown",
      "torsoNeckRightDown",
      "torsoNeckBackDown"
    ],

    canvasFace: canvasFace,
    canvasThree: canvasThree,

    // initial canvas dimensions:
    width: window.innerWidth,
    height: window.innerHeight,

    // The occluder is a placeholder for the head. It is rendered with a transparent color
    // (only the depth buffer is updated).
    occluderURL: "assets/models3D/occluder.glb",
    modelURL: "assets/models3D/blackPanther.glb", //initial model loaded. false or null -> no model
    envmapURL: "assets/envmaps/venice_sunset_1k.hdr",

    // lighting:
    pointLightIntensity: 0.8, //intensity of the point light. Set to 0 to disable
    pointLightY: 200, // larger -> move the pointLight to the top
    hemiLightIntensity: 0, // intensity of the hemispheric light. Set to 0 to disable (not really useful if we use an envmap)

    // temporal anti aliasing - Number of samples. 0 -> disabled:
    taaLevel: 3,

    // debug flags - all should be false for production:
    debugLandmarks: false,
    debugOccluder: false
  }).then(function(){
    console.log('WebARRocksMirror initialized successfully');

    // display controls:
    document.getElementById('controls').style.display = 'flex';

    // handle orientation change or window resizing:
    const resizeCallback = function(){
      WebARRocksMirror.resize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('orientationchange', resizeCallback);
    window.addEventListener('resize', resizeCallback);
    
  }).catch(function(err){
    alert('An error happens with WebARRocksMirror: ' + err.toString());
  });
}


// this function is executed when the user clicks on CAPTURE IMAGE button
// it opens the captured image in a new tab:
function capture_image(){
  WebARRocksMirror.capture_image(function(cv){
    const dataURL = cv.toDataURL('image/png');
    const img = new Image();
    img.src = dataURL;
    img.onload = function(){
      const win = window.open("");
      win.document.write(img.outerHTML);
    }
  });
}