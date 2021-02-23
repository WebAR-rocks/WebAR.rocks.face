import React from 'react'

// import components:
import BackButton from '../components/BackButton.js'
import Mask from '../components/Mask';

function FlexibleMask() {

    // generate canvases:
    return (
      <div>
        <Mask />
        <BackButton />        
      </div>
    )
} 

export default FlexibleMask;
