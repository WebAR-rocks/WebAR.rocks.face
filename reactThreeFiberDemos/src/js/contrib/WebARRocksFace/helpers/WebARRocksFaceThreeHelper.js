/* eslint-disable */

/**
 * Copyright 2020 WebAR.rocks ( https://webar.rocks )
 * 
 * WARNING: YOU SHOULD NOT MODIFY THIS FILE OTHERWISE WEBAR.ROCKS
 * WON'T BE RESPONSIBLE TO MAINTAIN AND KEEP YOUR ADDED FEATURES
 * WEBAR.ROCKS WON'T BE LIABLE FOR BREAKS IN YOUR ADDED FUNCTIONNALITIES
 *
 * WEBAR.ROCKS KEEP THE RIGHT TO WORK ON AN UNMODIFIED VERSION OF THIS SCRIPT.
 * 
 * THIS FILE IS A HELPER AND SHOULD NOT BE MODIFIED TO IMPLEMENT A SPECIFIC USER SCENARIO
 * OR TO ADDRESS A SPECIFIC USE CASE.
 */


import {
  DoubleSide,
  Euler,
  Matrix4,
  Mesh,
  MeshNormalMaterial,
  ShaderLib,
  ShaderMaterial,
  Vector3,
} from 'three'
import stabilizer from './landmarksStabilizers/OneEuroLMStabilizer.js'



