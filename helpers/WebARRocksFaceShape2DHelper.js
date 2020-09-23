const WebARRocksFaceShape2DHelper = (function(){
  const _defaultSpec = {
    NNCpath: null,
    canvasVideo: null,
    canvasAR: null,
    shapes: [],
    stabilizationSettings: {
      LMDisplacementRange: [0, 3],
      LMmedianFilterLength: 5,              // Median filter window size
      LMmedianFilterSkip: 1,                 // Remove this number of value in median filter window size, then average the remaining values
      LMDisplacementRange: [0.7, 3],                // change LM position if displacement is larger than this value (relative). multiplied by 1/inputWidth
      qualityGoodDetectionThreshold: 0.7    // good detection considered if quality is above this value
    }
  };
  let _spec = null;
  let _shapes = null;

  let _videoElement = null, _videoElementPreviousTime = -1;
  let _gl = null, _glVideoTexture = null;  // gl context is for the AR canvas
  let _glv = null, _glvVideoTexture = null; // glv is for video and computation

  const _shps = {};


  // private functions:
  function callbackTrack(detectState){
    // draw the video:
    draw_video();

    // draw the AR overlay:
    _gl.viewport(0, 0, _spec.canvasAR.width, _spec.canvasAR.height);
    _gl.clear(_gl.COLOR_BUFFER_BIT);

    // draw shapes:
    // bind and update video texture if necessary
    if (_videoElement.isFakeVideo){ // WECHAT tweak:
      if (_videoElement.needsUpdate){
        update_glVideoTexture();
      }
    } else { // standard HTML5 video element:
      if (_videoElement.currenTime === _videoElementPreviousTime){
        _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);
      } else {
        update_glVideoTexture();
      }
    }

    // draw shapes:
    if (detectState.isDetected){
      _shapes.forEach(draw_shape.bind(null, detectState.landmarks));
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

  function create_glImageTexture(imageSrc){
    return new Promise(function(accept, reject){
      const img = new Image();
      img.onload = function(){
        const glTexture = _gl.createTexture();
        _gl.bindTexture(_gl.TEXTURE_2D, glTexture);
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
        _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.NEAREST_MIPMAP_LINEAR);
        _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, true);
        _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, img);        
        _gl.generateMipmap(_gl.TEXTURE_2D);
        _gl.bindTexture(_gl.TEXTURE_2D, null);
        _gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, false);
        accept(glTexture);
      }
      img.src = imageSrc;
    }); //end returned promise
  }


  function create_glVideoTexture(){
    const glTexture = _gl.createTexture();
    _gl.bindTexture(_gl.TEXTURE_2D, glTexture);
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR);
    _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE );
    _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE );
    update_glVideoTexture();    
    _gl.bindTexture(_gl.TEXTURE_2D, null);
    return glTexture;
  }


  function update_glVideoTexture(){
    _gl.bindTexture(_gl.TEXTURE_2D, _glVideoTexture);
    if (_videoElement.isFakeVideo) { // WECHAT tweak
      _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _videoElement.videoWidth, _videoElement.videoHeight, 0, _gl.RGBA, _gl.UNSIGNED_BYTE, _videoElement.arrayBuffer);
    } else {
      _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, _videoElement);
    }
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
      uniforms:{},
      attributes: {
        position: aPos
      }
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


  function build_shape(landmarkLabels, shapeSpecsArg, shapeIndex){
    const shapeSpecs = Object.assign({
      textures: []
    }, shapeSpecsArg);

    return new Promise(function(accept, reject){
      const n = shapeSpecs.tesselation.length / 3;
      const isIVals = ( shapeSpecs.iVals && shapeSpecs.iVals.length );

      // interpolated values (iVals):
      const iValsShaderSources = {
        vertexPars: "",
        vertex: "",
        fragmentPars: ""
      };
      let iValCCount = 0;
      if (isIVals){
        
        // get GLSL type of interpolated vals:
        iValCCount = shapeSpecs.iVals[0].length;
        const GLSLType = [
          "float", "vec2", "vec3", "vec4"
        ][iValCCount-1];

        iValsShaderSources.vertexPars = 'attribute ' + GLSLType + ' aiVal;\n';
        iValsShaderSources.vertexPars += 'varying ' + GLSLType + ' iVal;\n';
        iValsShaderSources.vertex = 'iVal = aiVal;\n';
        iValsShaderSources.fragmentPars += 'varying ' + GLSLType + ' iVal;\n';
      }

      // build textures:
      const texturesPromises = shapeSpecs.textures.map(function(textureSpec){
        return create_glImageTexture(textureSpec.src);
      });
      const texturesPromise = (texturesPromises.length === 0) ? Promise.resolve([]) : Promise.all(texturesPromises);

      // build shader program:
      const vertexShaderSource = 'attribute vec2 position;\n\
        varying vec2 vUV;\n\
        uniform mat2 videoUVScale;\n\
        ' + iValsShaderSources.vertexPars + '\n\
        void main(void){\n\
          gl_Position = vec4(position, 0., 1.);\n\
          vec2 uvCentered = videoUVScale * position;\n\
          vUV = 0.5 + vec2(1., -1.) * uvCentered;\n\
          ' + iValsShaderSources.vertex + '\n\
        }';
      const GLSLTextures = shapeSpecs.textures.map(function(textureSpec){
          return 'uniform sampler2D ' + textureSpec.id + ';';
        });
      const fragmentShaderSource = iValsShaderSources.fragmentPars + '\n'
        + GLSLTextures.join('\n')
        +'varying vec2 vUV;\n'
        +'uniform sampler2D samplerVideo;\n'
        + shapeSpecs.GLSLFragmentSource;
      const shp = build_shaderProgram(_gl, vertexShaderSource, fragmentShaderSource, 'SHAPE_' + shapeIndex.toString());    
      shp.attributes.position = _gl.getAttribLocation(shp.program, "position");    
      if (isIVals){
        shp.attributes.aiVal =  _gl.getAttribLocation(shp.program, "aiVal");      
      }
      shp.uniforms.samplerVideo = _gl.getUniformLocation(shp.program, "samplerVideo");
      shp.uniforms.videoUVScale = _gl.getUniformLocation(shp.program, "videoUVScale");
      shp.uniforms.texturesSamplers = shapeSpecs.textures.map(function(textureSpec){
        return _gl.getUniformLocation(shp.program, textureSpec.id);
      });

      // build interpolations:
      let interpolatedPoints = [];    
      let interpolatedPointsCount = 0;
      if (shapeSpecs.interpolations){
        // split between positive and negative ks and sort them:
        const interpolationsSplitted = split_interpolations(shapeSpecs.interpolations);

        // build interpolated points:
        let interpInd = 0;
        for (let i=0; i<interpolationsSplitted.length; ++i){
          const interpPoints = build_interpolation(shapeSpecs, interpolationsSplitted[i], interpInd);
          interpolatedPoints = interpolatedPoints.concat(interpPoints);
          interpInd += interpPoints.length;
        }
        interpolatedPointsCount = interpInd;      
      }

      // build points VBO:
      const pointsCount = shapeSpecs.points.length;
      const points = new Float32Array((pointsCount + interpolatedPointsCount) * 2);
      const glvVBOPoints = _gl.createBuffer ();

      // compute mapping between shapeSpecs.points and neural network landmarks:
      const mapPointIndexToNNLandmark = new Uint8Array(pointsCount);
      shapeSpecs.points.forEach(function(label, ind){
        const lmInd = landmarkLabels.indexOf(label);
        if (lmInd === -1){
          throw new Error('The neural network does not outputs this landmark' + label);
        }
        mapPointIndexToNNLandmark[ind] = lmInd;
      });

      // build faces VBO:
      const glVBOFaces = _gl.createBuffer();
      _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, glVBOFaces);
      _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(shapeSpecs.tesselation), _gl.STATIC_DRAW);

      // build interpolated vals VBO:
      let glVBOIVals = null;
      if (isIVals){
        const iValsFlatten = [].concat.apply([], shapeSpecs.iVals);
        glVBOIVals = _gl.createBuffer();
        _gl.bindBuffer(_gl.ARRAY_BUFFER, glVBOIVals);
        _gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(iValsFlatten), _gl.STATIC_DRAW);
      }

      texturesPromise.then(function(textures){
        accept({
          outlines: shapeSpecs.outlines ? shapeSpecs.outlines.map(build_outline) : [],
          interpolatedPoints: interpolatedPoints,
          frontFacing: (shapeSpecs.frontFacing) ? shapeSpecs.frontFacing : '',
          textures: textures,

          // points:
          pointsCount: pointsCount,
          interpolatedPointsCount: interpolatedPointsCount,
          points: points,
          glvVBOPoints: glvVBOPoints,

          // interpolated vals:
          iValCCount: iValCCount,
          glVBOIVals: glVBOIVals,
          glVBOFaces: glVBOFaces,

          mapPointIndexToNNLandmark: mapPointIndexToNNLandmark,
          trianglesCount: shapeSpecs.tesselation.length / 3,
          shp: shp
        });
      }); // end texturesPromise.then      
    }); //end returned promise
  }


  function build_outline(outlineSpecs){
    const pointsCount = outlineSpecs.points.length;
    
    // preallocate bisectors and side vectors::
    const bisectors = [], sides = [], points = [];
    for (let i = 0; i< pointsCount; ++i){
      bisectors.push([0, 0]);
      sides.push([0, 0]);
      points.push([0, 0]);
    }

    return {
      pointsCount: pointsCount,
      bisectors: bisectors,
      sides: sides,
      points: points,
      pointsInd: new Uint8Array(outlineSpecs.points),
      displacements: new Float32Array(outlineSpecs.displacements)
    }
  }


  function split_interpolations(interpolationSpecs){
    const outInterpolations = [];
    const sortByAbs = function(a, b){ // sort from smaller to larger in abs value
      return Math.abs(a) - Math.abs(b);
    };

    interpolationSpecs.forEach(function(interpolation){
      const ks = interpolation.ks;
      const ksPos = ks.filter(function(k){
        return ( k > 0 );
      }).sort(sortByAbs);
      const ksNeg = ks.filter(function(k){
        return ( k < 0 );
      }).sort(sortByAbs);
      if (ksPos.length > 0){
        outInterpolations.push(Object.assign({}, interpolation, {
          ks: ksPos
        }));
      }
      if (ksNeg.length > 0){
        outInterpolations.push(Object.assign({}, interpolation, {
          ks: ksNeg
        }));
      }
    });

    return outInterpolations;
  }


  function build_interpolation(shapeSpecs, interpolationSpecs, interpolationInd){
    // for each interpolation, we add a point in the points array
    // and we change the tesselation to include this point
    
    const firstInterpolatedPointInd = shapeSpecs.points.length + interpolationInd;
    const points = interpolationSpecs.points;
    const ks = interpolationSpecs.ks;

    // [pt0, pt1] is the edge to split in the tesselation (to insert the interpolated point):
    const pt0 = points[1];
    const pt1 = (ks[0] >= 0) ? points[2]: points[0];

    let iVal0 = null, iVal1 = null, iVals = null;
    if (shapeSpecs.iVals){
      iVals = shapeSpecs.iVals;
      iVal0 = iVals[points[1]];
      iVal1 = (ks[0] >= 0) ? iVals[points[2]]: iVals[points[0]];
    }

    // loop over face and split faces including [pt0, pt1] edge:
    const tess = shapeSpecs.tesselation;
    for (let i=0; i<tess.length; i+=3){
      const ptsFace = [tess[i], tess[i+1], tess[i+2]];
      if (ptsFace.indexOf(pt0) === -1 || ptsFace.indexOf(pt1) === -1){
        continue;
      }

      // the edge is included in the face
      // get the index of the third point, pt3:
      let pt3 = -1;
      if (ptsFace[0] !== pt0 && ptsFace[0] !== pt1){ // we split [1,2] edge
        pt3 = ptsFace[0];
      } else if (ptsFace[1] !== pt0 && ptsFace[1] !== pt1){ // we split [0,2] edge
        pt3 = ptsFace[1];
      } else  {
        pt3 = ptsFace[2]; // we split [0,1] edge
      }

      // get index in tess of pt1:
      const pt1TessInd = i + ptsFace.indexOf(pt1);
     
      // replace pt1 by the first interpolated point in the current face:
      tess[pt1TessInd] = firstInterpolatedPointInd;

      // loop over interpolated point, starting by the closer to pt0:
      for (let i=0; i<ks.length; ++i){        
        // Add a new face: pt3, I, (nextI|pt1) as a new face:
        const nextPt = (i === ks.length - 1) ? pt1 : (firstInterpolatedPointInd + i + 1);
        if (ks[i] > 0){ // keep face indexing order for backface culling:
          tess.push(firstInterpolatedPointInd + i, pt3, nextPt);
        } else {
          tess.push(firstInterpolatedPointInd + i, nextPt, pt3);
        }
      }  
    }

    const interpolatedPoints = [];
    for (let i=0; i<ks.length; ++i){

      // create interpolated point:
      const interpolatedPointInd = shapeSpecs.points.length + interpolationInd + i;
      interpolatedPoints.push(
        Object.assign({
          ind: interpolatedPointInd,
          m0: [1, 0],
          m1: [1, 0],
          k: ks[i]
        }, interpolationSpecs)
      );

       // add new iVals:
      if (shapeSpecs.iVals){      
        // loop over iVal0 components:
        const iValInterpolated = iVal0.map(function(v0, vInd){
          const v1 = iVal1[vInd];
          const kAbs = Math.abs(ks[i]);
          return v0 * (1-kAbs) + v1 * kAbs;
        });

        iVals.push(iValInterpolated);
      }

    } // end loop on interpolated points:
   
    return interpolatedPoints;
  } //end build_interpolation()


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


  function draw_shape(landmarksPositions, shape){
    _gl.useProgram(shape.shp.program);

    // send video UVScale:
    _gl.uniformMatrix2fv(shape.shp.uniforms.videoUVScale, false, WEBARROCKSFACE.get_videoUVScaleMat2());

    // extract positions:
    for (let i=0; i<shape.pointsCount; ++i){
      const lmInd = shape.mapPointIndexToNNLandmark[i];
      shape.points[2*i] = landmarksPositions[lmInd][0];
      shape.points[2*i + 1] = landmarksPositions[lmInd][1];
    }

    // compute displacements using outlines:
    shape.outlines.forEach(apply_outline.bind(null, shape.points));
    
    // compute interpolated points:
    shape.interpolatedPoints.forEach(compute_interpolation.bind(null, shape.points));

    // send positions to GPU;
    _gl.bindBuffer(_gl.ARRAY_BUFFER, shape.glvVBOPoints);
    _gl.bufferData(_gl.ARRAY_BUFFER, shape.points, _gl.DYNAMIC_DRAW);
    _gl.vertexAttribPointer(shape.shp.attributes.position, 2, _gl.FLOAT, false, 8, 0);

    // interpolated values:
    if (shape.glVBOIVals){
      _gl.enableVertexAttribArray(shape.shp.attributes.aiVal);
      _gl.bindBuffer(_gl.ARRAY_BUFFER, shape.glVBOIVals);
      _gl.vertexAttribPointer(shape.shp.attributes.aiVal, shape.iValCCount, _gl.FLOAT, false, 4*shape.iValCCount, 0) ;
    }

    // set culling:
    if (shape.frontFacing){
      _gl.enable(_gl.CULL_FACE);  
      _gl.cullFace(_gl.BACK);
      _gl.frontFace((shape.frontFacing === 'CW') ? _gl.CW : _gl.CCW);
    }

    // bind textures:
    shape.textures.forEach(function(glTexture, ind){
      _gl.uniform1i(shape.shp.uniforms.texturesSamplers[ind], ind+1);
      _gl.activeTexture([_gl.TEXTURE1, _gl.TEXTURE2, _gl.TEXTURE3, _gl.TEXTURE4][ind]);
      _gl.bindTexture(_gl.TEXTURE_2D, glTexture);
    });

    // draw faces:
    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, shape.glVBOFaces);
    _gl.drawElements(_gl.TRIANGLES, shape.trianglesCount * 3, _gl.UNSIGNED_SHORT, 0);


    if (shape.glVBOIVals){
      _gl.disableVertexAttribArray(shape.shp.attributes.aiVal);
    }

    // restore state:
    if (shape.frontFacing){
      _gl.disable(_gl.CULL_FACE);   
    }
    _gl.activeTexture(_gl.TEXTURE0);
  }


  // PiP from http://www.eecs.umich.edu/courses/eecs380/HANDOUTS/PROJ2/InsidePoly.html
  function is_pointInPolygon(p, polygon){
    let counter = 0;
    let p1 = polygon[0];
    const N = polygon.length;

    for (let i=1;i<=N;i++) {
      const p2 = polygon[i % N];
      if (p[1] > Math.min(p1[1], p2[1])) {
        if (p[1] <= Math.max(p1[1], p2[1])) {
          if (p[0] <= Math.max(p1[0], p2[0])) {
            if (p1[1] !== p2[1]) {
              xinters = (p[1]-p1[1]) * (p2[0]-p1[0]) / (p2[1]-p1[1]) + p1[0];
              if (p1.x === p2[0] || p[0] <= xinters)
                ++counter;
            }
          }
        }
      }
      p1 = p2;
    }

    return (counter % 2 !== 0);
  }


  // apply outline displacement to pointPositions:
  function apply_outline(pointPositions, outline){ 
    // compute pixel points position:
    const w = _spec.canvasAR.width, h = _spec.canvasAR.height;
    for (let i=0; i<outline.pointsCount; ++i){
      const ip = outline.pointsInd[i];
      const point = outline.points[i];
      point[0] = w * pointPositions[2 * ip];
      point[1] = h * pointPositions[2 * ip + 1];
    }

    // compute side vectors and perimeter:
    let perimeter = 0;
    for (let i=0; i<outline.pointsCount; ++i){      
      const j = (i + 1) % outline.pointsCount; // next outline point indice
      
      const dx = outline.points[j][0] - outline.points[i][0];
      const dy = outline.points[j][1] - outline.points[i][1];

      // size of the side;
      const l = Math.sqrt(dx*dx + dy*dy);
      perimeter += l;

      outline.sides[i][0] = dx / l;
      outline.sides[i][1] = dy / l;
    }
    
    // compute bisectors:
    for (let i=0; i<outline.pointsCount; ++i){
      const thisToNext = outline.sides[i];
      const prevToThis = outline.sides[(i === 0) ? outline.pointsCount-1 : i-1];

      let bx = -thisToNext[0] + prevToThis[0];
      let by = -thisToNext[1] + prevToThis[1];
      const bl = Math.sqrt(bx*bx + by*by);
      bx /= bl, by /= bl;

      const bisector = outline.bisectors[i];
      bisector[0] = bx;
      bisector[1] = by;
    }

    // force bisectors to point outward:
    for (let i=0; i<outline.pointsCount; ++i){
      const point = outline.points[i];
      const bisector = outline.bisectors[i];

      // q is a point such that q = point + epsilon * bisector
      const qx = point[0] + 1e-6 * bisector[0];
      const qy = point[1] + 1e-6 * bisector[1];

      // if the point is inside the contour, we invert the bisector:
      if (is_pointInPolygon([qx, qy], outline.points)){
        bisector[0] *= -1;
        bisector[1] *= -1;
      }      
    }
    
    // apply displacements along bisectors:
    for (let i=0; i<outline.pointsCount; ++i){
      const amplitude = outline.displacements[i] * perimeter;
      const bisector = outline.bisectors[i];

      // compute displacement in the viewport:
      const dx = amplitude * bisector[0] / w;
      const dy = amplitude * bisector[1] / h;

      // apply displacement:
      const pi = outline.pointsInd[i];
      pointPositions[2*pi] += dx;
      pointPositions[2*pi + 1] += dy;
    }
  } // end apply_outline()


  function compute_interpolation(pointPositions, interpolation){
    const pt0Ind = interpolation.points[1];
    const otherPointInd = (interpolation.k >= 0 ) ? 2 : 0;
    const pt1Ind = interpolation.points[otherPointInd];

    const p0x = pointPositions[ pt0Ind * 2 ];
    const p0y = pointPositions[ pt0Ind * 2 + 1];

    // compute tangent vectors
    // m0 and m1 are tangent vectors associated to p0 and p1    
    const m0 = interpolation.m0, m1 = interpolation.m1;
    m0[0] = pointPositions[2*interpolation.points[2]] - pointPositions[2*interpolation.points[0]];
    m0[1] = pointPositions[2*interpolation.points[2]+1] - pointPositions[2*interpolation.points[0]+1];
    
    m1[0] = pointPositions[2*pt1Ind] - pointPositions[2*pt0Ind];
    m1[1] = pointPositions[2*pt1Ind+1] - pointPositions[2*pt0Ind+1];
   

    // normalize m0 and m1:
    const l0 = Math.sqrt(m0[0]*m0[0] + m0[1]*m0[1]);
    const l1 = Math.sqrt(m1[0]*m1[0] + m1[1]*m1[1]);    
    if (l0 === 0 || l1 === 0){
      pointPositions[interpolation.ind * 2] = p0x;
      pointPositions[interpolation.ind * 2 + 1] = p0y;
      return;
    }

    const sizeRef = l1;
    const s0 = Math.sign(interpolation.k) * sizeRef*interpolation.tangentInfluences[1] / l0;
    const s1 = sizeRef*interpolation.tangentInfluences[otherPointInd] / l1;
    m0[0] *= s0, m0[1] *= s0;
    m1[0] *= s1, m1[1] *= s1;

    // compute cubic Hermite interpolation
    // cf book Real-time rendering - 4th edition - page 729
    const t = Math.abs(interpolation.k);
    const tt = t * t;
    const ttt = tt * t;

    const p1x = pointPositions[ pt1Ind * 2 ];
    const p1y = pointPositions[ pt1Ind * 2 + 1 ];
    const m0x = m0[0], m0y = m0[1];
    const m1x = m1[0], m1y = m1[1];

    // compute Hermite coefficients:
    const p0k = 2*ttt - 3*tt + 1;
    const m0k = ttt - 2*tt + t;
    const m1k = ttt - tt;
    const p1k = -2*ttt + 3*tt;

    // do Hermite interpolation:
    pointPositions[interpolation.ind * 2] = p0k*p0x + m0k*m0x + m1k*m1x + p1k*p1x;
    pointPositions[interpolation.ind * 2 + 1] = p0k*p0y + m0k*m0y + m1k*m1y + p1k*p1y;

    //pointPositions[interpolation.ind * 2] = p0x * 0.5 + p1x * 0.5;
    //pointPositions[interpolation.ind * 2 + 1] = 0 ;
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
          scanSettings: {
            'threshold': 0.7,  // absolute treshold for positive face detection
            'dThreshold': 0.9
          },
          stabilizationSettings: _spec.stabilizationSettings,
          callbackReady: function(err, objs){
            if (err){
              reject(err);
              return;
            }

            console.log('INFO in WebARRocksFaceShape2DHelper: WEBARROCKSFACE is initialized' )
            _glv = objs.GL;
            _glvVideoTexture = objs.videoTexture;

            _videoElement = objs.video;
            _glVideoTexture = create_glVideoTexture();

            init_shps();
            Promise.all(_spec.shapes.map(build_shape.bind(null, objs.landmarksLabels))).then(function(shapes){
              _shapes = shapes;
              accept();
            });
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