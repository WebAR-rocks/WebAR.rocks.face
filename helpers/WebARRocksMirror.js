"use strict";


const WebARRocksMirror = (function(){
  // private variables:
  const _defaultSpec = { // default init specs
    canvasFace: null,
    canvasThree: null,

    videoURL: null, // use a video file instead of camera video

    // initial dimensions:
    width: window.innerWidth,
    height: window.innerHeight,

    specWebARRocksFace: {
      NNCPath: '../../neuralNets/NN_GLASSES_3.json',
      scanSettings: { // harden detection:
        threshold: 0.9
      }
      //,maxFacesDetected: 2 // Experimental: add glasses on multiple detected faces
    },

    isGlasses: true,
    modelURL: null, // initial 3D model
    occluderURL: null, // occluder
    envmapURL: null,

    // lighting:
    pointLightIntensity: 0.8,
    pointLightY: 200, // larger -> move the pointLight to the top
    hemiLightIntensity: 0.8,

    // bloom:
    bloom: null,

    // temporal anti aliasing. Number of samples. 0 -> disabled:
    taaLevel: 0,

    // branch fading and bending:
    branchFadingZ: -0.9, // where to start branch fading. - -> to the back
    branchFadingTransition: 0.6, // 0 -> hard transition
    branchBendingAngle: 5, // in degrees. 0 -> no bending
    branchBendingZ: 0, // start brench bending at this position. - -> to the back

    resizeDelay: 50, // in milliseconds, min delay between 2 canvas resizing

    debugOccluder: false
  };
  const _threeInstances = {
    glasses: new THREE.Object3D(),
    envMap: null,
    loadingManager: null
  };
  let _spec = null, _WARFObjects = null;

  const _states = {
    error: -3,
    notLoaded: -1,
    loading: -2,
    idle: 0,
    pause: 1
  };
  let _state = _states.notLoaded;
  const _d2r = Math.PI / 180; // to convert degrees to radians

  let _timerResize = null;

  // private functions:
  function insert_GLSLAfter(GLSLSource, GLSLSearched, GLSLInserted){
    return GLSLSource.replace(GLSLSearched, GLSLSearched + '\n' + GLSLInserted);
  }
 
  function tweak_material(threeMat, isGlassesBranch){

    const newMat = threeMat.clone();
    newMat.fog = false;
    
    newMat.onBeforeCompile = function(shaders){

      let vertexShaderSource = shaders.vertexShader;
      let fragmentShaderSource = shaders.fragmentShader;

      if (isGlassesBranch){
        const glassesBranchUniforms = {
          uBranchFading: {value: new THREE.Vector2(_spec.branchFadingZ, _spec.branchFadingTransition)}, // first value: position (lower -> to the back), second: transition brutality
          uBranchBendingAngle: {value: _spec.branchBendingAngle * _d2r},
          uBranchBendingZ: {value: _spec.branchBendingZ}
        };
        Object.assign(shaders.uniforms, glassesBranchUniforms);

        // tweak vertex shader to bend the branches:
        vertexShaderSource = "uniform float uBranchBendingAngle, uBranchBendingZ;\n" + vertexShaderSource;
        let GLSLBendBranch = 'float zBranch = max(0.0, uBranchBendingZ-position.z);\n';
        GLSLBendBranch += 'float bendBranchDx = tan(uBranchBendingAngle) * zBranch;\n';
        GLSLBendBranch += 'transformed.x += sign(transformed.x) * bendBranchDx;\n';
        GLSLBendBranch += 'transformed.z *= (1.0 - bendBranchDx);\n';
        vertexShaderSource = insert_GLSLAfter(vertexShaderSource, '#include <begin_vertex>', GLSLBendBranch);

        // tweak vertex shader to give the Z of the current point. It will be used for branch fading:
        vertexShaderSource = "varying float vPosZ;\n" + vertexShaderSource;
        vertexShaderSource = insert_GLSLAfter(vertexShaderSource, '#include <fog_vertex>', 'vPosZ = position.z;');

        // tweak fragment shader to apply transparency at the end of the branches:
        fragmentShaderSource = "uniform vec2 uBranchFading;\n varying float vPosZ;\n" + fragmentShaderSource;
        const GLSLcomputeAlpha = 'gl_FragColor *= smoothstep(uBranchFading.x - uBranchFading.y * 0.5, uBranchFading.x + uBranchFading.y * 0.5, vPosZ);'
        fragmentShaderSource = insert_GLSLAfter(fragmentShaderSource, '#include <dithering_fragment>', GLSLcomputeAlpha);
      }

      shaders.vertexShader = vertexShaderSource;
      shaders.fragmentShader = fragmentShaderSource;
    } // end newMat.onBeforeCompile

    return newMat;
  } //end tweak_material()


  function tweak_glassesModel(threeGlasses){
    if (_spec.isGlasses){
      // the width of the head in the glasses 3D model is 2
      // and the width of the face in dev/face.obj is 154
      // so we need to scale the 3D model to 154/2 = 70
      threeGlasses.scale.multiplyScalar(85);

      // the origin of the glasses 3D model is the point supporting the glasses
      // (on the base of the nose)
      // its position in dev/face.obj is [0, 47, 53]
      // move a bit up (+Y)
      threeGlasses.position.set(0, 47+2, 53);

      // in dev/face.obj the face is looking upward,
      // whereas in the glasses model the branches are parallel to the ground
      // so we need to rotate the glasses 3D model to look upward
      threeGlasses.rotation.set(-0.38,0,0); //X neg -> rotate branches down
    }

    // Tweak materials:
    threeGlasses.traverse(function(threeStuff){
      if (!threeStuff.material){
        return;
      }
      let mat = threeStuff.material;

      // take account of Blender custom properties added to materials
      // and exported to GLTF/GLB by checking the "Export extras" exporter option
      // the roughness for example can be exported using this:
      if (mat.userData){
        const threeJsCustomProperties = mat.userData;
        for (let key in threeJsCustomProperties){
          mat[key] = threeJsCustomProperties[key];
        }
      }

      let isGlassesBranch = _spec.isGlasses;
      isGlassesBranch = isGlassesBranch && mat.name && ( mat.name.indexOf('frame') !== -1 );

      // Tweak material:
      threeStuff.material = tweak_material(threeStuff.material, isGlassesBranch);
    }); //end traverse objects with material
  }
  
  function load_glasses(modelURL, callback){
    if (!modelURL){
      remove_glasses();
      if (callback) callback(null);
      return;
    }

    new THREE.GLTFLoader(_threeInstances.loadingManager).load(modelURL, function(model){
      const scene = model.scene;
      const threeGlasses = new THREE.Object3D();

      const sceneObjects = scene.children.slice(0);
      sceneObjects.forEach(function(child){
        if (child.type === 'Object3D' || child.type === 'Mesh'){
          threeGlasses.add(child);
        }
      });

      tweak_glassesModel(threeGlasses);
      
      // remove previous model:
      remove_glasses();

      // add new model to face follower object:
      _threeInstances.glasses = threeGlasses;
      if (_WARFObjects.threeFaceFollowers){
        _WARFObjects.threeFaceFollowers.forEach(function(threeFaceFollower){
          threeFaceFollower.add(threeGlasses.clone());
        });
      }

      if (callback){
        callback(threeGlasses);
      }
    }); // end GLTFLoader callback
  } //end load_glasses()

  function remove_glasses(){
    // remove previous model:
    if (_WARFObjects.threeFaceFollowers && _threeInstances.glasses){
      _WARFObjects.threeFaceFollowers.forEach(function(threeFaceFollower){
        if (threeFaceFollower.children.length){
          for (let i = threeFaceFollower.children.length-1; i >= 0; --i){
            const child = threeFaceFollower.children[i];
            if (child.userData.isOccluder) continue;
            threeFaceFollower.remove(child);
          }
        }
      });
      _threeInstances.glasses = null;
    }
  }

  function build_scene(){
    const renderer = _WARFObjects.threeRenderer; // instance of THREE.WebGLRenderer
    const scene = _WARFObjects.threeScene; // instance of THREE.Scene
    const composer = _WARFObjects.threeComposer;

    // improve WebGLRenderer settings:
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputEncoding = THREE.sRGBEncoding;

    // load envmap if necessary:
    if (_spec.envmapURL){ // see https://github.com/mrdoob/three.js/blob/master/examples/webgl_loader_gltf.html
      const pmremGenerator = new THREE.PMREMGenerator( renderer );
      pmremGenerator.compileEquirectangularShader();

      new THREE.RGBELoader(_threeInstances.loadingManager).setDataType( THREE.UnsignedByteType )
        .load(_spec.envmapURL, function ( texture ) {
        _threeInstances.envMap = pmremGenerator.fromEquirectangular( texture ).texture;
        pmremGenerator.dispose();
        scene.environment = _threeInstances.envMap;
      });
    }

    //  We add a soft light. Should not be necessary if we use an envmap:
    if (_spec.hemiLightIntensity > 0) {
      const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x000000, _spec.hemiLightIntensity );
      scene.add(hemiLight);
    }

    // add a pointLight to highlight specular lighting:
    if ( _spec.pointLightIntensity > 0){
      const pointLight = new THREE.PointLight( 0xffffff, _spec.pointLightIntensity );
      pointLight.position.set(0, _spec.pointLightY, 0);
      scene.add(pointLight);
    }

    // load occluder:
    if (_spec.occluderURL){
      WebARRocksFaceThreeHelper.add_occluderFromFile(_spec.occluderURL, null, _threeInstances.loadingManager, _spec.debugOccluder);
    }

    // load glasses:
    if (_spec.modelURL){
      load_glasses(_spec.modelURL, null);
    }

    // bloom:
    if (_spec.bloom){ // see https://threejs.org/examples/#webgl_postprocessing_unreal_bloom

      // create the bloom postprocessing pass:
      const bloomPass = new THREE.UnrealBloomPass( new THREE.Vector2( _spec.canvasThree.width, _spec.canvasThree.height ),
         _spec.bloom.strength,
         _spec.bloom.radius,
        _spec.bloom.threshold);

      composer.addPass( bloomPass );
    }

    // callback function:
    _threeInstances.loadingManager.onLoad = function(){
      console.log('INFO in WebARRocksMirror: everything has been loaded');
      if (_spec.callback){
        _spec.callback(_threeInstances);
      }
    }
  } //end build_scene()
 

  // public functions:
  const that = {
    init: function(spec){
      return new Promise(function(resolve, reject){

        if (_state !== _states.notLoaded){
          reject('ALREADY_INITIALIZED');
          return;
        }
        if (!THREE){
          reject('NO_THREE');
          return;
        }
        _state = _states.loading;
        _spec = Object.assign({}, _defaultSpec, spec);
        _threeInstances.loadingManager = new THREE.LoadingManager();

        // Size the canvas:
        let w = _spec.width, h = _spec.height;
        if (window.devicePixelRatio){
          w *= window.devicePixelRatio;
          h *= window.devicePixelRatio;
        }
        _spec.canvasFace.width = w;
        _spec.canvasFace.height = h;
        _spec.canvasThree.width = w;
        _spec.canvasThree.height = h;


        // Init WebAR.rocks.face through the helper:
        const webARRocksSpec = {
          spec: _spec.specWebARRocksFace,
          canvas: _spec.canvasFace,
          canvasThree: _spec.canvasThree,
          videoURL: _spec.videoURL,
          
          isPostProcessing: (_spec.bloom) ? true : false,
          taaLevel: _spec.taaLevel,

          callbackReady: function(err, threeInstances){
            if (err){
              reject(err);
              _state = _states.error;
              return;
            }
            _WARFObjects = threeInstances;
            build_scene();
            _state = _states.idle;
            resolve();
          }
        };
        if (spec.solvePnPObjPointsPositions){
          webARRocksSpec.solvePnPObjPointsPositions = spec.solvePnPObjPointsPositions;
        }
        if (spec.solvePnPImgPointsLabels){
          webARRocksSpec.solvePnPImgPointsLabels = spec.solvePnPImgPointsLabels;
        }
        WebARRocksFaceThreeHelper.init(webARRocksSpec);
      }); //end returned promise
    }, //end init()

    load: function(modelURL, callback){
      load_glasses(modelURL, callback);
    },

    pause: function(isStopVideoStream){
      if (_state !== _states.idle){
        return false;
      }
      WEBARROCKSFACE.toggle_pause(true, isStopVideoStream);
      _state = _states.pause;
      return true;
    },

    resume: function(isStopVideoStream){
      if (_state !== _states.pause){
        return false;
      }
      WEBARROCKSFACE.toggle_pause(false, isStopVideoStream);
      _state = _states.idle;
      return true;
    },

    capture_image: function(callback){
      if (_state !== _states.pause && _state !== _states.idle){
        return false;
      }
      // background image (video):
      const cvBg = WEBARROCKSFACE.capture_image(true);
      const width = cvBg.width, height = cvBg.height;

      // foreground image (3D rendering):
      const cvFg = _WARFObjects.threeRenderer.domElement;

      // flip horizontally:
      const cv = document.createElement('canvas');
      cv.width = width, cv.height = height;
      const ctx = cv.getContext('2d');
      ctx.translate(width, 0);
      ctx.scale(-1, 1);

      ctx.drawImage(cvBg, 0, 0);
      ctx.drawImage(cvFg, 0, 0);

      callback(cv);
    },

    resize: function(width, height){
      if (_state !== _states.pause && _state !== _states.idle){
        return false;
      }
      // We need to avoid to resize too often
      // So we put a timer
      if (_timerResize !== null){
        window.clearTimeout(_timerResize);
      }

      _timerResize = setTimeout(function(){
        const s = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        WebARRocksFaceThreeHelper.resize(width * s, height * s);
        _timerResize = null;
      }, _spec.resizeDelay);
      return true;
    },

    destroy: function(){
      return new Promise(function(accept, reject){
        WEBARROCKSFACE.destroy().finally(function(){
          _state = _states.notLoaded;
          if (_WARFObjects.threeRenderer){
            _WARFObjects.threeRenderer = null;
          }
          accept();
        });
      });
    }
  }; //end that
  return that;
})();
