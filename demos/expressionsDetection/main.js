
function init_evaluators(){
  // run WEBARROCKSFACE.get_LMLabels() in the web console
  // to get landmarks labels provided by the current neural network
  
  // MOUTH OPEN:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('OPEN_MOUTH', {
    refLandmarks: ["lowerLipBot", "chin"],
    landmarks: ["lowerLipBot", "upperLipTop"],
    range: [0.65, 1.2],
    isInv: false,
    isDebug: true
  });

  // MOUTH SMILE:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('SMILE', {
    refLandmarks: ["mouthLeft", "mouthRight"],
    landmarks: ["lowerLipBot", "upperLipTop"],
    range: [0.22, 0.35],
    isInv: true,
    isDebug: true
  });

  // OPEN/CLOSE EYES:
  /*const closeEyeEvaluatorParams = {
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
  //*/

  // EYEBROWS
  const eyebrowEvaluatorParams = {
    isInv: true,
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_RIGHT_DOWN', Object.assign({
    range: [0.9, 1.1],
    refLandmarks: ["rightEyeInt", "rightEyeExt"],
    landmarks: ["rightEyeTop", "rightEyeBrowCenter"]
  }, eyebrowEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_RIGHT_DOWN', Object.assign({
    range: [0.9, 1.1],
    refLandmarks: ["leftEyeInt", "leftEyeExt"],
    landmarks: ["leftEyeTop", "leftEyeBrowCenter"]
  }, eyebrowEvaluatorParams));
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
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('SMILE', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - SMILE');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - NOT SMILE');
    }
  });
}


function start(){
  WebARRocksFaceDebugHelper.init({
    spec: {
      NNCPath: '../../neuralNets/NN_AUTOBONES_1.json'
    }, // keep default specs
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