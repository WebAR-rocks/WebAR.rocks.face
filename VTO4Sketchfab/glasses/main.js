let _isVTO = false;

// entry point:
function main(){
  VTO4SketchfabHelper.init({
    uid: '96bb6b6ef7664d2a936192f138fa0507',
    iframe: document.getElementById('api-frame')
  }).then(function(){
    console.log('INFO in main: READY!');

    const toggleVTOButton = document.getElementById('toggleVTOButton');
    toggleVTOButton.style.display = 'block';

    toggleVTOButton.addEventListener('click', function(){
      toggleVTOButton.style.display = 'none';

      if (_isVTO){
        // exit VTO
        VTO4SketchfabHelper.toggle_VTO(false).then(function(){
          _isVTO = false;
          toggleVTOButton.innerHTML = 'Start VTO';
          toggleVTOButton.style.display = 'block';
        });

      } else {
        // enter VTO
        VTO4SketchfabHelper.toggle_VTO(true).then(function(){
          _isVTO = true;
          toggleVTOButton.innerHTML = 'Exit VTO';
          toggleVTOButton.style.display = 'block';
        });
      }

    });
  });
}


window.addEventListener('load', main);

