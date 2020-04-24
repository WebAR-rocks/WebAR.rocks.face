"use strict"

const WebARRocksFaceHelper = (function(){
  const _settings = {
    cameraMinVideoDimFov: 38, // min camera FoV in degrees (either horizontal or vertical depending on the camera)
    pointSize: 5, // when landmarks are displayed, their size in pixels

    // debug options:
    debugObjPoints: 0 // display cubes on 3D landmark points - to debug solvePnP feature
  };


  const _defaultSolvePnPObjPointsPositions = { // 3d positions, got using Blender in edit mode and opening dev/face.obj
                        // the value added as comment is the point indice
    'leftEyeCtr': [33.7,37.9,45.9], // 6022
    'rightEyeCtr':[-33.7,37.9,45.9], // 5851

    'leftEyeInt': [16,36,40], // 6026
    'rightEyeInt':[-16,36,40], // 5855

    'leftEyeExt': [46,37.9,38],  // 1808
    'rightEyeExt':[-46,37.9,38], // 2214

    'leftEyeBot': [33,31,45], // 2663
    'rightEyeBot':[-33,31,45], // 4462

    'leftEarBottom': [77,-18.6,-18], // 65
    'rightEarBottom': [-77,-18.6,-18], // 245

    'leftEarEarring': [81, -37, -24.8], // 3874
    'rightEarEarring': [-81, -37, -24.8], // 5625
    
    'noseLeft': [21,-0.1,67], // 1791
    'noseRight': [-21,-0.1,67], // 2198

    'noseBottom': [0, -0.6, 82], // 468
    'noseOuter': [0, 15.4, 93], // 707

    "mouthLeft":  [27, -29.9, 70.8], // 32
    "mouthRight": [-27, -29.9, 70.8], // 209

    "upperLipBot": [0, -24, 83.5], // 3072
    "upperLipTop": [0, -17.2, 86.3],// 595
    "lowerLipTop": [0, -26, 84.3],// 627
    "lowerLipBot": [0, -34, 89.6],// 2808

    "leftEyeBrowInt": [15, 55.4, 51.2], // 3164
    "rightEyeBrowInt": [-15, 55.4, 51.2], // 4928
    
    'chin':  [0, -71, 91] // 2395  //*/
  };
  const _defaultSolvePnPImgPointsLabel = ['chin', 'leftEarBottom', 'rightEarBottom', 'noseOuter', 'leftEyeExt', 'rightEyeExt'];
    
  const _deg2rad = Math.PI / 180;
  let _cameraFoVY = -1;
  let _spec = null;

  // features:
  const _defaultFeatures = {
    video: true,       // display the video texture as background
    landmarks: true,   // display landmarks
    threejs: false    // initialize THREE.JS
  };
  const _shps = {
    drawPoints: null,
    copy: null
  };

  let _gl = null, _cv = null, _glVideoTexture = null;
  let _videoElement = null;
  let _landmarksLabels = null, _landmarksIndices = {};
  const _focals = [0, 0];

  const _featureDrawLandmarks = {
    vertices: null,
    glIndicesVBO: null,
    glVerticesVBO: null
  };

  const _featureSolvePnP = {    
    isCenterObjPoints: false,
    objPoints: [], // will be sorted by solver
    objPointsMeans: [],
    imgPointsLMIndices: [], // will be sorted by solver
    imgPointsPx: []
  };
  const _featureThree = {
    isPostProcessing: false,
    isUseSeparateCanvas: false,
    taaLevel: 0,
    canvas: null,
    renderer: null,
    composer: null,
    scene: null,
    camera: null,
    faceFollower: null,
    faceFollowerParent: null,
    matMov: null,
    vecForward: null
  };

  //BEGIN VANILLA WEBGL HELPERS
  // compile a shader:
  function compile_shader(source, type, typeString) {
    const shader = _gl.createShader(type);
    _gl.shaderSource(shader, source);
    _gl.compileShader(shader);
    if (!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS)) {
      alert("ERROR IN " + typeString + " SHADER: " + _gl.getShaderInfoLog(shader));
      console.log('Buggy shader source: \n', source);
      return false;
    }
    return shader;
  };

  // build the shader program:
  function build_shaderProgram(shaderVertexSource, shaderFragmentSource, id) {
    // compile both shader separately:
    const GLSLprecision = 'precision lowp float;';
    const shaderVertex = compile_shader(shaderVertexSource, _gl.VERTEX_SHADER, "VERTEX " + id);
    const shaderFragment = compile_shader(GLSLprecision + shaderFragmentSource, _gl.FRAGMENT_SHADER, "FRAGMENT " + id);

    const shaderProgram = _gl.createProgram();
    _gl.attachShader(shaderProgram, shaderVertex);
    _gl.attachShader(shaderProgram, shaderFragment);

    // start the linking stage:
    _gl.linkProgram(shaderProgram);
    const aPos = _gl.getAttribLocation(shaderProgram, "position");
    _gl.enableVertexAttribArray(aPos);

    return {
      program: shaderProgram,
      uniforms:{}
    };
  }
  //END VANILLA WEBGL HELPERS

  //BEGIN FEATURES SPECIFIC
  function init_featureDrawPoints(){
    _featureDrawLandmarks.vertices = new Float32Array(_landmarksLabels.length*2);

    // create vertex buffer objects:
    // VBO to draw only 1 point
    _featureDrawLandmarks.glVerticesVBO = _gl.createBuffer();
    _gl.bindBuffer(_gl.ARRAY_BUFFER, _featureDrawLandmarks.glVerticesVBO);
    _gl.bufferData(_gl.ARRAY_BUFFER, _featureDrawLandmarks.vertices, _gl.DYNAMIC_DRAW);

    const indices = new Uint16Array(_landmarksLabels.length);
    for (let i=0; i<_landmarksLabels.length; ++i){
      indices[i] = i;
    }
    _featureDrawLandmarks.glIndicesVBO = _gl.createBuffer();
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _featureDrawLandmarks.glIndicesVBO);
    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, indices, _gl.STATIC_DRAW);
  }

  function update_focals(){
    // COMPUTE CAMERA PARAMS (FOCAL LENGTH)
    // see https://docs.opencv.org/3.0-beta/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html?highlight=projectpoints
    // and http://ksimek.github.io/2013/08/13/intrinsic/

    const halfFovYRad = 0.5 * _cameraFoVY * _deg2rad;
    const cotanHalfFovY = 1.0 / Math.tan(halfFovYRad);

    // settings with EPnP:
    const fy = 0.5 * that.get_viewHeight() * cotanHalfFovY;
    const fx = fy;

    /*const halfFovXRad =halfFovYRad * that.get_viewAspectRatio();
    const cotanHalfFovX = 1.0 / Math.tan(halfFovXRad);
    const fx = 0.5 * that.get_viewWidth() * cotanHalfFovX; //*/

    console.log('INFO in WebARRocksFaceHelper - focal_y =', fy);
    _focals[0] = fy, _focals[1] = fy;
  }

  function init_PnPSolver(imgPointsLabels, objPointsPositions){
    const imgPointsPx = [];
    for (let i=0; i<imgPointsLabels.length; ++i){
      imgPointsPx.push([0, 0]);
    }
    _featureSolvePnP.imgPointsPx = imgPointsPx;
    _featureSolvePnP.imgPointsLMIndices = imgPointsLabels.map(
      function(label, ind){
        return _landmarksLabels.indexOf(label);
      });
    _featureSolvePnP.objPoints = imgPointsLabels.map(
      function(label, ind){
        return objPointsPositions[label].slice(0);
      }); 

    if (_featureSolvePnP.isCenterObjPoints){
      // compute mean for each solver:
      _featureSolvePnP.objPoints.forEach(function(objPoints){
        // compute mean:
        const mean = [0, 0, 0];
        objPoints.forEach(function(pt){
          mean[0] += pt[0], mean[1] += pt[1], mean[2] += pt[2];
        });
        const n = objPoints.length;
        mean[0] /= n, mean[1] /= n, mean[2] /= n;
        _featureSolvePnP.objPointsMeans = mean;

        // substract mean:
        objPoints.forEach(function(pt){
          pt[0] -= mean[0], pt[1] -= mean[1], pt[2] -= mean[2];
        });
      }); // end loop on objPoints groups
    } //end if center obj points
  }

  function init_featureThreejs(){
    console.log('INFO in WebARRocksFaceHelper - init_featureThreejs()');

    if (_spec.canvasThree){
      _featureThree.canvas = _spec.canvasThree;
      _featureThree.isUseSeparateCanvas = true;
    }
    _featureThree.isPostProcessing = _spec.isPostProcessing;
    _featureThree.taaLevel = _spec.taaLevel;
    if ( _featureThree.taaLevel > 0 ){
      _featureThree.isPostProcessing = true;
    }

    if (_featureThree.isUseSeparateCanvas){ // WebAR.rocks.face and THREE.js use 2 canvas with 2 different WebGL context
      _featureThree.renderer = new THREE.WebGLRenderer({
        canvas: _featureThree.canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true
      });
      _featureThree.renderer.setClearAlpha(0);
    } else { // WebGL context and canvas are shared between WebAR.rocks.face and THREE.js
      _featureThree.renderer = new THREE.WebGLRenderer({
        context: _gl,
        canvas: _cv,
        alpha: false
      });
      _featureThree.renderer.autoClear = false;
    }

    _featureThree.scene = new THREE.Scene();
    _featureThree.camera = new THREE.PerspectiveCamera(_cameraFoVY, that.get_viewAspectRatio(), 10, 5000);
    
    if (_featureThree.isPostProcessing){
      _featureThree.composer = new THREE.EffectComposer( _featureThree.renderer );
      const renderScenePass = new THREE.RenderPass( _featureThree.scene, _featureThree.camera );
      if (_featureThree.taaLevel > 0){
        // add temporal anti-aliasing pass:
        const taaRenderPass = new THREE.TAARenderPass( _featureThree.scene, _featureThree.camera );
        taaRenderPass.unbiased = false;
        _featureThree.composer.addPass( taaRenderPass );
        taaRenderPass.sampleLevel = _featureThree.taaLevel;
      }

      _featureThree.composer.addPass( renderScenePass );

      if (_featureThree.taaLevel > 0){
        renderScenePass.enabled = false;
        const copyPass = new THREE.ShaderPass( THREE.CopyShader );
        _featureThree.composer.addPass( copyPass );
      }

    } // end if postprocessing

    // create composite object (which follow the head):
    _featureThree.faceFollowerParent = new THREE.Object3D();
    _featureThree.faceFollower = new THREE.Object3D();
    _featureThree.faceFollowerParent.frustumCulled = false;
    _featureThree.faceFollowerParent.matrixAutoUpdate = false;
    _featureThree.faceFollowerParent.add(_featureThree.faceFollower);

    // debug solvePnP face objPoints:
    if (_settings.debugObjPoints){
      const objPointsPositions = _spec.solvePnPObjPointsPositions;
      Object.keys(objPointsPositions).forEach(function(objPointKey){
        const objPoint = objPointsPositions[objPointKey];
        const s = 3;
        const debugCube = new THREE.Mesh(new THREE.BoxGeometry( s, s, s ), new THREE.MeshBasicMaterial({
          color: 0xff0000
        }));
        debugCube.position.fromArray(objPoint);
        _featureThree.faceFollower.add(debugCube);
      });
    }

    _featureThree.matMov = new THREE.Matrix4();
    _featureThree.vecForward = new THREE.Vector4();
      
    _featureThree.scene.add(_featureThree.faceFollowerParent);

    that.update_threeCamera();
    window.debugT = _featureThree;
  }
  
  //END FEATURES SPECIFIC


  //BEGIN WEBARROCKSFACE CALLBACKS:
  function callbackReady(err, spec){
    if (err){
      console.log('ERROR in WebARRocksFaceHelper. ERR =', err);
      if (_spec.callbackReady){
        _spec.callbackReady(err, null);
      }
      return;
    }

    console.log('INFO in WebARRocksFaceHelper: WebAR.Rocks.face is ready. spec =', spec);
    
    _gl = spec.GL;
    _cv = spec.canvasElement;
    _glVideoTexture = spec.videoTexture;
    _landmarksLabels = spec.landmarksLabels;
    _videoElement = spec.video;

    console.log('INFO in WebARRocksFaceHelper: video resolution =', _videoElement.videoWidth, 'x', _videoElement.videoHeight);

    _landmarksLabels.forEach(function(label, ind){
      _landmarksIndices[label] = ind;
    });

    init_shps();
    if (_spec.features.landmarks){
      init_featureDrawPoints();
    }
    if (_spec.features.threejs){
      init_featureThreejs();
    }
    if (_spec.features.solvePnP){
      update_focals();
      init_PnPSolver(_spec.solvePnPImgPointsLabels, _spec.solvePnPObjPointsPositions);
    }
    
    if (_spec.callbackReady){
      if (_spec.features.threejs){
        spec.threeFaceFollower = _featureThree.faceFollower;
        spec.threeScene = _featureThree.scene;
        spec.threeRenderer = _featureThree.renderer;
        spec.threeComposer = _featureThree.composer;
        spec.threeCamera = _featureThree.camera;
        
        // build threeVideoTexture:
        spec.threeVideoTexture = new THREE.DataTexture( new Uint8Array([255,0,0]), 1, 1, THREE.RGBFormat);
        spec.threeVideoTexture.needsUpdate = true;
        spec.threeVideoTexture.onUpdate = function(){
          console.log('INFO in WebARRocksFaceHelper: init threeVideoTexture');
          _featureThree.renderer.properties.update(spec.threeVideoTexture, '__webglTexture', _glVideoTexture);
          spec.threeVideoTexture.magFilter = THREE.LinearFilter;
          spec.threeVideoTexture.minFilter = THREE.LinearFilter;
          spec.threeVideoTexture.mapping = THREE.EquirectangularReflectionMapping;
          delete(spec.threeVideoTexture.onUpdate);
        }
      }
      _spec.callbackReady(err, spec);
    }
  } //end callbackReady()

  function callbackTrack(detectState){
    _gl.viewport(0, 0, that.get_viewWidth(), that.get_viewHeight());

    // draw the video:
    if (_spec.features.video){
      draw_video();
    }

    if (detectState.isDetected) {
      // draw landmarks:
      if (_spec.features.landmarks){
        draw_landmarks(detectState);
      }

      if (_spec.features.solvePnP){
        draw_solvePnP(detectState);
      }

      if (_spec.features.threejs){
        draw_threejs();
      }
    }
    
    _gl.flush();

    if (_spec.callbackTrack){
      _spec.callbackTrack(detectState);
    }
  } //end callbackTrack
  //END WEBARROCKSFACE CALLBACKS:

  //BEGIND DRAW FUNCS
  function draw_video(){
    // use the head draw shader program and sync uniforms:
    _gl.useProgram(_shps.copy.program);
    _gl.activeTexture(_gl.TEXTURE0);
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);

    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _gl.drawElements(_gl.TRIANGLES, 3, _gl.UNSIGNED_SHORT, 0);
  }

  function draw_landmarks(detectState){
    // copy landmarks:
    detectState.landmarks.forEach(copy_landmark);

    // draw landmarks:
    _gl.useProgram(_shps.drawPoints.program);

    _gl.bindBuffer(_gl.ARRAY_BUFFER, _featureDrawLandmarks.glVerticesVBO);
    _gl.bufferData(_gl.ARRAY_BUFFER, _featureDrawLandmarks.vertices, _gl.DYNAMIC_DRAW);
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _featureDrawLandmarks.glIndicesVBO);
    _gl.vertexAttribPointer(0, 2, _gl.FLOAT, false, 8,0);

    _gl.drawElements(_gl.POINTS, _landmarksLabels.length, _gl.UNSIGNED_SHORT, 0);
  }

  function copy_landmark(lm, lmIndex){
    _featureDrawLandmarks.vertices[lmIndex*2] =     lm[0]; // X
    _featureDrawLandmarks.vertices[lmIndex*2 + 1] = lm[1]; // Y
  }

  function draw_solvePnP(detectState){
    const w2 = that.get_viewWidth() / 2;
    const h2 = that.get_viewHeight() / 2;
    const imgPointsPx = _featureSolvePnP.imgPointsPx;
    _featureSolvePnP.imgPointsLMIndices.forEach(function(ind, i){
      const imgPointPx = imgPointsPx[i];
      imgPointPx[0] = - detectState.landmarks[ind][0] * w2,  // X in pixels
      imgPointPx[1] = - detectState.landmarks[ind][1] * h2;  // Y in pixels
    });

    const objectPoints = _featureSolvePnP.objPoints;
    const solved = WEBARROCKSFACE.compute_pose(objectPoints, imgPointsPx, _focals[0], _focals[1]);

    if (_spec.features.threejs && solved){
      const m = _featureThree.matMov.elements;
      const r = solved.rotation, t = solved.translation;

      // set translation part:
      m[12] = -t[0], m[13] = -t[1], m[14] = -t[2];

      // set rotation part:
      m[0] = -r[0][0], m[4] =  -r[0][1], m[8] =  r[0][2],
      m[1] = -r[1][0], m[5] =  -r[1][1], m[9] =  r[1][2],
      m[2] = -r[2][0], m[6] =  -r[2][1], m[10] =  r[2][2];

      // do not apply matrix if the resulting face is looking in the wrong way:
      const vf = _featureThree.vecForward;
      vf.set(0, 0, 1, 0); // look forward;
      vf.applyMatrix4(_featureThree.matMov);
      if (vf.z > 0){
        _featureThree.faceFollowerParent.matrix.copy(_featureThree.matMov);
        if (_featureSolvePnP.isCenterObjPoints){
          const mean = _featureSolvePnP.objPointsMeans;
          _featureThree.faceFollower.position.fromArray(mean).multiplyScalar(-1);
        }
      }
    }
  } //end draw_solvePnP()

  function draw_threejs(){
    if (!_featureThree.isUseSeparateCanvas){
      _featureThree.renderer.state.reset();
      _gl.enable(_gl.BLEND); // blending is considered by THREE.js as enabled by default
      _featureThree.renderer.clearDepth();
    }
    if (_featureThree.isPostProcessing){
      _featureThree.composer.render();
    } else {
      _featureThree.renderer.render(_featureThree.scene, _featureThree.camera);
    }
    if (!_featureThree.isUseSeparateCanvas){
      _gl.disable(_gl.CULL_FACE);
    }
  }

  //BEGIN INIT FUNCS
  // build shader programs:
  function init_shps(){
    
    // create copy shp, used to display the video on the canvas:
    _shps.copy = build_shaderProgram('attribute vec2 position;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5 * position + vec2(0.5,0.5);\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }'
      ,
      'uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }',
      'COPY');

    // create LM display shader program:
    const shaderVertexSource = "attribute vec2 position;\n\
      void main(void) {\n\
        gl_PointSize = " + _settings.pointSize.toFixed(1) + ";\n\
        gl_Position = vec4(position, 0., 1.);\n\
      } ";
    // display lime color:
    const shaderFragmentSource = "void main(void){\n\
        gl_FragColor = vec4(0.,1.,0.,1.);\n\
      }";

    if (_spec.features.landmarks){
      _shps.drawPoints = build_shaderProgram(shaderVertexSource, shaderFragmentSource, 'DRAWPOINT');
    }
  }

  //END INIT FUNCS


  const that = {
    init: function(spec){
      _spec = Object.assign({
        features: {},
        spec: {},

        // SolvePnP specifics:
        solvePnPObjPointsPositions: _defaultSolvePnPObjPointsPositions,
        solvePnPImgPointsLabels: _defaultSolvePnPImgPointsLabel,

        // THREE specifics:
        canvasThree: null,
        isPostProcessing: false,
        taaLevel: 0,

        // callbacks:
        callbackReady: null,
        callbackTrack: null
      }, spec);
      _spec.features = Object.assign({}, _defaultFeatures, _spec.features);

      // init WEBAR.rocks.face:WEBARROCKSFACE
      const defaultSpecLM = {
        canvas: null,
        canvasId: 'WebARRocksFaceCanvas',
        NNCpath: '../../dist/',
        callbackReady: callbackReady,
        callbackTrack: callbackTrack
      };
      _spec.spec = Object.assign({}, defaultSpecLM, _spec.spec);
      if (_spec.spec.canvas === null){
        _spec.spec.canvas = document.getElementById(_spec.spec.canvasId);
      }
      WEBARROCKSFACE.init(_spec.spec);
    },

    get_facePointPositions: function(){
      return _spec.solvePnPObjPointsPositions;
    },

    resize: function(w, h){ //should be called after resize
      _cv.width = w, _cv.height = h;
      if (_featureThree.isUseSeparateCanvas){
        _featureThree.canvas.width = w;
        _featureThree.canvas.height = h;
      }
      WEBARROCKSFACE.resize();
      if (_spec.features.threejs){
        that.update_threeCamera();
      }
      if (_spec.features.solvePnP){
        update_focals();
      }
    },

    add_threejsOccluder: function(occluder, isDebug, occluderMesh){
      if (!occluderMesh){
        occluderMesh = new THREE.Mesh();
      }
      let occluderGeometry = null;
      if (occluder.type === 'BufferGeometry'){
        occluderGeometry = occluder;
      } else if (occluder.scene){
        occluder.scene.traverse(function(threeStuff){
          if (threeStuff.type !== 'Mesh'){
            return;
          }
          if (occluderGeometry !== null && occluderGeometry !== threeStuff.geometry){
            throw new Error('The occluder should contain only one Geometry');
          }
          occluderGeometry = threeStuff.geometry;
        });
      } else {
        throw new Error('Wrong occluder data format');
      }
      
      let mat = new THREE.ShaderMaterial({
        vertexShader: THREE.ShaderLib.basic.vertexShader,
        fragmentShader: "precision lowp float;\n void main(void){\n gl_FragColor = vec4(1.,0.,0.,1.);\n }",
        uniforms: THREE.ShaderLib.basic.uniforms,
        side: THREE.DoubleSide,
        colorWrite: false
      });
      if (isDebug){
        occluderGeometry.computeVertexNormals(); mat = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
      }
      occluderMesh.renderOrder = -1e12; // render first
      occluderMesh.material = mat;
      occluderMesh.geometry = occluderGeometry;
      _featureThree.faceFollower.add(occluderMesh);
    },

    add_threejsOccluderFromFile: function(occluderURL, callback, threeLoadingManager, isDebug){
      const occluderMesh = new THREE.Mesh();
      const extension = occluderURL.split('.').pop().toUpperCase();
      const loader = {
        'GLB': THREE.GLTFLoader,
        'GLTF': THREE.GLTFLoader,
        'JSON': THREE.BufferGeometryLoader
      }[extension];

      new loader(threeLoadingManager).load(occluderURL, function(occluder){
        that.add_threejsOccluder(occluder, isDebug, occluderMesh);
        if (typeof(callback)!=='undefined' && callback) callback(occluderMesh);
      });
      return occluderMesh;
    },


    get_sourceWidth: function(){
      return _videoElement.videoWidth;
    },

    get_sourceHeight: function(){
      return _videoElement.videoHeight;
    },

    get_viewWidth: function(){
      return _cv.width;
    },

    get_viewHeight: function(){
      return _cv.height;
    },

    get_viewAspectRatio: function(){
      return that.get_viewWidth() / that.get_viewHeight();
    },

    update_solvePnP: function(objPointsPositions,imgPointsLabels){
      if (objPointsPositions){
        _spec.solvePnPObjPointsPositions = Object.assign(_spec.solvePnPObjPointsPositions, objPointsPositions);
      }
      _spec.solvePnPImgPointsLabels = imgPointsLabels || _spec.solvePnPImgPointsLabels;
      init_PnPSolver(_spec.solvePnPImgPointsLabels, _spec.solvePnPObjPointsPositions);
    },

    update_threeCamera: function(){
      const threeCamera = _featureThree.camera;
      const threeRenderer = _featureThree.renderer;

      // compute aspectRatio:
      const cvw = that.get_viewWidth();
      const cvh = that.get_viewHeight();
      const canvasAspectRatio = cvw / cvh;

      // compute vertical field of view:
      const vw = that.get_sourceWidth();
      const vh = that.get_sourceHeight();
      const videoAspectRatio = vw / vh;
      let fovFactor = (vh > vw) ? (1.0 / videoAspectRatio) : 1.0;
      let fov = _settings.cameraMinVideoDimFov * fovFactor;
      
      if (canvasAspectRatio > videoAspectRatio) {
        const scale = cvw / vw;
        const cvhs = vh * scale;
        fov = 2 * Math.atan( (cvh / cvhs) * Math.tan(0.5 * fov * _deg2rad)) / _deg2rad;
      }
      _cameraFoVY = fov;
       console.log('INFO in WebARRocksFaceHelper.update_threeCamera(): camera vertical estimated FoV is', fov, 'deg');

      // update projection matrix:
      threeCamera.aspect = canvasAspectRatio;
      threeCamera.fov = fov;
      threeCamera.updateProjectionMatrix();

      // update drawing area:
      threeRenderer.setSize(cvw, cvh, false);
      threeRenderer.setViewport(0, 0, cvw, cvh);
    }


  }; //end that
  return that;
})();

// Export ES6 module:
try {
  module.exports = WebARRocksFaceHelper;
} catch(e){
  console.log('ES6 Module not exported');
}