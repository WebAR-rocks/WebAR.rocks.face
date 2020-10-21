import React from 'react'
import { render } from 'react-dom'
import { AppContainer } from 'react-hot-loader'
import { Switch, Route, BrowserRouter as Router } from 'react-router-dom'

import './styles/index.scss'

import DemosMenu from './js/components/DemosMenu'

import DemoEarrings3D from './js/demos/Earrings3D.js'

import DemoVTOGlasses from './js/demos/VTOGlasses.js'
import DemoVTOHelmet from './js/demos/VTOHelmet.js'
import DemoVTONecklace from './js/demos/VTONecklace.js'

import DemoFlexibleMask2 from './js/demos/FlexibleMask2.js'

import DemoMakeupSport from './js/demos/MakeupSport.js'
import DemoMakeupTexture from './js/demos/MakeupTexture.js'

render(
  <AppContainer>
    <Router>
      <Switch>

        <Route path="/earrings3D">
          <DemoEarrings3D />
        </Route>

        <Route path="/VTOGlasses">
          <DemoVTOGlasses />
        </Route>

        <Route path="/VTOHelmet">
          <DemoVTOHelmet />
        </Route>

        <Route path="/VTONecklace">
          <DemoVTONecklace />
        </Route>

        <Route path="/flexibleMask2">
          <DemoFlexibleMask2 />
        </Route>

        <Route path="/makeupSport">
          <DemoMakeupSport />
        </Route>

        <Route path="/makeupTexture">
          <DemoMakeupTexture />
        </Route>

        <Route path="/">
          <DemosMenu />
        </Route>

      </Switch>
    </Router>
  </AppContainer>,
  document.querySelector('#root')
);