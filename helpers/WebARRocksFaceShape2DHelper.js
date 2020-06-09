const WebARRocksFaceShape2DHelper = (function(){
  const _defaultSpec = {
    NNCpath: null,
    canvasVideo: null,
    canvasAR: null,
    shapes: []
  };
  let _spec = null;
  let _shapes = null;

  let _gl = null; // gl context is for the AR canvas
  let _points = null, _pointsCount = -1;
  let _glv = null, _glvVideoTexture = null, _glvVBOPoints = null;

  const _shps = {};

  // private functions:
  function callbackTrack(detectState){
    // draw the video:
    draw_video();

    // draw the AR overlay:
    _gl.viewport(0, 0, _spec.canvasAR.width, _spec.canvasAR.height);
    _gl.clear(_gl.COLOR_BUFFER_BIT);
    if (detectState.isDetected){
      for (let i=0; i<_pointsCount; ++i){
        _points[2*i] = detectState.landmarks[i][0];
        _points[2*i + 1] = detectState.landmarks[i][1];
      }

      _gl.bindBuffer(_gl.ARRAY_BUFFER, _glvVBOPoints);
      _gl.bufferData(_gl.ARRAY_BUFFER, _points, _gl.DYNAMIC_DRAW);
      _gl.vertexAttribPointer(0, 2, _gl.FLOAT, false, 8, 0);

      _shapes.forEach(draw_shape);
    } 

    _gl.flush();
  }

  function init_gl(){
    _gl = _spec.canvasAR.getContext('webgl', {
      antialias: true,
      depth: false,
      alpha: true,
      stencil: false
    });
    _gl.enable(_gl.BLEND);
    _gl.clearColor(0, 0, 0, 0);
    _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
  }

  function init_kpVBO(lmLabels){
    _pointsCount = lmLabels.length;
    _points = new Float32Array(_pointsCount * 2);

    _glvVBOPoints = _gl.createBuffer ();
    _gl.bindBuffer(_gl.ARRAY_BUFFER, _glvVBOPoints);
    _gl.bufferData(_gl.ARRAY_BUFFER, _points, _gl.DYNAMIC_DRAW);
  }

  function compile_shader(gl, source, type, typeString) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert("ERROR IN " + typeString + " SHADER: " + gl.getShaderInfoLog(shader));
      console.log('Buggy shader source: \n', source);
      return false;
    }
    return shader;
  };

  // build the shader program:
  function build_shaderProgram(gl, shaderVertexSource, shaderFragmentSource, id) {
    // compile both shader separately:
    const GLSLprecision = 'precision lowp float;';
    const shaderVertex = compile_shader(gl, shaderVertexSource, gl.VERTEX_SHADER, "VERTEX " + id);
    const shaderFragment = compile_shader(gl, GLSLprecision + shaderFragmentSource, gl.FRAGMENT_SHADER, "FRAGMENT " + id);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, shaderVertex);
    gl.attachShader(shaderProgram, shaderFragment);

    // start the linking stage:
    gl.linkProgram(shaderProgram);
    const aPos = gl.getAttribLocation(shaderProgram, "position");
    gl.enableVertexAttribArray(aPos);

    return {
      program: shaderProgram,
      uniforms:{}
    };
  }

  // build shader programs:
  function init_shps(){
    // create video shp, used to display the video on the canvas:
    _shps.drawVideo = build_shaderProgram(_glv, 'attribute vec2 position;\n\
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
      'DRAW VIDEO');
  }

  function build_shape(shapeSpecs, shapeIndex){
    const n = shapeSpecs.tesselation.length / 3;

    // build shader program:
    const vertexShaderSource = 'attribute vec2 position;\n\
      void main(void){\n\
        gl_Position = vec4(position, 0., 1.);\n\
      }';
    const fragmentShaderSource = 'void main(void){\n\
      ' + shapeSpecs.GLSLFragmentSource + '\n\
    }';
    const shp = build_shaderProgram(_gl, vertexShaderSource, fragmentShaderSource, 'SHAPE_' + shapeIndex.toString());

    // build vbo:
    const glVBOFaces = _gl.createBuffer ();
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, glVBOFaces);
    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(shapeSpecs.tesselation), _gl.STATIC_DRAW);

    return {
      glVBOFaces: glVBOFaces,
      trianglesCount: n,
      shp: shp
    };
  }

  function draw_video(){
    _glv.viewport(0, 0, _spec.canvasVideo.width, _spec.canvasVideo.height);
    
    // use the head draw shader program and sync uniforms:
    _glv.useProgram(_shps.drawVideo.program);
    _glv.activeTexture(_glv.TEXTURE0);
    _glv.bindTexture(_glv.TEXTURE_2D, _glvVideoTexture);
    
    // draw the square looking for the head
    // the VBO filling the whole screen is still bound to the context
    // fill the viewPort
    _glv.drawElements(_glv.TRIANGLES, 3, _glv.UNSIGNED_SHORT, 0);

    _glv.flush();
  }

  function draw_shape(shape){
    _gl.useProgram(shape.shp.program);

    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, shape.glVBOFaces);
    _gl.drawElements(_gl.TRIANGLES, shape.trianglesCount * 3, _gl.UNSIGNED_SHORT, 0);
  }


  // public methods:
  return {
    init: function(spec){
      _spec = Object.assign({}, _defaultSpec, spec);

      init_gl();

      return new Promise(function(accept, reject){
        WEBARROCKSFACE.init({
          canvas: _spec.canvasVideo,
          NNCpath: _spec.NNCpath,
          callbackReady: function(err, objs){
            if (err){
              reject(err);
              return;
            }

            console.log('INFO in WebARRocksFaceShape2DHelper: WEBARROCKSFACE is initialized' )
            _glv = objs.GL;
            _glvVideoTexture = objs.videoTexture;

            init_shps();
            init_kpVBO(objs.landmarksLabels);
            _shapes = _spec.shapes.map(build_shape);

            accept();
          },

          callbackTrack: callbackTrack
        }); // end WEBARROCKSFACE.init call
      }); // end returned promise
    } //end init()
  } //end returned value
})(); 

// Export ES6 module:
try {
  module.exports = WebARRocksFaceShape2DHelper;
} catch(e){
  console.log('ES6 Module not exported');
}