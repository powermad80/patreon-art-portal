import React from 'react';
import { Route, IndexRoute } from 'react-router';
import App from './components/app';
import Home from './components/views/home';
import Contact from './components/views/contact';
import Subscribe from './components/views/subscribe';

export default (
  <Route path='/' component={App}>
    <IndexRoute component={Home} />
    <Route path='subscribe' component={Subscribe} />
    <Route path='contact' component={Contact} />
    <Route path='*' component={Home} />
  </Route>
);