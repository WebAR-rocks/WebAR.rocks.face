import { render } from 'react-dom'
import { Routes, Route, BrowserRouter as Router } from 'react-router-dom'

//import './index.css'

import DemosMenu from './js/components/DemosMenu'

import DemoEarrings3D from './js/demos/Earrings3D'

import DemoVTOGlasses from './js/demos/VTOGlasses'
import DemoVTOHelmet from './js/demos/VTOHelmet'
import DemoVTOHat from './js/demos/VTOHat'
import DemoVTONecklace from './js/demos/VTONecklace'

import DemoFlexibleMask2 from './js/demos/FlexibleMask2'

import DemoPiepacker from './js/demos/Piepacker'

import DemoMakeupSport from './js/demos/MakeupSport'
import DemoMakeupTexture from './js/demos/MakeupTexture'



export default function App(props){
  return (
    <Router>
      <Routes>
        <Route path="/earrings3D" element={<DemoEarrings3D />} />

        <Route path="/VTOGlasses" element={<DemoVTOGlasses />} />

        <Route path="/VTOHelmet" element={<DemoVTOHelmet />} />

        <Route path="/VTOHat" element={<DemoVTOHat />} />

        <Route path="/VTONecklace" element={<DemoVTONecklace />} />

        <Route path="/flexibleMask2" element={<DemoFlexibleMask2 />} />

        <Route path="/piepacker" element={<DemoPiepacker />} />

        <Route path="/makeupSport" element={<DemoMakeupSport />} />

        <Route path="/makeupTexture" element={<DemoMakeupTexture />} />
        
        <Route path="/" element={ <DemosMenu />} />
      </Routes>
    </Router>
  )
}