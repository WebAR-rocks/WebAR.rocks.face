
function init_evaluators(){
  // run WEBARROCKSFACE.get_LMLabels() in the web console
  // to get landmarks labels provided by the current neural network
  

  // MOUTH OPEN:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('OPEN_MOUTH', {
    refLandmarks: ["lowerLipBot", "chin"],
    landmarks: ["lowerLipBot", "upperLipTop"],
    range: [0.8, 1.3], //[0.65, 1.2]
    isInv: false,
    isDebug: true
  });


  // MOUTH SMILE:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('SMILE', {
    refLandmarks: ["mouthLeft", "mouthRight"],
    landmarks: ["lowerLipBot", "upperLipTop"],
    range: [0.2, 0.3], // originally [0.22, 0.35] but smile was too hard to detect
       // [0.27, 0.35] fine for AUTOBONES_19 but not for autobones _21
    isInv: true,
    isDebug: true
  });


  // OPEN/CLOSE EYES:
  const closeEyeEvaluatorParams = {
    range: [0.3, 0.6],//[0.4, 0.7],// [0.3, 0.6] --> not sensitive enough [0.5, 0.8] --> too sensitive,
      // [0.35, 0.65] -> value for NN_AUTOBONES_19, too sensitive for _21
    isInv: true,
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('CLOSE_LEFT_EYE', Object.assign({
    refLandmarks: ["leftEyeTopFixed", "leftEyeBot"],
    landmarks: ["leftEyeTop", "leftEyeBot"]
  }, closeEyeEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('CLOSE_RIGHT_EYE', Object.assign({
    refLandmarks: ["rightEyeTopFixed", "rightEyeBot"],
    landmarks: ["rightEyeTop", "rightEyeBot"]
  }, closeEyeEvaluatorParams));


  // EYEBROWS UP:
  const eyebrowUpEvaluatorParams = {
    range: [0.95, 1.4],//[1.0, 1.5],
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_RIGHT_UP', Object.assign({
    refLandmarks: ["rightEyeTopFixed", "rightEyeBrowCenterFixed"],
    landmarks: ["rightEyeTopFixed", "rightEyeBrowCenter"]
  }, eyebrowUpEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_LEFT_UP', Object.assign({
    refLandmarks: ["leftEyeTopFixed", "leftEyeBrowCenterFixed"],
    landmarks: ["leftEyeTopFixed", "leftEyeBrowCenter"]
  }, eyebrowUpEvaluatorParams));


  // EYEBROWS DOWN:
  const eyebrowDownEvaluatorParams = {
    range: [0.75, 0.95], // [0.8, 1.0] -> too sensitive [0.7, 0.9] -> not sensitive enough
    isInv: true,
    isDebug: true,
    delayMinMs: 500
  };
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_RIGHT_DOWN', Object.assign({
    refLandmarks: ["rightEyeTopFixed", "rightEyeBrowCenterFixed"],
    landmarks: ["rightEyeTopFixed", "rightEyeBrowCenter"]
  }, eyebrowDownEvaluatorParams));
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROW_LEFT_DOWN', Object.assign({
    refLandmarks: ["leftEyeTopFixed", "leftEyeBrowCenterFixed"],
    landmarks: ["leftEyeTopFixed", "leftEyeBrowCenter"]
  }, eyebrowDownEvaluatorParams));

  // COMPOSITE EVALUATORS:
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('WINK', {
    computeFrom: ['CLOSE_LEFT_EYE', 'CLOSE_RIGHT_EYE'],
    operator: 'MIN',
    isDebug: true,
    delayMinMs: 500
  });
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROWS_UP', {
    computeFrom: ['EYEBROW_RIGHT_UP', 'EYEBROW_LEFT_UP'],
    operator: 'MAX',
    isDebug: true,
    delayMinMs: 500
  });
  WebARRocksFaceExpressionsEvaluator.add_expressionEvaluator('EYEBROWS_DOWN', {
    computeFrom: ['EYEBROW_RIGHT_DOWN', 'EYEBROW_LEFT_DOWN'],
    operator: 'MIN',
    isDebug: true,
    delayMinMs: 500
  });

}



function init_triggers(){
  WebARRocksFaceExpressionsEvaluator.add_trigger('OPEN_MOUTH', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - MOUTH OPEN START');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - MOUTH OPEN END');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('SMILE', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - SMILE START');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - SMILE END');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('WINK', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - WINK START');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - WINK END');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('EYEBROWS_UP', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - EYEBROWS UP START');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - EYEBROWS UP END');
    }
  });
  WebARRocksFaceExpressionsEvaluator.add_trigger('EYEBROWS_DOWN', {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: function(){
      console.log('TRIGGER FIRED - EYEBROWS DOWN START');
    },
    onEnd: function(){
      console.log('TRIGGER FIRED - EYEBROWS DOWN END');
    }
  });
}


function start(){
  WebARRocksFaceDebugHelper.init({
    spec: {
      NNCPath: '../../neuralNets/NN_AUTOBONES_21.json'
    },
    //videoURL: '../../../../testVideos/sensitivityEyes.mp4',
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


// entry point:
function main(){
  WebARRocksResizer.size_canvas({
    canvasId: 'WebARRocksFaceCanvas',
    callback: start
  })
}


window.addEventListener('load', main);