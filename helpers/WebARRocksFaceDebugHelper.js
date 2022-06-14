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


const WebARRocksFaceDebugHelper = (function(){
  const _settings = {
    pointSize: 5, // when landmarks are displayed, their size in pixels
  };

  let _spec = null;
  let _pointSize = _settings.pointSize;

  const _shps = { // shader programs
    drawPoints: null,
    copy: null
  };

  let _gl = null, _cv = null;
  let _videoElement = null;

  const _landmarks = {
    labels: null,
    indices: {}
  };

  const _drawLandmarks = {
    vertices: null,
    glIndicesVBO: null,
    glVerticesVBO: null
  };

  const _landmarksStabilizers = [];


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
  

  function init_drawLandmarks(){
    _drawLandmarks.vertices = new Float32Array(_landmarks.labels.length*2);

    // create vertex buffer objects:
    // VBO to draw only 1 point
    _drawLandmarks.glVerticesVBO = _gl.createBuffer();
    _gl.bindBuffer(_gl.ARRAY_BUFFER, _drawLandmarks.glVerticesVBO);
    _gl.bufferData(_gl.ARRAY_BUFFER, _drawLandmarks.vertices, _gl.DYNAMIC_DRAW);

    const indices = new Uint16Array(_landmarks.labels.length);
    for (let i=0; i<_landmarks.labels.length; ++i){
      indices[i] = i;
    }
    _drawLandmarks.glIndicesVBO = _gl.createBuffer();
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _drawLandmarks.glIndicesVBO);
    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, indices, _gl.STATIC_DRAW);
  }


  function callbackReady(err, spec){
    if (err){
      console.log('ERROR in WebARRocksFaceDebugHelper. ERR =', err);
      if (_spec.callbackReady){
        _spec.callbackReady(err, null);
      }
      return;
    }

    console.log('INFO in WebARRocksFaceDebugHelper: WebAR.Rocks.face is ready. spec =', spec);
    
    _gl = spec.GL;
    _cv = spec.canvasElement;
    _landmarks.labels = spec.landmarksLabels;
    _videoElement = spec.video;

    if (_videoElement){
      console.log('INFO in WebARRocksFaceDebugHelper: video resolution =', _videoElement.videoWidth, 'x', _videoElement.videoHeight);
    }

    _landmarks.labels.forEach(function(label, ind){
      _landmarks.indices[label] = ind;
    });

    init_shps();
    init_drawLandmarks();
    
    if (_spec.callbackReady){
      _spec.callbackReady(err, spec);
    }
  }


  function callbackTrack(detectStates){
    _gl.viewport(0, 0, that.get_viewWidth(), that.get_viewHeight());
   
    // draw the video:
    WEBARROCKSFACE.render_video();
    
    if (detectStates.length){ // multiface detection:
      detectStates.forEach(process_faceSlot);
    } else { // only 1 face detected
      process_faceSlot(detectStates, 0);
    }
    
    if (_spec.callbackTrack){
      _spec.callbackTrack(detectStates);
    }
  }


  function get_landmarksStabilizer(slotIndex){
    if (!_landmarksStabilizers[slotIndex]){
      _landmarksStabilizers[slotIndex] = WebARRocksLMStabilizer.instance({});
    }

    return _landmarksStabilizers[slotIndex];
  }


  function process_faceSlot(detectState, slotIndex){
   if (detectState.isDetected) {
      // stabilize landmarks:
      let landmarks = null;
      if (_spec.isStabilized){
        landmarks = get_landmarksStabilizer(slotIndex).update(detectState.landmarks, that.get_viewWidth(), that.get_viewHeight(), detectState.s);
      } else {
        landmarks = detectState.landmarks;
      }

      // draw landmarks:
      draw_landmarks(landmarks);
    } else if(_spec.isStabilized){
      get_landmarksStabilizer(slotIndex).reset();
    }
  }


  function draw_landmarks(landmarks){
    // copy landmarks:
    landmarks.forEach(copy_landmark);

    // draw landmarks:
    _gl.useProgram(_shps.drawPoints.program);
    _gl.uniform1f(_shps.drawPoints.uniforms.pointSize, _pointSize);

    _gl.bindBuffer(_gl.ARRAY_BUFFER, _drawLandmarks.glVerticesVBO);
    _gl.bufferData(_gl.ARRAY_BUFFER, _drawLandmarks.vertices, _gl.DYNAMIC_DRAW);
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _drawLandmarks.glIndicesVBO);
    _gl.vertexAttribPointer(0, 2, _gl.FLOAT, false, 8,0);

    _gl.drawElements(_gl.POINTS, _landmarks.labels.length, _gl.UNSIGNED_SHORT, 0);
  }


  function copy_landmark(lm, lmIndex){
    _drawLandmarks.vertices[lmIndex*2] =     lm[0]; // X
    _drawLandmarks.vertices[lmIndex*2 + 1] = lm[1]; // Y
  }


  // build shader programs:
  function init_shps(){
    // create LM display shader program:
    const shaderVertexSource = "attribute vec2 position;\n\
      uniform float pointSize;\n\
      void main(void) {\n\
        gl_PointSize = pointSize;\n\
        gl_Position = vec4(position, 0., 1.);\n\
      } ";
    // display lime color:
    const shaderFragmentSource = "void main(void){\n\
        gl_FragColor = vec4(0.,1.,0.,1.);\n\
      }";

    _shps.drawPoints = build_shaderProgram(shaderVertexSource, shaderFragmentSource, 'DRAWPOINT');    
    _shps.drawPoints.uniforms.pointSize = _gl.getUniformLocation(_shps.drawPoints.program, 'pointSize');
  }


  const that = {
    init: function(spec){
      _spec = Object.assign({
        spec: {},
        isStabilized: (typeof(WebARRocksLMStabilizer) !== 'undefined'),
        videoURL: null,

        // callbacks:
        callbackReady: null,
        callbackTrack: null
      }, spec);
      
      // init WEBAR.rocks.face:WEBARROCKSFACE
      const defaultSpecLM = {
        canvas: null,
        canvasId: 'WebARRocksFaceCanvas',
        NNCPath: '../../neuralNets/',
        callbackReady: callbackReady,
        callbackTrack: callbackTrack
      };
      _spec.spec = Object.assign({}, defaultSpecLM, spec.spec);
      if (_spec.spec.canvas === null){
        _spec.spec.canvas = document.getElementById(_spec.spec.canvasId);
      }
      
      if (_spec.videoURL){
        that.load_video(_spec.videoURL).then(function(){
          WEBARROCKSFACE.init(_spec.spec);
        })
      } else {
        WEBARROCKSFACE.init(_spec.spec);
      }
    },


    load_video: function(videoURL){
      const domVideo = document.createElement('video');
      domVideo.setAttribute('src', videoURL);
      domVideo.setAttribute('autoplay', true);
      domVideo.setAttribute('loop', true);
      domVideo.setAttribute('preload', true);
      domVideo.setAttribute('muted', 'muted');
      domVideo.setAttribute('playsinline', true); // for IOS

      // append the video to the DOM for debug:
      document.body.appendChild(domVideo);
      domVideo.style.maxWidth = '50vw';
      domVideo.style.border = "1px solid red";

      return new Promise(function(accept, reject){
        domVideo.oncanplay = function(e){
          console.log('INFO in WebARRocksFaceThreeHelper: video file can play');
          domVideo.oncanplay = null;
          let isPlaying = false;
          // the user needs to interact with the DOM to start the video (browser security)
          const onUserEvent = function(){
            domVideo.play();
            if (isPlaying) return;
            domVideo.style.display = 'none';
            isPlaying = true;
            _spec.spec.videoSettings = {videoElement: domVideo};
            accept();              
          }            
          window.addEventListener('click', onUserEvent); // desktop
          window.addEventListener('touchstart', onUserEvent); // mobile
        }
      });
    },


    resize: function(w, h){
      if (_gl){
        // Fix a bug with IOS14.7 and WebGL2
        _gl.bindFramebuffer(_gl.FRAMEBUFFER, null);
      }
      _cv.width = w, _cv.height = h;
      WEBARROCKSFACE.resize();      
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


    set_pointSize: function(ps){
      _pointSize = ps;
    },


    change_NN: function(NNUrl){
      return WEBARROCKSFACE.update({
        NNCPath: NNUrl
      }).then(function(){
        _landmarks.labels = WEBARROCKSFACE.get_LMLabels();
        init_drawLandmarks();
      });
    },


    update_video: function(video){
      return new Promise(function(accept, reject){
        WEBARROCKSFACE.update_videoElement(video, function(glVideoTexture){
          WEBARROCKSFACE.reset();
          WEBARROCKSFACE.resize();
          accept();
        });
      });
    },


    toggle_stabilization: function(isStabilized){
      _spec.isStabilized = isStabilized;
    }
  }; //end that
  return that;
})();


// Export ES6 module:
try {
  module.exports = WebARRocksFaceDebugHelper;
} catch(e){
  console.log('ES6 Module not exported');
}