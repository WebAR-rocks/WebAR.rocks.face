/**
 * A simple stabilizer based on distance of movement between delta time, 
 * if it's a small move, it tends to be jitter, otherwise it's probably a real move
 */
const WebARRocksLMStabilizer = (function(){
  function allocate_pointsList(n){
    const r = new Array(n);
    for (let i=0; i<n; ++i){
      r[i] = [0, 0];
    }
    return r;
  }
  
  function copy_vec2(src, dst){
    dst[0] = src[0], dst[1] = src[1];
  }

  function scale_vec2(pos, sx, sy){
    pos[0] *= sx, pos[1] *= sy;
  }
    
  function mix_vec2(u, v, t, r){
    r[0] = u[0] * (1-t) + v[0] * t,
    r[1] = u[1] * (1-t) + v[1] * t;
  }
  
  function distance(u, v){
    const dx = u[0] - v[0], dy = u[1] - v[1];
    return Math.sqrt(dx*dx + dy*dy);
  }

  function clamp(x, minVal, maxVal){
    return Math.min(Math.max(x, minVal), maxVal);
  }

  function smoothStep(edge0, edge1, x){
    const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
  }

  
  const superThat = {
    instance: function(spec){
      const _spec = Object.assign({
        n: 7,
        jitterThreshold: 8,
        moveThreshold: 15,
      }, spec);


      let _lmCount = -1;
      let _counter = 0;
      
      const _dims = {
        widthPx: -1,
        heightPx: -1
      };

      let _lmsPx = null;
      let _lmsStabilized = null, _lmsStabilizedPx = null;

      function allocate(lmCount){
        that.reset();
        _lmCount = lmCount;
                
        _lmsPx = allocate_pointsList(lmCount);
            
        _lmsStabilizedPx = allocate_pointsList(lmCount);
        _lmsStabilized = allocate_pointsList(lmCount);
      }

      function compute_lmsPx(landmarks){
        for (let i=0; i<_lmCount; ++i){
          copy_vec2(landmarks[i], _lmsPx[i]);
          scale_vec2(_lmsPx[i], _dims.widthPx * 0.5, _dims.heightPx * 0.5);
        }
      }


      function compute_stabilized(){
        for (let i=0; i<_lmCount; ++i){

          const posPx = _lmsPx[i];

          const d = distance(posPx, _lmsStabilizedPx[i]);

          //change the weight based on movement distance
          //small movement tends to be jitter
          //large movement have more chances to be real

          let w = smoothStep(_spec.jitterThreshold, _spec.moveThreshold, d);

          // console.log('d:', d, 'w:', w);
            
          const stabilizedPx = _lmsStabilizedPx[i];

          mix_vec2(stabilizedPx, posPx, w, stabilizedPx);
          
          // convert from pixels to normalized viewport coordinates:
          copy_vec2(_lmsStabilizedPx[i], _lmsStabilized[i]);
          scale_vec2(_lmsStabilized[i], 2 / _dims.widthPx, 2 / _dims.heightPx);
        }
      }

      const that = {
        update: function(landmarks, widthPx, heightPx, scale){
          // allocate if necessary:
          if (landmarks.length !== _lmCount){
            allocate(landmarks.length);
          }

          if (widthPx !== _dims.widthPx || heightPx !== _dims.heightPx){
            // if dimensions have changed, reset stabilization:
            _dims.widthPx = widthPx, _dims.heightPx = heightPx;
            that.reset();
          }

          // compute landmarks positions in pixels:
          compute_lmsPx(landmarks);

          if (++_counter < _spec.n){
            // not enough data yet to stabilize:
            return landmarks;
          }
            
          // compute stabilized from predicted
          compute_stabilized();
            
          return _lmsStabilized;
        },

        reset: function(){
          _counter = 0;
        }

      }
      return that;
    }
  }; //end that
  return superThat;
})();


// Export ES6 module:
try {
  module.exports = WebARRocksLMStabilizer;
} catch(e){
  console.log('ES6 Module not exported');
}
