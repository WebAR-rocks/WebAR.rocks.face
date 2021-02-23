// TODO: remove these imports
import envMap from '../../../assets/mask001/envmap.hdr';
import model from '../../../assets/mask001/model.glb';
import metadata from '../../../assets/mask001/metadata.json';
import occluder from '../../../assets/mask001/occluder.glb';

export default function getMask(maskId) {

    // TODO: if the mask is not available in the store, download the assets
    // TODO: if the mask has been already downloaded, return the assets

    return {
        envMap,
        model,
        metadata,
        occluder
    }
}