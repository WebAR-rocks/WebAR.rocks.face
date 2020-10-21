/* eslint-disable */

import * as THREE from 'three'
import { RGBELoader } from '../../three/v119/RGBELoader.js'


const WebARRocksFaceLightingHelper = (function(){
  const _defaultSpec = {
    envMap: null,
    pointLightIntensity: 0.8,
    pointLightY: 200, // larger -> move the pointLight to the top
    hemiLightIntensity: 0.8
  };
  const _threeLights = [];
  let _threeRenderer = null;

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
      threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      threeRenderer.outputEncoding = THREE.sRGBEncoding;
    },

    add_lights: function(threeRenderer, threeScene, spec){
      const newSpec = Object.assign({}, _defaultSpec, spec);
      
      if (newSpec.envMap){
        // image based lighting:
        const pmremGenerator = new THREE.PMREMGenerator( threeRenderer );
        pmremGenerator.compileEquirectangularShader();

        new RGBELoader().setDataType( THREE.UnsignedByteType )
          .load(newSpec.envMap, function ( texture ) {
          const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
          pmremGenerator.dispose();
          threeScene.environment = envMap;
        });
      } else if (!newSpec.envMap ){
        threeScene.environment = null;
      }
      
      // simple lighting:
      //  We add a soft light. Should not be necessary if we use an envmap:
      if (newSpec.hemiLightIntensity > 0) {
        const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x000000, newSpec.hemiLightIntensity );
        threeScene.add(hemiLight);
        _threeLights.push(hemiLight);
      }

      // add a pointLight to highlight specular lighting:
      if ( newSpec.pointLightIntensity > 0){
        const pointLight = new THREE.PointLight( 0xffffff, newSpec.pointLightIntensity );
        pointLight.position.set(0, newSpec.pointLightY, 0);
        threeScene.add(pointLight);
        _threeLights.push(pointLight);
      }
    }
  } //end that
  return that;
})();

export default WebARRocksFaceLightingHelper; 
