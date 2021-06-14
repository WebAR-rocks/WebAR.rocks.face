/**
 * 
 * Use OneEuroFilter to minimize jitter and lag when tracking landmarks
 * OneEuroFilter Details: http://www.lifl.fr/~casiez/1euro
 * mincutoff: decrease to minimize jitter
 * beta: increate to minimize lag
 */

function OneEuroFilter(freq, mincutoff, beta, dcutoff){
  const x = LowPassFilter(alpha(mincutoff));
  const dx = LowPassFilter(alpha(dcutoff));
 let lastTime = -1;
  
  mincutoff = mincutoff || 1;
  beta = beta || 0;
  dcutoff = dcutoff || 1;
  
  function alpha(cutoff){
    const te = 1 / freq;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }
  
  const that = {
    filter: function(v, timestamp){
      if(lastTime !== -1 && timestamp !== undefined)
        freq = 1 / (timestamp - lastTime);
      lastTime = timestamp;
      const dvalue = x.hasLastRawValue() ? (v - x.lastRawValue()) * freq : 0;
      const edvalue = dx.filterWithAlpha(dvalue, alpha(dcutoff));
      const cutoff = mincutoff + beta * Math.abs(edvalue);
      return x.filterWithAlpha(v, alpha(cutoff));
    },

    reset: function(){
      lastTime = -1;
    }
  };
  
  return that;
}


function LowPassFilter(alpha, initval){
  let y = initval || 0;
  let s = y;
  
  function lowpass(v){
    y = v;
    s = alpha * v + (1 - alpha) * s;
    return s;
  }
  
  const that = {  
    filter: function(v){
      y = v;
      s = v;
      that.filter = lowpass;
      return s;
    },

    filterWithAlpha: function(v, a){
      alpha = a;
      return that.filter(v);
    },
    
    hasLastRawValue: function(){
      return that.filter === lowpass;
    },
    
    lastRawValue: function(){
      return y;
    }
  }
  
  return that;
}


const WebARRocksLMStabilizer = (function(){
  const superThat = {
    instance: function(spec){
      let defaultSpec = {
        freq: 30,
        mincutoff: 0.001,
        beta: 50,
        dcutoff: 1
      }

      spec = Object.assign({}, defaultSpec, spec)
      
      let filters = []

      const that = {
        update: function(landmarks){
          //init filters
          //filters length should be landmarks length * 2 (x,y)
          if (filters.length != landmarks.length*2)
            for (let i=0; i<landmarks.length*2; i++)
              filters[i] = new OneEuroFilter(spec.freq, spec.mincutoff, spec.beta, spec.dcutoff)

          //stabilize each lm with one euro filter
          let stabilizedLM = []
          let timestamp = Date.now() / 1000
          for (let i=0; i<landmarks.length; i++)
          {          
            stabilizedLM[i] = [filters[i*2].filter(landmarks[i][0], timestamp), 
              filters[i*2+1].filter(landmarks[i][1], timestamp)]
          }


          return stabilizedLM
        },
        reset: function()
        {
          filters.forEach( filter => { filter.reset() })
        }
      }

      return that
    }
  }
  return superThat
})();

// Export ES6 module:
try {
  module.exports = WebARRocksLMStabilizer;
} catch(e){
  console.log('ES6 Module not exported');
}
