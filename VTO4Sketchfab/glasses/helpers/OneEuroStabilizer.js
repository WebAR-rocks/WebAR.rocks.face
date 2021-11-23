/**
 * 
 * Use OneEuroFilter to minimize jitter and lag when tracking landmarks
 * OneEuroFilter Details: http://www.lifl.fr/~casiez/1euro
 * mincutoff: decrease to minimize jitter
 * beta: increate to minimize lag
 */

function OneEuroFilter(spec){
  let _lastTime = -1;
  let _freq = spec.freq;
  
  const _x = filter_lowPass(compute_alpha(spec.mincutoff));
  const _dx = filter_lowPass(compute_alpha(spec.dcutoff));
  const _dtMin = 1.0 / spec.freqRange[1];

  function compute_alpha(cutoff){
    const te = 1.0 / _freq;
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }
  
  this.filter = function(v, timestamp){
    if(_lastTime !== -1){
      const dt = Math.max(_dtMin, timestamp - _lastTime);
      _freq = 1.0 / dt;
      // clamp freq:
      _freq = Math.min(Math.max(_freq, spec.freqRange[0]), spec.freqRange[1]);
    }
    _lastTime = timestamp;
    const dvalue = _x.has_lastRawValue() ? (v - _x.get_lastRawValue()) * _freq : 0.0;
    const edvalue = _dx.filter_withAlpha(dvalue, compute_alpha(spec.dcutoff));
    const cutoff = spec.mincutoff + spec.beta * Math.abs(edvalue);
    return _x.filter_withAlpha(v, compute_alpha(cutoff));
  }

  this.reset = function(){
    _freq = spec.freq;
    _lastTime = -1;
    _x.reset();
    _dx.reset();
  }
}


function filter_lowPass(alpha, y0){
  let _y = y0 || 0.0;
  let _s = _y;
  let _isFirstTime = true;
  
  function filter(v){
    _y = v;
    if (_isFirstTime){
      _s = v;
      _isFirstTime = false;
    } else {
      _s = alpha * v + (1.0 - alpha) * _s;
    }
    return _s;
  }

  const that = {  
    filter_withAlpha: function(v, a){
      alpha = a;
      return filter(v);
    },
    
    has_lastRawValue: function(){
      return !_isFirstTime;
    },
    
    get_lastRawValue: function(){
      return _y;
    },

    reset: function(){
      _isFirstTime = true;
      _y = y0 || 0.0;
      _s = _y;
    }
  }
  
  return that;
}


const WebARRocksLMStabilizer = (function(){
  const superThat = {
    instance: function(spec){
      const defaultSpec = {
        freq: 30,
        freqRange: [12, 144],
        mincutoff: 0.001,
        beta: 50,
        dcutoff: 1.0
      };
      const _spec = Object.assign({}, defaultSpec, spec);
      const _filters = [];
      const _stabilizedLM = [];
      const _timer = (typeof(performance) === 'undefined') ? Date : performance;

      const that = {
        update: function(landmarks){
          const LMCount = landmarks.length;

          // Filters length should be landmarks length * 2 (x,y):
          while (_filters.length < LMCount*2) {
            const filter = new OneEuroFilter(_spec);
            _filters.push(filter);
          }

          // init stabilizedLM array if necessary:
          if (_stabilizedLM.length !== LMCount){
            _stabilizedLM.splice(0);
            for (let i=0; i<LMCount; ++i){
              _stabilizedLM.push([0.0, 0.0]);
            }
          }

          // Stabilize each lm with one euro filter
          const timestamp = _timer.now() / 1000.0;
          for (let i=0; i<LMCount; ++i) {
            const x = landmarks[i][0];
            const y = landmarks[i][1];

            _stabilizedLM[i][0] = _filters[i*2].filter(x, timestamp);
            _stabilizedLM[i][1] = _filters[i*2 + 1].filter(y, timestamp);
          }
          return _stabilizedLM;
        },


        reset: function() {
          _filters.forEach( filter => { filter.reset() });
        }
      }

      return that;
    }
  }
  return superThat;
})();


// Export ES6 module:
try {
  module.exports = WebARRocksLMStabilizer;
} catch(e){
  console.log('ES6 Module not exported');
}
