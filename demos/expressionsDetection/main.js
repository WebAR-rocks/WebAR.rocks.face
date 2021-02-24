
function init_evaluators(){
  // run WEBARROCKSFACE.get_LMLabels() in the web console
  // to get landmarks labels provided by the current neural network
  
  // MOUTH:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('OPEN_MOUTH', {
    refLandmarks: ["lowerLipTop", "chin"],
    landmarks: ["lowerLipTop", "upperLipBot"],
    range: [0.05, 0.45],
    isInv: false,
    isDebug: true
  });

  // OPEN/CLOSE EYES:
  const closeEyeEvaluatorParams = {
    isInv: true,
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('CLOSE_LEFT_EYE', Object.assign({
    range: [0.18, 0.21],
    refLandmarks: ["leftEyeInt", "leftEyeExt"],
    landmarks: ["leftEyeTop", "leftEyeBot"]
  }, closeEyeEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('CLOSE_RIGHT_EYE', Object.assign({
    range: [0.23, 0.25],
    refLandmarks: ["rightEyeInt", "rightEyeExt"],
    landmarks: ["rightEyeTop", "rightEyeBot"]
  }, closeEyeEvaluatorParams));
}

function init_triggers(){
  WebARRocksFaceExpressionsEvaluator.add_trigger('OPEN_MOUTH', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - MOUTH OPEN');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - MOUTH CLOSED');
    }
  })
}


function start(){
  WebARRocksFaceDebugHelper.init({
    spec: {}, // keep default specs
    callbackReady: function(err, spec){
      init_evaluators();
      init_triggers();
    },
    callbackTrack: function(detectState){
      const expressionsValues = WebARRocksFaceExpressionsEvaluator.evaluate_expressions(detectState);
      //console.log(expressionsValues.OPEN_MOUTH);
      WebARRocksFaceExpressionsEvaluator.run_triggers(expressionsValues);      
    }
  })
}

function main(){
  WebARRocksResizer.size_canvas({
    canvasId: 'WebARRocksFaceCanvas',
    callback: start
  })
}