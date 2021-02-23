import React, { useState, useEffect, useRef } from 'react'
import BackButton from '../components/BackButton.js'

import useMask from '../hooks/useMask';

let _timerResize = null;

const compute_sizing = () => {
  // compute  size of the canvas:
  const height = window.innerHeight
  const wWidth = window.innerWidth
  const width = Math.min(wWidth, height)

  // compute position of the canvas:
  const top = 0
  const left = (wWidth - width ) / 2
  return {width, height, top, left}
}

export default function FlexibleMask() {
  const [sizing, setSizing] = useState(compute_sizing());
  const canvasRef = useRef(null);

  const handle_resize = () => {
    // do not resize too often:
    if (_timerResize) {
      clearTimeout(_timerResize)
    }
    _timerResize = setTimeout(() => setSizing(compute_sizing()), 200)
  }

  useEffect( () => {
    window.addEventListener('resize', handle_resize)
    window.addEventListener('orientationchange', handle_resize)

    return () => {
      _timerResize = null;
      //TODO: remove event listeners
    }
  }, [] )

  const {Canvas, mediaStream} = useMask({
    canvasRef,
    sizing
  })

  return (
    <div>

      <canvas />


      {/* Canvas managed by three fiber, for AR: */}
      <Canvas>

      </Canvas>

      {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
      <canvas className='mirrorX' ref={canvasRef} style={{
        position: 'fixed',
        zIndex: 1,
        ...sizing
      }} width={sizing.width} height={sizing.height} />

      <BackButton />
    </div>
  )

}