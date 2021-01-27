/**
 * 
 * Use OneEuroFilter to minimize jitter and lag when tracking landmarks
 * OneEuroFilter Details: http://www.lifl.fr/~casiez/1euro
 * mincutoff : decrease to minimize jitter
 * beta: increate to minimize lag
 */

function OneEuroFilter(freq, mincutoff, beta, dcutoff){
	var that = {};
	var x = LowPassFilter(alpha(mincutoff));
	var dx = LowPassFilter(alpha(dcutoff));
	var lastTime = undefined;
	
	mincutoff = mincutoff || 1;
	beta = beta || 0;
	dcutoff = dcutoff || 1;
	
	function alpha(cutoff){
		var te = 1 / freq;
		var tau = 1 / (2 * Math.PI * cutoff);
		return 1 / (1 + tau / te);
	}
	
	that.filter = function(v, timestamp){
		if(lastTime !== undefined && timestamp !== undefined)
			freq = 1 / (timestamp - lastTime);
		lastTime = timestamp;
		var dvalue = x.hasLastRawValue() ? (v - x.lastRawValue()) * freq : 0;
		var edvalue = dx.filterWithAlpha(dvalue, alpha(dcutoff));
		var cutoff = mincutoff + beta * Math.abs(edvalue);
		return x.filterWithAlpha(v, alpha(cutoff));
	}

	that.reset = function(){
		lastTime = undefined;
	}
	
	return that;
}

function LowPassFilter(alpha, initval){
	var that = {};
	var y = initval || 0;
	var s = y;
	
	function lowpass(v){
		y = v;
		s = alpha * v + (1 - alpha) * s;
		return s;
	}
	
	that.filter = function(v){
		y = v;
		s = v;
		that.filter = lowpass;
		return s;
	}
	
	that.filterWithAlpha = function(v, a){
		alpha = a;
		return that.filter(v);
	}
	
	that.hasLastRawValue = function(){
		return that.filter === lowpass;
	}
	
	that.lastRawValue = function(){
		return y;
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
