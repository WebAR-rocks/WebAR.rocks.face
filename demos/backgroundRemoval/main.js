
const SETTINGS = {
  // occluders 3D models (used to compute the maskS)
  faceOccluderPath: 'assets/faceBgRemovalOccluder.glb',
  torsoOccluderPath: 'assets/torsoBgRemovalOccluder.glb',

  // face occluder pose:
  // warning: it is also applied to the torso occluder
  // so please tune first these 2 settings to have the right pose for the face occluder
  // then tune the torso occluder pose
  faceRxOffset: -Math.PI * 15 / 180, // in rad, + -> look down
  faceOccluderTranslationYZ: [-20.0, 0.0], // Y+ -> upper, Z+ -> forward
  faceOccluderScale: 0.95,
  
  // torso occluder pose:
  torsoRotX: 0, // in rad. + -> rotate forward
  torsoBaseNeck: [0, -58, -18], // position of the base of the neck in the torso ref
  torsoTranslateY: 95, // + -> up
  

  // debug flags. All should be set to false:
  debugDisplayOccluders: false,
  debugDisableBlur: false,

  // relative mask blur:
  blurMaskStrength: 0.03
};


let _ctx = null;
let _canvasThree = null, _canvasFace = null, _canvasComposite = null;

function main(){ // entry point
  // get the 2 canvas from the DOM:
  _canvasFace = document.getElementById('WebARRocksFaceCanvas');
  _canvasThree = document.getElementById('threeCanvas');
  _canvasComposite = document.getElementById('compositeCanvas');

  // Size the canvases:
  const dpr = window.devicePixelRatio || 1.0;
  const w = window.innerWidth * dpr, h = window.innerHeight * dpr;
  [_canvasFace, _canvasThree, _canvasComposite].forEach(function(cv){
    cv.width = w;
    cv.height = h;
  });

  // create the 2D context of the composite canvas:
  _ctx = _canvasComposite.getContext('2d');

  // init WebAR.rock.rocks through the THREE helper:
  WebARRocksFaceThreeHelper.init({
    spec: {
      NNCPath: '../../neuralNets/NN_HEADPHONES_4.json',
      scanSettings: {
        threshold: 0.6
      }
    },

    // increase stabilization:
    stabilizerSpec: {
      beta: 20,
      forceFilterNNInputPxRange: [1.5, 4]
    },

    // follower object pose:
    rxOffset: SETTINGS.faceRxOffset,
    translationYZ: SETTINGS.faceOccluderTranslationYZ,
    scale: SETTINGS.faceOccluderScale,

    // torso pose:
    torsoRotX: SETTINGS.torsoRotX, // in degrees
    torsoBaseNeck: SETTINGS.torsoBaseNeck, // position of the base of the neck in the torso ref
    torsoTranslateY: SETTINGS.torsoTranslateY,

    isComputeTorsoPose: true,
    isPostProcessing: true, // we set it to true to be able to add a blur postprocessing pass

    solvePnPObjPointsPositions: {
      "noseLeft": [21.862150,-0.121031,67.803383], // 1791
      "noseRight": [-20.539499,0.170727,69.944778], // 2198

      "leftEyeExt": [44.507431,34.942841,38.750019], // 1808
      "rightEyeExt": [-44.064968,35.399670,39.362930], // 2214
     
      "leftEarTop": [89.165428,16.312811,-49.064980], // 3870
      "leftEarBase": [78.738243,-6.044550,-23.177490], // 2994
      "leftEarBottom": [78.786850,-41.321789,-24.603769], // 1741

      "rightEarTop": [-88.488602,17.271400,-48.199409], // 5622
      "rightEarBase": [-78.156998,-5.305619,-22.164619], // 4779
      "rightEarBottom": [-78.945511,-41.255100,-26.536131], // 5641

      "leftTemple": [60.262970,83.790382,-13.540310], // 108
      "rightTemple": [-60.034760,83.584427,-13.248530], // 286

      "foreHead": [-1.057755,97.894547,24.654940], // 696
    },
    solvePnPImgPointsLabels: [
      "foreHead",
      "leftTemple", "rightTemple",
      "leftEarTop", "rightEarTop",
      "leftEyeExt", "rightEyeExt",
      "rightEarBottom", "leftEarBottom",
    ],

    canvas: _canvasFace,
    canvasThree: _canvasThree,

    callbackReady: start,
    callbackTrack: animate
  });
}


