/* eslint-disable */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  PointLight,
  PMREMGenerator,
  sRGBEncoding
} from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'


const WebARRocksFaceLightingHelper = (function(){
  const _defaultSpec = {
    envMap: null,
    
    // static lights:
    pointLightIntensity: 0.8,
    pointLightY: 200, // larger -> move the pointLight to the top
    hemiLightIntensity: 0.8,
  
    // light reconstruction:
    isLightReconstructionEnabled: false,
    lightReconstructionIntensityPow: 3,
    lightReconstructionAmbIntensityFactor: 30.0,
    lightReconstructionDirIntensityFactor: 30.0,
    lightReconstructionTotalIntensityMin: 0.1
  };
  const _threeLights = [];
  let _threeRenderer = null;


  const _lightReconstruction = {
    ambLight: null,
    dirLight: null
  };

  let _spec = null;


  function init_lightReconstructionLights(threeScene, spec){
    _lightReconstruction.ambLight = new AmbientLight( 0xffffff, 1.0 );
    add_light(threeScene, _lightReconstruction.ambLight);

    _lightReconstruction.dirLight = new DirectionalLight( 0xffffff, 1.0 );
     add_light(threeScene, _lightReconstruction.dirLight);
  }


  function init_staticLights(threeScene, spec){
    // simple lighting:
    //  We add a soft light. Should not be necessary if we use an envmap:
    if (spec.hemiLightIntensity > 0) {
      const hemiLight = new HemisphereLight( 0xffffff, 0x000000, spec.hemiLightIntensity );
      add_light(threeScene, hemiLight);
    }


    // add a pointLight to highlight specular lighting:
    if ( spec.pointLightIntensity > 0){
      const pointLight = new PointLight( 0xffffff, spec.pointLightIntensity );
      pointLight.position.set(0, spec.pointLightY, 0);
      add_light(threeScene, pointLight);
    }
  }


  function add_light(threeScene, light){
    threeScene.add(light);
    _threeLights.push(light);
  }


  const that = {
    switch_off: function(threeScene){
      _threeLights.forEach(function(threeLight){
        threeScene.remove(threeLight);
      })
      _threeLights.splice(0);
    },


    set(threeRenderer, threeScene, spec){
      if (threeRenderer === _threeRenderer){
        that.switch_off(threeScene);
      } else {
        that.set_rendererEncoding(threeRenderer);
        _threeRenderer = threeRenderer;
        _threeLights.splice(0);
      }
      that.add_lights(threeRenderer, threeScene, spec);
    },


    set_rendererEncoding(threeRenderer){
      threeRenderer.toneMapping = ACESFilmicToneMapping;
      threeRenderer.outputEncoding = sRGBEncoding;
    },


    update_lightReconstruction(detectStates){
      if (!_spec || !_spec.isLightReconstructionEnabled){
        return
      }

      // take the first detect state if multiface detection:
      const detectState = (detectStates.length) ? detectStates[0] : detectStates;

      if (!detectState.isDetected){
        return;
      }

      let ambIntensity = detectState.lAmb, dirIntensity = detectState.lDir;

      // minorate:
      const totalIntensity = ambIntensity + dirIntensity;
      if (totalIntensity < _spec.lightReconstructionTotalIntensityMin){
        s = _spec.lightReconstructionTotalIntensityMin / totalIntensity;
        ambIntensity *= s, dirIntensity *= s;
      }

      // apply pow:
      ambIntensity = Math.pow(ambIntensity, _spec.lightReconstructionIntensityPow);
      dirIntensity = Math.pow(dirIntensity, _spec.lightReconstructionIntensityPow);
      
      // apply light intensities:
      _lightReconstruction.ambLight.intensity = ambIntensity * _spec.lightReconstructionAmbIntensityFactor;
      _lightReconstruction.dirLight.intensity = dirIntensity * _spec.lightReconstructionDirIntensityFactor;

      /*console.log('ambIntensity=' + _lightReconstruction.ambLight.intensity.toFixed(4)
        + 'dirIntensity=' + _lightReconstruction.dirLight.intensity.toFixed(4)); //*/

      // set dir light direction:
      const theta = detectState.lTheta, phi = detectState.lPhi;
      const cTheta = Math.cos(theta), sTheta = Math.sin(theta);
      const cPhi = Math.cos(phi), sPhi = Math.sin(phi);
      _lightReconstruction.dirLight.position.set(sTheta*cPhi, cTheta*cPhi, sPhi);
    },


    add_lights: function(threeRenderer, threeScene, spec){
      _spec = Object.assign({}, _defaultSpec, spec);
      
      if (_spec.envMap){
        // image based lighting:
        const pmremGenerator = new PMREMGenerator( threeRenderer );
        pmremGenerator.compileEquirectangularShader();

        new RGBELoader().setDataType( HalfFloatType )
          .load(_spec.envMap, function ( texture ) {
          const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
          pmremGenerator.dispose();
          threeScene.environment = envMap;
        });
      } else if (!_spec.envMap ){
        threeScene.environment = null;
      }
      

      if (_spec.isLightReconstructionEnabled){
        init_lightReconstructionLights(threeScene, _spec);
      } else {
        init_staticLights(threeScene, _spec);
      }
    }
  } //end that
  return that;
})();

export default WebARRocksFaceLightingHelper; 
