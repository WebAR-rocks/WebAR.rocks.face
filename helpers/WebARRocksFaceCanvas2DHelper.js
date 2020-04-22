/*
 * Helper to use canvas2D with WebAR.rocks.face
 *
 */ 

"use strict";

const WebARRocksFaceCanvas2DHelper = (function(){

  // private variables:
  let _spec = null;
  let _gl, _cv, _glVideoTexture, _landmarksLabels;

  const _shps = {};
  const _friendlyData = {
    detected: false,
    faceCrop: [[0,0],[0,0],[0,0],[0,0]],
    ry: 0,
    faceWidth: 0,
    landmarks: {}
  };

  // private functions:
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
    const GLSLprecision='precision lowp float;';
    const shaderVertex=compile_shader(shaderVertexSource, _gl.VERTEX_SHADER, "VERTEX " + id);
    const shaderFragment=compile_shader(GLSLprecision + shaderFragmentSource, _gl.FRAGMENT_SHADER, "FRAGMENT " + id);

    const shaderProgram=_gl.createProgram();
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

  // build shader programs:
  function init_shps(){
    // create copy shp, used to display the video on the canvas:
    _shps.copy = build_shaderProgram('attribute vec2 position;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        vUV = 0.5*position+vec2(0.5,0.5);\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }'
      ,
      'uniform sampler2D uun_source;\n\
      varying vec2 vUV;\n\
      void main(void){\n\
        gl_FragColor = texture2D(uun_source, vUV);\n\
      }',
      'COPY');
  }

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

  function callbackReady(err, spec){
    if (err){
      _spec.callbackReady(err, spec);
      return;
    }

    _gl = spec.GL;
    _cv = spec.canvasElement;
    _glVideoTexture = spec.videoTexture;
    _landmarksLabels = spec.landmarksLabels;

    // initialize _friendlyData.landmarks:
    _landmarksLabels.forEach(function(lmLabel){
      _friendlyData.landmarks[lmLabel] = [0, 0];
    });

    init_shps();

    _spec.callbackReady(false, spec);
  }

  function callbackTrack(detectState){
    // draw the video:
    _gl.viewport(0, 0, _cv.width, _cv.height);
    draw_video();

    // compute friendly data:
    _friendlyData.detected = detectState.detected > 0.5;
    
    if (_friendlyData.detected){
      // get canvas dimensions:
      const cvw = _cv.width;
      const cvh = _cv.height;

      // compute face crop points:
      // size of face crop square in pixels:
      const w = detectState.s * _cv.width;
      // center coordinates in pixels:
      const cx = (0.5 + 0.5*detectState.x) * cvw;
      const cy = (0.5 - 0.5*detectState.y) * cvh;
      const faceCrop = _friendlyData.faceCrop;
      const xMin = cx - w/2;
      const xMax = cx + w/2;
      const yMin = cy - w/2;
      const yMax = cy + w/2;
      faceCrop[0][0] = xMin, faceCrop[0][1] = yMin;
      faceCrop[1][0] = xMax, faceCrop[1][1] = yMin;
      faceCrop[2][0] = xMax, faceCrop[2][1] = yMax;
      faceCrop[3][0] = xMin, faceCrop[3][1] = yMax;

      // face width:
      _friendlyData.faceWidth = w;

      // copy Y rotation:
      _friendlyData.ry = detectState.ry * 180/Math.PI;

      // compute landmarks pixel positions:
      const landmarks = _friendlyData.landmarks;
      detectState.landmarks.forEach(function(lmPos, lmInd){
        const label = _landmarksLabels[lmInd];
        landmarks[label][0] = (0.5 + 0.5*lmPos[0]) * cvw;
        landmarks[label][1] = (0.5 - 0.5*lmPos[1]) * cvh;
      });
    }

    _spec.callbackTrack(_friendlyData);

    _gl.flush();
  }

  // public methods:
  const that = {
    init: function(spec){
      _spec = spec;
      WEBARROCKSFACE.init(Object.assign({
        callbackReady: callbackReady,
        callbackTrack: callbackTrack,
        stabilizationSettings: {
          'translationFactorRange': [0.002, 0.005],// translation speed quality factor
          'rotationFactorRange': [0.03, 0.05],     // rotation speed quality factor
          'qualityFactorRange': [0.8, 0.9],        // compare detected state with these values
          'alphaRange': [0.05, 0.92],              // for state stabilization: alpha min (when detection quality is good)
          'LMmedianFilterLength': 10,              // Median filter window size
          'LMmedianFilterSkip': 3,                 // Remove this number of value in median filter window size, then average the remaining values
          'LMminDisplacement': 0.5,                // change LM position if displacement is larger than this value (relative). multiplied by 1/inputWidth
          'qualityGoodDetectionThreshold': 0.08,   // good detection considered if quality is above this value
        }
      }, _spec.spec));
    }
  };

  return that;
})();