function get_blurShader(dxy, N) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      dxy: { value: new THREE.Vector2().fromArray(dxy) }
    },

    vertexShader:'\n\
      varying vec2 vUv;\n\
      void main() {\n\
        vUv = uv;\n\
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
      }',

    fragmentShader:'\n\
      \n\
      uniform vec2 dxy;\n\
      \n\
      uniform sampler2D tDiffuse;\n\
      const float N = ' + N.toFixed(1) +';\n\
      \n\
      varying vec2 vUv;\n\
      \n\
      void main() {\n\
        vec4 sum = vec4(0.0);\n\
        float sumK = 0.0;\n\
        for (float i = -N; i<=N; i+=1.0){\n\
          vec2 duv = i*dxy;\n\
          float k = exp(-length(duv));\n\
          sum += texture2D( tDiffuse, vUv + duv);\n\
          sumK += k;\n\
        }\n\
        \n\
        gl_FragColor = sum / sumK;\n\
        \n\
      }'
  }
}


function add_blurPostProcessingPass(effectComposer){
  const width = _canvasThree.width, height = _canvasThree.height;
  const NPix = Math.floor(width * SETTINGS.blurMaskStrength);
  const blurEffectX = new THREE.ShaderPass(
    get_blurShader([1.0 / width, 0.0], NPix)
  );
  const blurEffectY = new THREE.ShaderPass(
    get_blurShader([0, 1.0 / height], NPix)
  );
  effectComposer.addPass(blurEffectX);
  effectComposer.addPass(blurEffectY);
}


function start(err, threeInstances){
  if (err){
    alert('An error happened: ' + err.toString());
    return;
  }
  console.log('WebAR.rocks.face initialized successfully');

  // load meshes:
  add_backgroundRemovalOccluder(threeInstances.threeFaceFollowers, SETTINGS.faceOccluderPath);
  add_backgroundRemovalOccluder(threeInstances.threeTorsoFollowers, SETTINGS.torsoOccluderPath);

  if (!SETTINGS.debugDisableBlur && !SETTINGS.debugDisplayOccluders){
    add_blurPostProcessingPass(threeInstances.threeComposer);
  }

  setTimeout(function(){
    // fix a weird bug on IOS 15.4, WebGL2 through Metal
    _canvasThree.height = _canvasThree.height - 0.001;
  }, 200);
}


function animate(detectStates){
  const isAnyFaceDetected = (detectStates.length) ? detectStates.any(function(detectState){
    return detectState.isDetected;
  }) : detectStates.isDetected; // handles multi faces
  update_compositeCanvas(isAnyFaceDetected);
}


function set_maskMaterial(threeObject){
  threeObject.traverse(function(threeNode){
    if (threeNode.isMesh){
      threeNode.material = new THREE.MeshBasicMaterial({color: 0x000000});
    }
  });
}


function set_debugMaterial(threeObject){
  threeObject.traverse(function(threeNode){
    if (threeNode.isMesh){
      threeNode.geometry.computeVertexNormals();
      threeNode.material = new THREE.MeshNormalMaterial({opacity: 0.5});
    }
  });
}


function  add_backgroundRemovalOccluder(followerObjects, occluderPath){
  return new Promise(function(accept, reject){
    new THREE.GLTFLoader().load(occluderPath, function(gltf){
      const occluderModel = gltf.scene;
      followerObjects.forEach(function(follower){
        const occluderCloned = occluderModel.clone();
        if (SETTINGS.debugDisplayOccluders){
          set_debugMaterial(occluderCloned);
        } else {
          set_maskMaterial(occluderCloned);
        }
        follower.add(occluderCloned);
      }); // end loop on followerObjects
    }); //end GLTFLoader.load()
  }); //end returned promise
}


function update_compositeCanvas(isAnyFaceDetected){
  // draw video:
  _ctx.globalCompositeOperation = 'source-over';
  _ctx.drawImage(_canvasFace, 0, 0);

  // apply mask:
  if (isAnyFaceDetected){
    if (!SETTINGS.debugDisplayOccluders){
      _ctx.globalCompositeOperation = 'destination-in';
    }
    _ctx.drawImage(_canvasThree, 0, 0);
  }
}


window.addEventListener('load', main);