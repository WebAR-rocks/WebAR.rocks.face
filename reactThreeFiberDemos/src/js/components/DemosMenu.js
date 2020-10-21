import React from 'react'
import { Link } from "react-router-dom";

export default function DemoMenu(props) {
  return (
    <div className='demoMenusContent'>
      <h1>Demos Menu</h1>
      <ul>
        <li><Link to='/earrings3D'>Earrings 3D virtual try-on</Link></li>
        <li><Link to='/flexibleMask2'>Flexible mask</Link></li>
        <li><Link to='/VTOGlasses'>Sunglasses virtual try-on</Link></li>
        <li><Link to='/VTOHelmet'>Headphones and motorcycle helmet virtual try-on</Link></li>
        <li><Link to='/VTONecklace'>Necklace virtual try-on</Link></li>
        <li><Link to='/makeupSport'>Sport makeup</Link></li>
        <li><Link to='/makeupTexture'>Texture based makeup</Link></li>
      </ul> 
    </div>
  )
}