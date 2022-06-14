/* eslint-disable */

import {
  Vector2
} from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import WEBARROCKSFACE from '../dist/WebARRocksFace.module.js';

import WebARRocksFaceThreeHelper from './WebARRocksFaceThreeHelper.js';
import WebARRocksFaceLightingHelper from './WebARRocksFaceLightingHelper.js';


const WebARRocksMirror = (function(){
  // private variables:
  const _defaultSpec = { // default init specs
    canvasFace: null,
    canvasThree: null,

    maxFacesDetected: 1,

    landmarksStabilizerSpec: {},

    scanSettings: null,

    // light reconstruction:
    isLightReconstructionEnabled: false,
    lightReconstructionIntensityPow: 3,
    lightReconstructionAmbIntensityFactor: 30.0,
    lightReconstructionDirIntensityFactor: 30.0,
    lightReconstructionTotalIntensityMin: 0.1,

    // add constratins for the rotation:
    rotationContraints: null,

    NN: null
  };
  let _spec = null;
  
  const _states = {
    error: -3,
    notLoaded: -1,
    loading: -2,
    idle: 0,
    pause: 1
  };
  let _state = _states.notLoaded;
  const _d2r = Math.PI / 180; // to convert degrees to radians



  // private functions:
  function insert_GLSLAfter(GLSLSource, GLSLSearched, GLSLInserted){
    return GLSLSource.replace(GLSLSearched, GLSLSearched + '\n' + GLSLInserted);
  }
 

  function tweak_material(threeMat, glassesBranchesSpec){

    const newMat = threeMat.clone();
    newMat.fog = false;
    
    newMat.onBeforeCompile = function(shaders){

      let vertexShaderSource = shaders.vertexShader;
      let fragmentShaderSource = shaders.fragmentShader;

      if (glassesBranchesSpec){
        const glassesBranchUniforms = {
          uBranchFading: {value: new Vector2(glassesBranchesSpec.fadingZ, glassesBranchesSpec.fadingTransition)}, // first value: position (lower -> to the back), second: transition brutality
          uBranchBendingAngle: {value: glassesBranchesSpec.bendingAngle * _d2r},
          uBranchBendingZ: {value: glassesBranchesSpec.bendingZ}
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


  // public functions:
  const that = {
    init: function(spec){
      return new Promise(function(resolve, reject){

        if (_state !== _states.notLoaded){
          reject('ALREADY_INITIALIZED');
          return;
        }
        
        _state = _states.loading;
        _spec = Object.assign({}, _defaultSpec, spec);
        
        // Init WebAR.rocks.face through the helper:
        const threeHelperSpec = {
          NN: _spec.NN,
          canvas: _spec.canvasFace,
          maxFacesDetected: _spec.maxFacesDetected,

          rotationContraints: _spec.rotationContraints,

          scanSettings: _spec.scanSettings,

          callbackReady: function(err, threeInstances){
            if (err){
              reject(err);
              _state = _states.error;
              return;
            }
            _state = _states.idle;
            resolve();
          },
          callbackTrack: function(detectState){
            WebARRocksFaceLightingHelper.update_lightReconstruction(detectState);
          }
        };
        if (spec.solvePnPObjPointsPositions){
          threeHelperSpec.solvePnPObjPointsPositions = spec.solvePnPObjPointsPositions;
        }
        if (spec.solvePnPImgPointsLabels){
          threeHelperSpec.solvePnPImgPointsLabels = spec.solvePnPImgPointsLabels;
        }
        WebARRocksFaceThreeHelper.init(WEBARROCKSFACE, threeHelperSpec, _spec.landmarksStabilizerSpec);
      }); //end returned promise
    }, //end init()


    create_occluderMesh: function(occluder, isDebug){
      return WebARRocksFaceThreeHelper.create_occluderMesh(occluder, isDebug);
    },


    set_lighting(threeRenderer, threeScene, spec){
      WebARRocksFaceLightingHelper.set(threeRenderer, threeScene, spec);
    },


    set_glassesPose(threeGlasses){
      // the width of the head in the glasses 3D model is 2
      // and the width of the face in dev/face.obj is 154
      // so we need to scale the 3D model to 154/2 = 70
      threeGlasses.scale.multiplyScalar(82); //77

      // the origin of the glasses 3D model is the point supporting the glasses
      // (on the base of the nose)
      // its position in dev/face.obj is [0, 47, 53]
      // move a bit up (+Y)
      threeGlasses.position.set(0, 47+2, 53);

      // in dev/face.obj the face is looking upward,
      // whereas in the glasses model the branches are parallel to the ground
      // so we need to rotate the glasses 3D model to look upward
      threeGlasses.rotation.set(-0.38, 0, 0); // X neg -> rotate branches down
    },


    tweak_materials: function(threeObject3D, glassesBranchesSpec){
      threeObject3D.traverse(function(threeStuff){
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

        let isGlassesBranch = (glassesBranchesSpec) ? true : false;
        isGlassesBranch = isGlassesBranch && mat.name && ( mat.name.indexOf('frame') !== -1 );

        // Tweak material:
        threeStuff.material = tweak_material(threeStuff.material, (isGlassesBranch) ? glassesBranchesSpec : null);
      }); //end traverse objects with material
    },


    set_faceFollower: function(faceFollowerParent, faceFollower, faceIndex){
      
      // correct a stupid bug with some GLB models:
      faceFollower.traverse(function(threeStuff){
        if (!threeStuff.isMesh) return;
        threeStuff.material.depthWrite = true;
      });

      WebARRocksFaceThreeHelper.set_faceFollower(faceFollowerParent, faceFollower, faceIndex);
    },


    clean: function(){
      WebARRocksFaceThreeHelper.clean();
    },


    update: function(sizing, threeCamera){
      WebARRocksFaceThreeHelper.update_threeCamera(sizing, threeCamera);
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


    capture_image: function(threeCanvas){
      if (_state !== _states.pause && _state !== _states.idle){
        return Promise.reject();
      }

      return new Promise(function(accept, reject){

        // background image (video):
        const cvBg = WEBARROCKSFACE.capture_image(true);
        const width = cvBg.width, height = cvBg.height;

        // foreground image (3D rendering):
        const cvFg = threeCanvas;

        // flip horizontally:
        const cv = document.createElement('canvas');
        cv.width = width, cv.height = height;
        const ctx = cv.getContext('2d');
        ctx.translate(width, 0);
        ctx.scale(-1, 1);

        ctx.drawImage(cvBg, 0, 0);
        ctx.drawImage(cvFg, 0, 0);

        accept(cv);

      }); //end returned promise
    },


    resize: function(){
      WebARRocksFaceThreeHelper.resize();      
    },


    destroy: function(){
      return new Promise(function(accept, reject){
        WEBARROCKSFACE.destroy().finally(function(){
          _state = _states.notLoaded;
          accept();
        });
      });
    }
  }; //end that
  return that;
})();

export default WebARRocksMirror;