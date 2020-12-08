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

/*
 * Helper tu use 3D earrings with WebAR.rocks.face
 * Unlike glasses VTO or flexible masks we don't compute the pose from 2D points
 */ 

"use strict";

const WebARRocksFaceEarrings3DHelper = (function(){
  const _defaultSpec = {
    canvasFace: null,
    canvasThree: null,
    NN: '../../neuralNets/NN_EARS_2.json',
    videoURL: null, // use a video file instead of camera

    earringsScale: 1,
    earsDistance: 22, // in cm, mean distance between the 2 ears

    // camera parameters:
    cameraFovRange: [30, 90],
    cameraMinVideoDimFov: 40,
    cameraZoom: 1,

    // ears occlusion:
    angleHide: 5, // head rotation angle in degrees from which we should hide the earrings
    angleHysteresis: 0.5, // add hysteresis to angleHide value, in degrees
    scale: 0.08,    // width of the earring compared to the face width (1 -> 100% of the face width)
    pullUp: 0.05,   // 0 -> earring are displayed at the bottom of the spotted position
                    // 1 -> earring are displaed above the spotted position 
    k: 0.7,  // position is interpolated between 2 keypoints. this is the interpolation coefficient
             // 0-> earrings are at the bottom of the ear, 1-> earrings are further back
    
    scanSettings: {
      threshold: 0.7
    },

    // callbacks
    callbackTrack: null,

    // postprocessing:
    taaLevel: 0,

    // debug flag:
    debugOccluder: false
  };


  let _spec = null;
  const _three = {
    renderer: null,
    composer: null,
    scene: null,
    loadingManager: null,
    camera: null,
    earringLeft: null,
    earringRight: null,
    occluderMat: null
  };

  let _videoElement = null, _cameraFoVY = -1;
  let _gl = null, _glVideoTexture = null, _glShpDrawVideo = null;
  let _earLeft = null, _earRight = null;
  let _stabilizer = null;
  let _shpDrawVideoUniformTransform2D = null, _videoTransformMat2 = null;

  const _headPose = {
    euler: null,
    ear2ear: null
  };
  const _comp = { // computation intermediary results:
    urCrossK: null,
    ulCrossK: null,
    denom: null
  };
  const _lmIndPerLabel = {};

  // degrees to radians:
  const _deg2rad = Math.PI / 180;

  // draw video on the WebAR.rocks.face canvas:
  function draw_video(){
    // use the head draw shader program and sync uniforms:
    _gl.useProgram(_glShpDrawVideo);
    _gl.uniformMatrix2fv(_shpDrawVideoUniformTransform2D, false, _videoTransformMat2);
    _gl.activeTexture(_gl.TEXTURE0);
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);
    
    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _gl.drawElements(_gl.TRIANGLES, 3, _gl.UNSIGNED_SHORT, 0);
  }

  // build shader program to display video:
  function init_drawVideoShp(){
    const shaderVertexSource = 'attribute vec2 position;\n\
      uniform mat2 transform;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5 + transform * position;\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }'; 
    const glShaderVertex = compile_shader(shaderVertexSource, _gl.VERTEX_SHADER, "VERTEX DRAWVIDEO");
    
    const shaderFragmentSource =  'precision lowp float;\n\
      uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }'
    const glShaderFragment = compile_shader(shaderFragmentSource, _gl.FRAGMENT_SHADER, "FRAGMENT DRAWVIDEO");

    _glShpDrawVideo = _gl.createProgram();
    _gl.attachShader(_glShpDrawVideo, glShaderVertex);
    _gl.attachShader(_glShpDrawVideo, glShaderFragment);

    // start the linking stage:
    _gl.linkProgram(_glShpDrawVideo);
    const aPos = _gl.getAttribLocation(_glShpDrawVideo, "position");
    _shpDrawVideoUniformTransform2D = _gl.getUniformLocation(_glShpDrawVideo, 'transform');
    _gl.enableVertexAttribArray(aPos);
  }

  function compile_shader(source, glType, typeString) {
    const glShader = _gl.createShader(glType);
    _gl.shaderSource(glShader, source);
    _gl.compileShader(glShader);
    if (!_gl.getShaderParameter(glShader, _gl.COMPILE_STATUS)) {
      throw new Error("ERROR IN " + typeString + " SHADER: " + _gl.getShaderInfoLog(glShader));
      return null;
    }
    return glShader;
  };


  function init_three(){
    // init renderer:
    _three.renderer = new THREE.WebGLRenderer({
      canvas: _spec.canvasThree,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    _three.renderer.setClearAlpha(0);

    // init composer (for postprocessing):
    _three.composer = new THREE.EffectComposer( _three.renderer );

    // init scene:
    _three.scene = new THREE.Scene();

    // init loading manager:
    _three.loadingManager = new THREE.LoadingManager();

    // init camera:
    const viewAspectRatio = _spec.canvasThree.width / _spec.canvasThree.height;
    _three.camera = new THREE.PerspectiveCamera(_cameraFoVY, viewAspectRatio, 0.1, 5000);
    that.update_threeCamera();

    // set postprocessing:
    const renderScenePass = new THREE.RenderPass( _three.scene, _three.camera );
    if (_spec.taaLevel > 0){
      // add temporal anti-aliasing pass:
      const taaRenderPass = new THREE.TAARenderPass( _three.scene, _three.camera );
      taaRenderPass.unbiased = false;
      _three.composer.addPass( taaRenderPass );
      taaRenderPass.sampleLevel = _spec.taaLevel;
    }
    _three.composer.addPass( renderScenePass );
    if (_spec.taaLevel > 0){
      renderScenePass.enabled = false;
      const copyPass = new THREE.ShaderPass( THREE.CopyShader );
      _three.composer.addPass( copyPass );
    }

    // init earrings and hide them:
    const create_threeEarringContainer = function(){
      const tec = new THREE.Object3D();
      tec.visible = false;
      tec.frustumCulled = false;
      tec.scale.multiplyScalar(_spec.earringsScale);
      _three.scene.add(tec);
      return tec;
    }
    _three.earringLeft = create_threeEarringContainer();
    _three.earringRight = create_threeEarringContainer();
    
    // init stuffs used for head pose computation:
    _headPose.euler = new THREE.Euler();
    _headPose.ear2ear = new THREE.Vector3();

    // init vectors used for earrings position computation:
    const create_ear = function(){
      return {
        projected: new THREE.Vector3(),
        u: new THREE.Vector3(),
        pos: new THREE.Vector3()
      };
    };
    _earLeft = create_ear();
    _earRight = create_ear();

    // intermediary computation allocations:
    _comp.urCrossK = new THREE.Vector3();
    _comp.ulCrossK = new THREE.Vector3();
    _comp.denom = new THREE.Vector3();

    // occluder material:
    _three.occluderMat = (_spec.debugOccluder) ? new THREE.MeshNormalMaterial({side: THREE.DoubleSide})
     : new THREE.ShaderMaterial({
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: "precision lowp float;\n void main(void){\n gl_FragColor = vec4(1., 0., 0., 1.);\n }",
      uniforms: THREE.ShaderLib.basic.uniforms,
      side: THREE.DoubleSide,
      colorWrite: false
    });
  }

  function init_landmarks(){
    WEBARROCKSFACE.get_LMLabels().forEach(function(lmLabel, lmInd){
      _lmIndPerLabel[lmLabel] = lmInd;
    });    
  }

  function update_earringVisibility(threeObject, wayFactor, ry){
    const visibleFactor = (threeObject.visible) ? 1 : -1;
    const angleHide = -(_spec.angleHide + _spec.angleHysteresis * visibleFactor);
    threeObject.visible = (wayFactor * ry > angleHide * _deg2rad);
  }

  function compute_headPose(rx, ry, rz){
    _headPose.euler.set(rx, ry, rz, "ZXY");

    // compute ear to ear vector in the view ref:
    const K = _headPose.ear2ear;
    K.set(1, 0, 0);
    K.applyEuler(_headPose.euler);
    K.multiplyScalar(_spec.earsDistance);
  }

  function extract_earringPosition(earBottomLandmark, earEarringLandmark, ear){
    // get projected position of the earring:
    const k = _spec.k;
    const camera = _three.camera;
    ear.projected.set(
      earBottomLandmark[0] * (1-k) + earEarringLandmark[0] * k,
      earBottomLandmark[1] * (1-k) + earEarringLandmark[1] * k,    
      0
    );

    // unproject using camera to get the unit ray vector in view ref:
    ear.u.copy(ear.projected).unproject(camera);
    ear.u.normalize();
  }

 
  function callbackTrack(detectState){
    // draw the video:
    _gl.viewport(0, 0, that.get_viewWidth(), that.get_viewHeight());
    draw_video();
    _gl.flush();

    // draw the THREE.js scene:
    if (detectState.isDetected) {
      // update earrings visibility:
      update_earringVisibility(_three.earringRight, 1, detectState.ry);
      update_earringVisibility(_three.earringLeft, -1, detectState.ry);
      
      // compute headRotationMatrix:
      compute_headPose(detectState.rx, detectState.ry, detectState.rz);

      // stabilize landmarks positions:
      const lms = _stabilizer.update(detectState.landmarks, that.get_viewWidth(), that.get_viewHeight());

      // compute earrings 2D positions and director vectors:
      extract_earringPosition(lms[_lmIndPerLabel.rightEarBottom], lms[_lmIndPerLabel.rightEarEarring], _earRight);
      extract_earringPosition(lms[_lmIndPerLabel.leftEarBottom], lms[_lmIndPerLabel.leftEarEarring], _earLeft);

      // compute dr and dl, distance from camera to ears:
      const K = _headPose.ear2ear;
      const ur = _earRight.u, ul = _earLeft.u;
      const ulCrossK = _comp.ulCrossK, urCrossK = _comp.urCrossK;
      const denom = _comp.denom;

      // intermediary results:
      ulCrossK.copy(ul).cross(K);
      urCrossK.copy(ur).cross(K);
      const alpha = ulCrossK.length() / urCrossK.length();
      denom.copy(ur).multiplyScalar(-alpha).add(ul);

      // compute distances to camera:
      const dl = K.length() / denom.length();
      const dr = dl * alpha;

      // compute 3D position and apply them:
      _earRight.pos.copy(_earRight.u).multiplyScalar(dr);
      _earLeft.pos.copy(_earLeft.u).multiplyScalar(dl);
      _three.earringRight.position.copy(_earRight.pos);
      _three.earringLeft.position.copy(_earLeft.pos);
      
      // set earrings orientation:
      _three.earringRight.rotation.set(0, detectState.ry, 0);
      _three.earringLeft.rotation.set(0, detectState.ry, 0);
      
    } else {
      _three.earringRight.visible = false;
      _three.earringLeft.visible = false;
      _stabilizer.reset();
    }

    //_three.renderer.render(_three.scene, _three.camera);
    _three.composer.render();

    if (_spec.callbackTrack !== null){
      _spec.callbackTrack(detectState);
    }
  } //end callbackTrack()


  function start(domVideo){
    return new Promise(function(accept, reject){
      const initSettings = {
        canvas: _spec.canvasFace,
        NNCPath: _spec.NN,
        scanSettings: _spec.scanSettings,
        callbackReady: function(err, spec){
          if (err){
            reject(err);
            return;
          }

          _gl = spec.GL;
          _glVideoTexture = spec.videoTexture;
          _videoTransformMat2 = spec.videoTransformMat2;
          _videoElement = spec.video;
          init_drawVideoShp();
          init_three();
          init_landmarks();

          accept(_three);
        },
        callbackTrack: callbackTrack,
      };
      if (domVideo){
        initSettings.videoSettings = {videoElement: domVideo};
      }
      WEBARROCKSFACE.init(initSettings);
    }); //end returned promise
  }

  // public methods:
  const that = {
    init: function(spec){
      _spec = Object.assign({}, _defaultSpec, spec);

      _stabilizer = WebARRocksLMStabilizer.instance({});

      if (_spec.videoURL){
        const domVideo = document.createElement('video');
        domVideo.setAttribute('src', _spec.videoURL);
        domVideo.setAttribute('autoplay', true);
        domVideo.setAttribute('loop', true);
        domVideo.setAttribute('playsinline', true); // for IOS
        document.body.appendChild(domVideo);
        return new Promise(function(accept, reject){
          domVideo.oncanplay = function(e){
            domVideo.oncanplay = null;
            start(domVideo).then(function(three){
              let isPlaying = false;
              const onUserEvent = function(){
                if (isPlaying) return;
                domVideo.style.display = 'none';
                domVideo.play();
                accept(three);
                isPlaying = true;
              }
              window.addEventListener('click', onUserEvent); // desktop
              window.addEventListener('touchstart', onUserEvent); // mobile      
            }).catch(reject);
          }
        });        
      } else {
        return start(null);
      }
      
    },

    get_sourceWidth: function(){
      return _videoElement.videoWidth;
    },

    get_sourceHeight: function(){
      return _videoElement.videoHeight;
    },

    get_viewWidth: function(){
      return _spec.canvasThree.width;
    },

    get_viewHeight: function(){
      return _spec.canvasThree.height;
    },

    resize: function(w, h){
      // resize WebAR.face canvas:
      _spec.canvasFace.width = w;
      _spec.canvasFace.height = h;
      WEBARROCKSFACE.resize();
      
      // resize THREE renderer:
      _spec.canvasThree.width = w;
      _spec.canvasThree.height = h;
      that.update_threeCamera();
    },

    add_threeEarsOccluders: function(geomRight){
      const set_occluderMesh = function(earring, geom){
        const threeMesh = new THREE.Mesh(geom, _three.occluderMat);
        threeMesh.renderOrder = -1e12; // render first
        earring.add(threeMesh);
      }
      set_occluderMesh(_three.earringRight, geomRight);

      // compute geomLeft from geomRight:
      const geomLeft = geomRight.clone();
      const invXMatrix = new THREE.Matrix4().makeScale(-1,1,1);
      geomLeft.applyMatrix4(invXMatrix);
      set_occluderMesh(_three.earringLeft, geomLeft);
    },

    update_threeCamera: function(){
      if (!_videoElement) return;
      
      // compute aspectRatio:
      const cvw = that.get_viewWidth();
      const cvh = that.get_viewHeight();
      const canvasAspectRatio = cvw / cvh;

      // compute vertical field of view:
      const vw = that.get_sourceWidth();
      const vh = that.get_sourceHeight();
      const videoAspectRatio = vw / vh;
      let fovFactor = (vh > vw) ? (1.0 / videoAspectRatio) : 1.0;
      let fov = _spec.cameraMinVideoDimFov * fovFactor;
      fov = Math.min(Math.max(fov, _spec.cameraFovRange[0]), _spec.cameraFovRange[1]);
      
      if (canvasAspectRatio > videoAspectRatio) {
        const scale = cvw / vw;
        const cvhs = vh * scale;
        fov = 2 * Math.atan( (cvh / cvhs) * Math.tan(0.5 * fov * _deg2rad)) / _deg2rad;
      }
      _cameraFoVY = fov;
      console.log('INFO in update_threeCamera(): camera vertical estimated FoV is', fov, 'deg');

      // update projection matrix:
      _three.camera.aspect = canvasAspectRatio;
      _three.camera.zoom = _spec.cameraZoom;
      _three.camera.fov = fov;
      _three.camera.updateProjectionMatrix();

      // update drawing area:
      _three.renderer.setSize(cvw, cvh, false);
      _three.renderer.setViewport(0, 0, cvw, cvh);
      _three.composer.setSize(cvw, cvh);

    }
  }; //end that
  return that;
})();

// Export ES6 module:
try {
  module.exports = WebARRocksFaceEarrings3DHelper;
} catch(e){
  console.log('ES6 Module not exported');
}
