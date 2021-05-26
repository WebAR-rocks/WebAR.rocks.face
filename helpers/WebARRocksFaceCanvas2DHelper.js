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
 * Helper to use canvas2D with WebAR.rocks.face
 *
 */ 

"use strict";

const WebARRocksFaceCanvas2DHelper = (function(){

  // private variables:
  let _spec = null;
  let _gl = null, _cv = null, _glVideoTexture = null, _videoTransformMat2 = null, _landmarksLabels = null;
  let _stabilizer = null;

  const _shps = {};
  const _friendlyDetectState = {
    isDetected: false,
    faceCrop: [[0,0],[0,0],[0,0],[0,0]],
    ry: 0,
    faceWidth: 0,
    landmarks: {}
  };

  // degrees to radians:
  const _deg2rad = Math.PI / 180;

  // private functions:
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

  // build shader programs:
  function init_shps(){
    // create copy shp, used to display the video on the canvas:
    _shps.copyCrop = build_shaderProgram('attribute vec2 position;\n\
      uniform mat2 transform;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5 + transform * position;\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }'
      ,
      'uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }',
      'COPY CROP');
    _shps.copyCrop.uniforms.transformMat2 = _gl.getUniformLocation(_shps.copyCrop.program, 'transform');
  }

  function draw_video(){
    // use the head draw shader program and sync uniforms:
    _gl.useProgram(_shps.copyCrop.program);
    _gl.uniformMatrix2fv(_shps.copyCrop.uniforms.transformMat2, false, _videoTransformMat2);
    _gl.activeTexture(_gl.TEXTURE0);
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);
    
    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _gl.drawElements(_gl.TRIANGLES, 3, _gl.UNSIGNED_SHORT, 0);
  }

  function callbackReady(err, spec){
    if (err){
      _spec.callbackReady(err, spec);
      return;
    }

    _gl = spec.GL;
    _cv = spec.canvasElement;
    _glVideoTexture = spec.videoTexture;
    _videoTransformMat2 = spec.videoTransformMat2;
    _landmarksLabels = spec.landmarksLabels;

    // initialize _friendlyDetectState.landmarks:
    _landmarksLabels.forEach(function(lmLabel){
      _friendlyDetectState.landmarks[lmLabel] = [0, 0];
    });

    init_shps();

    _spec.callbackReady(false, spec);
  }

  function callbackTrack(detectState){
    // draw the video:
    _gl.viewport(0, 0, _cv.width, _cv.height);
    draw_video();

    // compute friendly data:
    _friendlyDetectState.isDetected = detectState.isDetected;

    let landmarksStabilized = null;

    if (_friendlyDetectState.isDetected){
      // get canvas dimensions:
      const cvw = _cv.width;
      const cvh = _cv.height;

      landmarksStabilized = _stabilizer.update(detectState.landmarks, cvw, cvh);

      // compute face crop points:
      // size of face crop square in pixels:
      const w = detectState.s * _cv.width;
      // center coordinates in pixels:
      const cx = (0.5 + 0.5*detectState.x) * cvw;
      const cy = (0.5 - 0.5*detectState.y) * cvh;
      const faceCrop = _friendlyDetectState.faceCrop;
      const xMin = cx - w/2;
      const xMax = cx + w/2;
      const yMin = cy - w/2;
      const yMax = cy + w/2;
      faceCrop[0][0] = xMin, faceCrop[0][1] = yMin;
      faceCrop[1][0] = xMax, faceCrop[1][1] = yMin;
      faceCrop[2][0] = xMax, faceCrop[2][1] = yMax;
      faceCrop[3][0] = xMin, faceCrop[3][1] = yMax;

      // face width:
      _friendlyDetectState.faceWidth = w;

      // copy Y rotation:
      _friendlyDetectState.ry = detectState.ry / _deg2rad;

      // compute landmarks pixel positions:
      const landmarks = _friendlyDetectState.landmarks;
      landmarksStabilized.forEach(function(lmPos, lmInd){
        const label = _landmarksLabels[lmInd];
        landmarks[label][0] = (0.5 + 0.5*lmPos[0]) * cvw;
        landmarks[label][1] = (0.5 - 0.5*lmPos[1]) * cvh;
      });
    }

    _spec.callbackTrack(_friendlyDetectState);

    _gl.flush();
  }

  // public methods:
  const that = {
    init: function(spec){
      _spec = spec;

      _stabilizer = WebARRocksLMStabilizer.instance({});

      WEBARROCKSFACE.init(Object.assign({
        callbackReady: callbackReady,
        callbackTrack: callbackTrack,
        stabilizationSettings: {
          'translationFactorRange': [0.002, 0.005],// translation speed quality factor
          'rotationFactorRange': [0.03, 0.05],     // rotation speed quality factor
          'qualityFactorRange': [0.8, 0.9],        // compare detected state with these values
          'alphaRange': [0.05, 0.92]              // for state stabilization: alpha min (when detection quality is good)          
        }
      }, _spec.spec));
    }
  };

  return that;
})();