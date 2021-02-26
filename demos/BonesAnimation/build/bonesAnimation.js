const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({alpha: true});
var clock = new THREE.Clock();
var mixer = null;
renderer.setClearColor(0xffffff, 0);
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild( renderer.domElement );

//make the screen responsible
window.addEventListener('resize', function()
{
  var width = window.innerWidth;
  var height = window.innerHeight;
  renderer.setSize(width,height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix( );
});

//load all 3D models on a scene
//the meshes must be on the same GLTF file
//just write the file directory (assets/3DMoodels/WATEVERTHEFILENAME.gltf)
function loadMesh() {
  var mesh = "assets/3DModels/TheHeroMage/Export/HeroMage.glb";
  const autoLoader = new THREE.GLTFLoader();
  autoLoader.load(mesh, function(gltf){

    gltf.scene.traverse(function(node){
    if (node.isSkinnedMesh) {
      node.castShadow = true;
      node.receiveShadow = true;}
    });
    scene.add(gltf.scene);

    mixer = new THREE.AnimationMixer( gltf.scene );
    for (var i = 0; i < gltf.animations.length; i++) {
      mixer.clipAction( gltf.animations[i]).play();
    }
  });
}

//setup lighting
var ambientLight = new THREE.AmbientLight( 0xB2F0FF, 3);
scene.add(ambientLight);

var pointLight = new THREE.PointLight( 0xF37827, 3 ,500)
pointLight.position.set( 100 ,200 ,100 );
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 512; // default
pointLight.shadow.mapSize.height = 512; // default
pointLight.shadow.camera.near = 0.5; // default
pointLight.shadow.camera.far = 500; // default
scene.add(pointLight);

//setup orbiControl
const controls = new THREE.OrbitControls(camera, renderer.domElement);

camera.position.z = 200;
controls.update();
controls.autoRotate = true;
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;

//rebdering each frame
const animate = function () {
  requestAnimationFrame( animate );

  controls.update();
  if ( mixer ) {
    mixer.update( clock.getDelta() );}
  renderer.render( scene, camera );
};

animate();
