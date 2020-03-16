
function start(){
  WebARRocksFaceHelper.init({
    spec: {}, // keep default specs
    features: {}, // keep default features
    callbackReady: function(err, spec){

    },
    callbackTrack: function(detectState){
      
    }
  })
}

function main(){
  WebARRocksResizer.size_canvas({
    canvasId: 'WebARRocksFaceCanvas',
    callback: start
  })
}