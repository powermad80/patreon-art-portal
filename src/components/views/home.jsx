import React, { Component } from "react";
import { browserHistory } from 'react-router';

export default class Home extends Component {
  componentDidMount() {
    browserHistory.push('/');
  }
  render() {
    return (
      <div id="home">
        <a href={"/dashboard"}><button className={"homebutton"}>Patron's Dashboard</button></a>
        <a href={"/subscribe"}><button className={"homebutton"}>Limited Tier Email List</button></a>
      </div>
    );
  }
}