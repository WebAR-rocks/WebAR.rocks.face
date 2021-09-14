
function start(){
  WebARRocksFaceDebugHelper.init({
    spec: {
      GPUThermalThrottlingDetectionEnabled: false
    },
    callbackReady: function(err, spec){

    },
    callbackTrack: function(detectState){
      
    }
  })
}


function main(){ // entry point
  WebARRocksResizer.size_canvas({
    canvasId: 'WebARRocksFaceCanvas',
    callback: start
  })
}


window.addEventListener('load', main);