const WebARRocksFaceThreeHelper = (function(){
  const _settings = {
    cameraMinVideoDimFov: 38, // min camera FoV in degrees (either horizontal or vertical depending on the camera)
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
  let _spec = null;
  let _landmarksStabilizers = null;
  let _landmarksStabilizerSpec = null;
  let _WEBARROCKSFACE = null;
  
  const _shps = { // shader programs
    copy: null
  };

  let _gl = null, _cv = null, _glVideoTexture = null, _videoTransformMat2 = null;
  let _videoElement = null;
  const _focals = [0, 0];
  let _isInitialized = false;

  const _landmarks = {
    labels: null,
    indices: {}
  };
 
  const _computePose = {    
    isCenterObjPoints: true,
    objPoints: [], // will be sorted by solver
    objPointsMean: null,
    imgPointsLMIndices: [], // will be sorted by solver
    imgPointsPx: []
  };

  const _previousSizing = {
    width: -1,
    height: -1
  };

  const _three = {
    faceSlots: [],
    matMov: null,
    preMatrix: null,
    matMov2: null,
    euler: null
  };
  const _dpr = window.devicePixelRatio || 1;


  // compile a shader:
  function compile_shader(source, glType, typeString) {
    const glShader = _gl.createShader(glType);
    _gl.shaderSource(glShader, source);
    _gl.compileShader(glShader);
    if (!_gl.getShaderParameter(glShader, _gl.COMPILE_STATUS)) {
      alert("ERROR IN " + typeString + " SHADER: " + _gl.getShaderInfoLog(glShader));
      console.log('Buggy shader source: \n', source);
      return null;
    }
    return glShader;
  };


  function destroy_shaderProgram(shp){
    _gl.deleteProgram(shp.program);
  };


  // build the shader program:
  function build_shaderProgram(shaderVertexSource, shaderFragmentSource, id) {
    // compile both shader separately:
    const GLSLprecision = 'precision lowp float;';
    const glShaderVertex = compile_shader(shaderVertexSource, _gl.VERTEX_SHADER, "VERTEX " + id);
    const glShaderFragment = compile_shader(GLSLprecision + shaderFragmentSource, _gl.FRAGMENT_SHADER, "FRAGMENT " + id);

    const glShaderProgram = _gl.createProgram();
    _gl.attachShader(glShaderProgram, glShaderVertex);
    _gl.attachShader(glShaderProgram, glShaderFragment);

    // start the linking stage:
    _gl.linkProgram(glShaderProgram);
    const aPos = _gl.getAttribLocation(glShaderProgram, "position");
    _gl.enableVertexAttribArray(aPos);

    return {
      program: glShaderProgram,
      uniforms: {}
    };
  }


  function update_focals(viewHeight, cameraFoVY){
    // COMPUTE CAMERA PARAMS (FOCAL LENGTH)
    // see https://docs.opencv.org/3.0-beta/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html?highlight=projectpoints
    // and http://ksimek.github.io/2013/08/13/intrinsic/

    const halfFovYRad = 0.5 * cameraFoVY * _deg2rad;
    
    // settings with EPnP:
    const fy = 0.5 * viewHeight / Math.tan(halfFovYRad);
    const fx = fy;

    /*const halfFovXRad =halfFovYRad * that.get_viewAspectRatio();
    const cotanHalfFovX = 1.0 / Math.tan(halfFovXRad);
    const fx = 0.5 * that.get_viewWidth() * cotanHalfFovX; //*/

    console.log('INFO in WebARRocksFaceThreeHelper - focal_y =', fy);
    _focals[0] = fy, _focals[1] = fy;
  }


  function init_PnPSolver(imgPointsLabels, objPointsPositions){
    const imgPointsPx = [];
    for (let i=0; i<imgPointsLabels.length; ++i){
      imgPointsPx.push([0, 0]);
    }
    _computePose.imgPointsPx = imgPointsPx;
    _computePose.imgPointsLMIndices = imgPointsLabels.map(
      function(label, ind){
        return _landmarks.labels.indexOf(label);
      });
    _computePose.objPoints = imgPointsLabels.map(
      function(label, ind){
        return objPointsPositions[label].slice(0);
      }); 

    if (_computePose.isCenterObjPoints){
      // compute mean:
      const mean = [0, 0, 0];        
      _computePose.objPoints.forEach(function(pt){
        mean[0] += pt[0], mean[1] += pt[1], mean[2] += pt[2];
      });
      const n = _computePose.objPoints.length;
      mean[0] /= n, mean[1] /= n, mean[2] /= n;
      _computePose.objPointsMean = mean;

      // substract mean:
      _computePose.objPoints.forEach(function(pt){
        pt[0] -= mean[0], pt[1] -= mean[1], pt[2] -= mean[2];
      });      
    } //end if center obj points
  }

  
  function callbackReady(err, spec){
    if (err){
      console.log('ERROR in WebARRocksFaceThreeHelper. ERR =', err);
      if (_spec.callbackReady){
        _spec.callbackReady(err, null);
      }
      return;
    }

    window.addEventListener('focus', that.reset_landmarksStabilizers);

    console.log('INFO in WebARRocksFaceThreeHelper: WebAR.Rocks.face is ready. spec =', spec);
    
    _gl = spec.GL;
    _cv = spec.canvasElement;
    _glVideoTexture = spec.videoTexture;
    _videoTransformMat2 = spec.videoTransformMat2;
    _landmarks.labels = spec.landmarksLabels;
    _videoElement = spec.video;

    console.log('INFO in WebARRocksFaceThreeHelper: video resolution =', _videoElement.videoWidth, 'x', _videoElement.videoHeight);

    _landmarks.labels.forEach(function(label, ind){
      _landmarks.indices[label] = ind;
    });

    // init stabilizer:
    _landmarksStabilizers = [];
    
    init_shps();

     // pre-allocate:
    _three.matMov = new Matrix4();
    _three.matMov2 = new Matrix4();
    _three.euler = new Euler();

    _three.preMatrix = new Matrix4().makeRotationX(_spec.rxOffset);
    _three.preMatrix.setPosition(0.0, _spec.translationYZ[0], _spec.translationYZ[1]);
    _three.preMatrix.scale(new Vector3(1.0, 1.0, 1.0).multiplyScalar(_spec.scale));

    init_PnPSolver(_spec.solvePnPImgPointsLabels, _spec.solvePnPObjPointsPositions);
    _isInitialized = true;

    if (_spec.callbackReady){
      _spec.callbackReady(err, spec);
    }
  }


  function callbackTrack(detectStates){
    _gl.viewport(0, 0, that.get_viewWidth(), that.get_viewHeight());
   
    // draw the video:
    draw_video();
    
    if (_spec.maxFacesDetected > _three.faceSlots.length || !_isInitialized){
      return;
    }

    let landmarksStabilized = null;
    if (detectStates.length){ // multiface detection:
      landmarksStabilized = detectStates.map(process_faceSlot);
    } else { // only 1 face detected
      landmarksStabilized = process_faceSlot(detectStates, 0);
    }
    
    if (_spec.callbackTrack){
      _spec.callbackTrack(detectStates, landmarksStabilized);
    }
  }
  

  function draw_video(){
    // use the head draw shader program and sync uniforms:
    _gl.useProgram(_shps.copyCrop.program);

    if (_spec.callbackRenderVideo){
      _spec.callbackRenderVideo();
    }
    
    _gl.uniformMatrix2fv(_shps.copyCrop.uniforms.transformMat2, false, _videoTransformMat2);
    _gl.activeTexture(_gl.TEXTURE0);
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);

    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _gl.drawElements(_gl.TRIANGLES, 3, _gl.UNSIGNED_SHORT, 0);
  }


  function process_faceSlot(detectState, slotIndex){
    let landmarksStabilized = null;
    const faceSlot = _three.faceSlots[slotIndex];
    if (detectState.isDetected) {
      
      if (faceSlot.faceFollowerParent.visible){ // compute pose only if face follower is visible:
        let landmarks = null;      
        if (!_landmarksStabilizers[slotIndex]){
          _landmarksStabilizers[slotIndex] = stabilizer.instance(_landmarksStabilizerSpec || {});
        };
        landmarksStabilized = _landmarksStabilizers[slotIndex].update(detectState.landmarks, that.get_viewWidthCSSPx(), that.get_viewHeightCSSPx(), detectState.s);
        
        compute_pose(landmarksStabilized, faceSlot);
      }
      
      if (_spec.isVisibilityAuto){
        faceSlot.faceFollowerParent.visible = true;
      }
    } else if (faceSlot.faceFollowerParent.visible){
      if (_spec.isVisibilityAuto){
        faceSlot.faceFollowerParent.visible = false;
      }
      if (_landmarksStabilizers && _landmarksStabilizers[slotIndex]){
        _landmarksStabilizers[slotIndex].reset();
      }
    }

    return landmarksStabilized;
  }


  function compute_pose(landmarks, faceSlot){
    const w2 = that.get_viewWidth() / 2;
    const h2 = that.get_viewHeight() / 2;
    const imgPointsPx = _computePose.imgPointsPx;

    _computePose.imgPointsLMIndices.forEach(function(ind, i){
      const imgPointPx = imgPointsPx[i];
      imgPointPx[0] = - landmarks[ind][0] * w2,  // X in pixels
      imgPointPx[1] = - landmarks[ind][1] * h2;  // Y in pixels
    });

    const objectPoints = _computePose.objPoints;
    const solved = _WEBARROCKSFACE.compute_pose(objectPoints, imgPointsPx, _focals[0], _focals[1]);

    if (solved){
      const m = _three.matMov.elements;
      const r = solved.rotation, t = solved.translation;

      // set translation part:
      m[12] = -t[0], m[13] = -t[1], m[14] = -t[2];

      // set rotation part:
      m[0] = -r[0][0], m[4] =  -r[0][1], m[8] =  r[0][2],
      m[1] = -r[1][0], m[5] =  -r[1][1], m[9] =  r[1][2],
      m[2] = -r[2][0], m[6] =  -r[2][1], m[10] =  r[2][2];

      if (_spec.rotationContraints){
        apply_rotationConstraints(_three.matMov, _spec.rotationContraints);
      }

      _three.matMov.multiply(_three.preMatrix);
      
      faceSlot.faceFollowerParent.matrix.copy(_three.matMov);

      if (_computePose.isCenterObjPoints){
        const mean = _computePose.objPointsMean;
        faceSlot.faceFollower.position.fromArray(mean).multiplyScalar(-1);
      }
    }
  }


  function  apply_rotationConstraints(threeMat, constraints){
    _three.euler.setFromRotationMatrix(threeMat, constraints.order);
    _three.euler.set(
      constraints.rotXFactor * _three.euler.x,
      constraints.rotYFactor * _three.euler.y,
      constraints.rotZFactor * _three.euler.z,
      constraints.order
      );
    _three.matMov2.makeRotationFromEuler(_three.euler);
    _three.matMov2.copyPosition(threeMat);
    threeMat.copy(_three.matMov2);
  }


  // build shader programs:
  function init_shps(){
    
    const copyFragmentShaderSource = 'uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }';
    
    update_copyCropShader(copyFragmentShaderSource);
  }


  function update_copyCropShader(fragmentShaderSource){
    if (_shps.copyCrop){
      destroy_shaderProgram(_shps.copyCrop);
    }

    _shps.copyCrop = build_shaderProgram('attribute vec2 position;\n\
      uniform mat2 transform;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5 + transform * position;\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }',
      fragmentShaderSource,
      'COPY CROP');
    _shps.copyCrop.uniforms.transformMat2 = _gl.getUniformLocation(_shps.copyCrop.program, 'transform');
    return _shps.copyCrop.program;
  }


  function remove_threeChildren(threeNode){
    const children = threeNode.children.slice(0);
    children.forEach(function(child){
      threeNode.remove(child);
    });
  }

  
  const that = {
    init: function(WEBARROCKSFACE, spec, landmarksStabilizerSpec){
      _WEBARROCKSFACE = WEBARROCKSFACE;
      _spec = Object.assign({
        NN: null,
        NNCPath: null,
        canvas: null,
        scanSettings: null,
        
        rxOffset: 0,
        translationYZ: [0.0, 0.0], // Y+ -> upper, Z+ -> forward
        scale: 1.0,

        isVisibilityAuto: true,
        isTrackingEnabled: true,
        animateDelay: 0,   

        isKeepRunningOnWinFocusLost: false,
        maxFacesDetected: 1,

        // pose computation (SolvePnP):
        solvePnPObjPointsPositions: _defaultSolvePnPObjPointsPositions,
        solvePnPImgPointsLabels: _defaultSolvePnPImgPointsLabel,
        rotationContraints: null,

        // callbacks:
        callbackReady: null,
        callbackTrack: null,
        callbackRenderVideo: null
      }, spec);
      _landmarksStabilizerSpec = landmarksStabilizerSpec;
      
      // init WEBAR.rocks.face: WEBARROCKSFACE
      const defaultSpecLM = {
        canvas: null,
        NN: null, 
        NNCPath: null,       
        callbackReady: callbackReady,
        callbackTrack: callbackTrack
      };
      const specLM = Object.assign({}, defaultSpecLM, {
        canvas: _spec.canvas,
        NN: _spec.NN,
        NNCPath: _spec.NNCPath,
        isTrackingEnabled: _spec.isTrackingEnabled,
        animateDelay: _spec.animateDelay,
        maxFacesDetected: _spec.maxFacesDetected,
        scanSettings: _spec.scanSettings,
        isKeepRunningOnWinFocusLost: _spec.isKeepRunningOnWinFocusLost
      });

      if (typeof(spec.videoSettings) !== 'undefined'){
        specLM.videoSettings = spec.videoSettings;
      }

      Object.assign(_previousSizing, {
        width: -1, height: -1
      });

      console.log('INFO in WebARRocksFaceThreeHelper - WEBARROCKSFACE.init spec = ', specLM);
      _WEBARROCKSFACE.init(specLM);
    },


    set_faceFollower: function(faceFollowerParent, faceFollower, faceIndex){
      faceFollowerParent.frustumCulled = false;
      if (_spec.isVisibilityAuto){
        faceFollowerParent.visible = false;
      }
      faceFollowerParent.matrixAutoUpdate = false;
      _three.faceSlots[faceIndex] = {
        faceFollower: faceFollower,
        faceFollowerParent: faceFollowerParent
      };
      console.log('INFO in WebARRocksFaceThreeHelper: set_faceFollower() for faceIndex = ', faceIndex);
    },


    get_facePointPositions: function(){
      return _spec.solvePnPObjPointsPositions;
    },


    resize: function(){ // should be called after resize
      if (_WEBARROCKSFACE){
        _WEBARROCKSFACE.resize();
      }
    },


    create_occluderMesh: function(occluder, isDebug){

      // extract geometry:
      let occluderGeometry = null;
      if (occluder.type === 'BufferGeometry'){
        occluderGeometry = occluder;
      } else {
        occluder.traverse(function(threeStuff){
          if (threeStuff.type !== 'Mesh'){
            return;
          }
          if (occluderGeometry !== null && occluderGeometry !== threeStuff.geometry){
            throw new Error('The occluder should contain only one Geometry');
          }
          occluderGeometry = threeStuff.geometry;
        });
      }
      
      // create material:
      let mat = null;
      if (isDebug){
        occluderGeometry.computeVertexNormals();
        mat = new MeshNormalMaterial({side: DoubleSide});
      } else {
        mat = new ShaderMaterial({
          vertexShader: ShaderLib.basic.vertexShader,
          fragmentShader: "precision lowp float;\n void main(void){\n gl_FragColor = vec4(1.,0.,0.,1.);\n }",
          uniforms: ShaderLib.basic.uniforms,
          side: DoubleSide,
          colorWrite: false
        });
      }

      // create mesh:
      const occluderMesh = new Mesh(occluderGeometry, mat);
      occluderMesh.renderOrder = -1e12; // render first
      occluderMesh.userData.isOccluder = true;

      return occluderMesh;
    },


    get_sourceWidth: function(){
      return _videoElement.videoWidth;
    },


    get_sourceHeight: function(){
      return _videoElement.videoHeight;
    },


    get_viewWidthCSSPx: function(){
      return _cv.width / _dpr;
    },


    get_viewHeightCSSPx: function(){
      return _cv.height / _dpr;
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

    get_videoElement: function(){
      return _videoElement;
    },

    set_videoElement: function (videoElement) {
      _videoElement = videoElement
    },

    get_videoGL: function(){
      return _gl;
    },

    update_solvePnP: function(objPointsPositions, imgPointsLabels){
      if (objPointsPositions){
        _spec.solvePnPObjPointsPositions = Object.assign(_spec.solvePnPObjPointsPositions, objPointsPositions);
      }
      _spec.solvePnPImgPointsLabels = imgPointsLabels || _spec.solvePnPImgPointsLabels;
      init_PnPSolver(_spec.solvePnPImgPointsLabels, _spec.solvePnPObjPointsPositions);
    },


    update_threeCamera: function(sizing, threeCamera){
      if (!_videoElement) return;

      if (_previousSizing.width === sizing.width && _previousSizing.height === sizing.height){       
        return; // nothing changed
      }
      Object.assign(_previousSizing, sizing);      

      // reset camera position:
      if (threeCamera.matrixAutoUpdate){
        threeCamera.far = 10000;
        threeCamera.near = 1;
        threeCamera.matrixAutoUpdate = false;
        threeCamera.position.set(0, 0, 0);
        threeCamera.updateMatrix();
      }

      // compute aspectRatio:
      const cvw = sizing.width;
      const cvh = sizing.height;
      const canvasAspectRatio = cvw / cvh;

      // compute vertical field of view:
      const vw = that.get_sourceWidth();
      const vh = that.get_sourceHeight();
      const videoAspectRatio = vw / vh;
      const fovFactor = (vh > vw) ? (1.0 / videoAspectRatio) : 1.0;
      let fov = _settings.cameraMinVideoDimFov * fovFactor;
      
      if (canvasAspectRatio > videoAspectRatio) {
        const scale = cvw / vw;
        const cvhs = vh * scale;
        fov = 2 * Math.atan( (cvh / cvhs) * Math.tan(0.5 * fov * _deg2rad)) / _deg2rad;
      }
      console.log('INFO in WebARRocksFaceThreeHelper.update_threeCamera(): camera vertical estimated FoV is', fov, 'deg');

      // update projection matrix:
      threeCamera.aspect = canvasAspectRatio;
      threeCamera.fov = fov;
      threeCamera.updateProjectionMatrix();

      // update focals
      update_focals(sizing.height, fov);
    },


    change_NN: function(NNUrl){
      return _WEBARROCKSFACE.update({
        NNCPath: NNUrl
      }).then(function(){
        _landmarks.labels = _WEBARROCKSFACE.get_LMLabels();        
      });
    },


    reset_landmarksStabilizers: function () {
      console.log('INFO in WebARRocksFaceThreeHelper: reset stabilizers');
      if (_landmarksStabilizers && _landmarksStabilizers.length) {
        _landmarksStabilizers.forEach(function (stab) {
          stab.reset();
        })
      }
    },


    update_video: function(video){
      return new Promise(function(accept, reject){
        _WEBARROCKSFACE.update_videoElement(video, function(newGlVideoTexture){
          _glVideoTexture = newGlVideoTexture;
          _WEBARROCKSFACE.resize();
          accept();
        });
      });      
    },


    update_renderVideoShader(fragmentShaderSource){
      return update_copyCropShader(fragmentShaderSource);
    },


    set_defaultRenderVideoShader(){
      init_shps();
    },


    clean: function(){
      console.log('INFO in WebARRocksFaceThreeHelper: clean');
      _three.faceSlots.forEach(function(slot){
        if (!slot) return;
        if (slot.faceFollower){
          slot.faceFollower.children.forEach(remove_threeChildren);          
        }
      });
      _three.faceSlots.splice(0);  

      /*Object.assign(_previousSizing, {
        width: -1, height: -1
      });*/      
    }

  }; //end that
  return that;
})();

export default WebARRocksFaceThreeHelper;